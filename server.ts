import { createServer } from 'http'
import { Server } from 'socket.io'
import next from 'next'
import { nanoid } from 'nanoid'

import { getGame, setGame, deleteGame, getAllGames } from '@/lib/store'
import {
  createGame,
  dealHoleCards,
  processAction,
  buildClientState,
  rotateBlinds,
} from '@/lib/gameEngine'
import { determineWinners } from '@/lib/handEvaluator'
import { getAIDecision, logAIConnectionStatus } from '@/lib/llmOrchestrator'

import type {
  ServerToClientEvents,
  ClientToServerEvents,
  CreateGameOptions,
  ActionPayload,
  GameState,
  AIModel,
} from '@/types/poker'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_AI_MODELS   = new Set<AIModel>(['claude', 'chatgpt', 'gemini', 'grok', 'deepseek'])
const VALID_ACTIONS     = new Set(['fold', 'call', 'raise', 'check'])
const MAX_GAMES_PER_IP  = 5           // max concurrent games per IP
const GAME_TTL_MS       = 60 * 60 * 1000  // 1 hour — abandoned games cleaned up
const RATE_WINDOW_MS    = 10_000      // 10 seconds
const RATE_MAX_CREATES  = 3           // max create_game per socket per window

// ─── Input validators ─────────────────────────────────────────────────────────

function isValidGameId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{4,16}$/.test(id)
}

function isValidPlayerId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)
}

function isValidAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100_000_000
}

/** Strip everything outside printable ASCII, then drop prompt-injection triggers */
function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw
    .replace(/[^\x20-\x7E]/g, '')   // printable ASCII only
    .replace(/[<>'"`;]/g, '')        // no HTML/script chars
    .trim()
    .slice(0, 20)
  if (cleaned.length === 0) return null

  // Block prompt-injection keywords that could manipulate LLM system prompts
  const lower = cleaned.toLowerCase()
  const INJECTION_TRIGGERS = [
    'ignore', 'forget', 'disregard', 'system', 'instruction',
    'prompt', 'override', 'jailbreak', 'reveal', 'print', 'output',
    'assistant', 'user:', 'ai:', 'gpt', 'claude', 'gemini',
  ]
  if (INJECTION_TRIGGERS.some(t => lower.includes(t))) return null
  return cleaned
}

function validateCreateOpts(opts: unknown): CreateGameOptions | string {
  if (!opts || typeof opts !== 'object') return 'Invalid options'
  const o = opts as Record<string, unknown>

  // selectedAIs
  if (!Array.isArray(o.selectedAIs) || o.selectedAIs.length === 0 || o.selectedAIs.length > 5)
    return 'selectedAIs must be 1–5 models'
  for (const m of o.selectedAIs) {
    if (!VALID_AI_MODELS.has(m as AIModel)) return `Unknown AI model: ${m}`
  }
  // Remove duplicates
  const selectedAIs: AIModel[] = [...new Set(o.selectedAIs as AIModel[])]

  // watchOnly
  if (typeof o.watchOnly !== 'boolean') return 'watchOnly must be boolean'

  // humanPlayerName
  let humanPlayerName: string | undefined
  if (!o.watchOnly) {
    const name = sanitizeName(o.humanPlayerName)
    if (!name) return 'Invalid player name'
    humanPlayerName = name
  }

  // Numeric fields
  const startingStack = Number(o.startingStack)
  const smallBlind    = Number(o.smallBlind)
  const bigBlind      = Number(o.bigBlind)

  if (!Number.isInteger(startingStack) || startingStack < 100 || startingStack > 10_000_000)
    return 'startingStack must be 100–10,000,000'
  if (!Number.isInteger(smallBlind) || smallBlind < 1 || smallBlind > 1_000_000)
    return 'smallBlind out of range'
  if (!Number.isInteger(bigBlind) || bigBlind < 2 || bigBlind > 1_000_000)
    return 'bigBlind out of range'
  if (bigBlind !== smallBlind * 2)
    return 'bigBlind must equal 2× smallBlind'
  if (startingStack < bigBlind * 2)
    return 'startingStack must be at least 2× bigBlind'

  return {
    selectedAIs,
    watchOnly:    o.watchOnly,
    humanPlayerName,
    startingStack,
    smallBlind,
    bigBlind,
  }
}

// ─── Game helpers ─────────────────────────────────────────────────────────────

async function broadcastGameState(gameId: string, io: Server, state: GameState): Promise<void> {
  const sockets = await io.in(gameId).fetchSockets()
  for (const socket of sockets) {
    const pid = (socket.data as { playerId?: string }).playerId ?? ''
    socket.emit('game_state', buildClientState(state, pid))
  }
}

// Guard against concurrent AI turns on the same game
const aiTurnActive = new Set<string>()

async function triggerAITurn(gameId: string, io: Server): Promise<void> {
  if (aiTurnActive.has(gameId)) return   // already processing this game
  aiTurnActive.add(gameId)

  try {
    while (true) {
      const state = getGame(gameId)
      if (!state || state.phase === 'showdown' || state.phase === 'ended') break

      const player = state.players[state.currentTurnIdx]
      if (!player || !player.isAI || player.folded || !player.isActive) break

      io.to(gameId).emit('llm_thinking', player.id)

      const payload = await getAIDecision(state, player.id)

      // Re-read state after the async call — it may have changed
      const fresh = getGame(gameId)
      if (!fresh || fresh.phase === 'showdown' || fresh.phase === 'ended') break
      if (fresh.players[fresh.currentTurnIdx]?.id !== player.id) break

      let next: GameState
      try {
        next = processAction(fresh, player.id, payload.action, payload.amount)
      } catch {
        try { next = processAction(fresh, player.id, 'call', 0) }
        catch { break }
      }

      setGame(gameId, next)
      await broadcastGameState(gameId, io, next)

      if (next.phase === 'showdown') {
        // Release the lock BEFORE handleShowdown so the next round's
        // triggerAITurn call can acquire it
        aiTurnActive.delete(gameId)
        await handleShowdown(gameId, io)
        return   // handleShowdown starts the next round; we're done
      }
    }
  } finally {
    aiTurnActive.delete(gameId)
  }
}

async function startRound(gameId: string, io: Server): Promise<void> {
  try {
    const state = getGame(gameId)
    if (!state) return

    const dealt = dealHoleCards(state)
    setGame(gameId, dealt)
    await broadcastGameState(gameId, io, dealt)

    console.log(`[game] ${gameId} round ${dealt.roundNumber} started — ${dealt.players.filter(p => p.isActive).length} active players`)

    if (dealt.players[dealt.currentTurnIdx]?.isAI) {
      await triggerAITurn(gameId, io)
    }
  } catch (err) {
    console.error(`[game] ❌ startRound ERROR for ${gameId}:`, (err as Error).message)
  }
}

async function handleShowdown(gameId: string, io: Server): Promise<void> {
  try {
    let state = getGame(gameId)
    if (!state) return

    const winners = determineWinners(state)

    const players = state.players.map(p => {
      const win = winners.find(w => w.playerId === p.id)
      return win ? { ...p, stack: p.stack + win.amount } : p
    })

    state = { ...state, players, winners, phase: 'showdown' }
    setGame(gameId, state)
    await broadcastGameState(gameId, io, state)
    io.to(gameId).emit('game_over', winners)

    console.log(`[game] ${gameId} round ${state.roundNumber} showdown — waiting for CONTINUE`)
    // Stop here. The next round starts when the client emits 'next_round'.

  } catch (err) {
    console.error(`[game] ❌ handleShowdown ERROR for ${gameId}:`, (err as Error).message)
  }
}

// Called when client clicks CONTINUE
async function handleNextRound(gameId: string, io: Server): Promise<void> {
  try {
    const state = getGame(gameId)
    if (!state || state.phase !== 'showdown') return

    let next = {
      ...state,
      players: state.players.map(p => ({ ...p, isActive: p.stack > 0 })),
    }

    const activePlayers = next.players.filter(p => p.isActive)
    if (activePlayers.length <= 1) {
      const ended = { ...next, phase: 'ended' as const }
      setGame(gameId, ended)
      await broadcastGameState(gameId, io, ended)
      setTimeout(() => deleteGame(gameId), 5 * 60 * 1000)
      console.log(`[game] ${gameId} ended — only ${activePlayers.length} player(s) left`)
      return
    }

    // Only skip round counter for pure preflop folds (no community cards dealt = no real hand played)
    const wasPreflopFold = (state.winners?.every(w => w.handName === 'Last Standing') ?? false)
                           && state.communityCards.length === 0
    const prevRound = state.roundNumber

    console.log(`[game] ${gameId} round ${prevRound} complete${wasPreflopFold ? ' (preflop fold)' : ''} — starting next round`)
    next = rotateBlinds(next)

    // Pure preflop folds don't count toward the round number
    if (wasPreflopFold) {
      next = { ...next, roundNumber: prevRound }
    }

    setGame(gameId, next)
    await startRound(gameId, io)
  } catch (err) {
    console.error(`[game] ❌ handleNextRound ERROR for ${gameId}:`, (err as Error).message)
  }
}

// Periodically clean up abandoned games (no action for > 1 hour)
function startGameReaper() {
  setInterval(() => {
    const now = Date.now()
    for (const state of getAllGames()) {
      if (now - state.lastActionAt > GAME_TTL_MS) {
        deleteGame(state.id)
        console.log(`[reaper] cleaned up stale game ${state.id}`)
      }
    }
  }, 5 * 60 * 1000) // run every 5 minutes
}

// ─── Server bootstrap ─────────────────────────────────────────────────────────

app.prepare().then(() => {
  const handle     = app.getRequestHandler()
  const httpServer = createServer((req, res) => handle(req, res))

  const allowedOrigin = process.env.ALLOWED_ORIGIN ?? (dev ? '*' : '*')
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: allowedOrigin },
  })

  // Track create_game rate per socket: { count, windowStart }
  const createRateMap = new Map<string, { count: number; windowStart: number }>()
  // Track game count per IP
  const gamesPerIp    = new Map<string, Set<string>>()

  startGameReaper()

  io.on('connection', socket => {
    const clientIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
      ?? socket.handshake.address

    console.log(`[socket] connected: ${socket.id} ip: ${clientIp}`)

    // ── create_game ────────────────────────────────────────────────────────────
    socket.on('create_game', async (opts: unknown) => {
      // Rate limiting per socket
      const now  = Date.now()
      const rate = createRateMap.get(socket.id) ?? { count: 0, windowStart: now }
      if (now - rate.windowStart > RATE_WINDOW_MS) {
        rate.count = 0; rate.windowStart = now
      }
      rate.count++
      createRateMap.set(socket.id, rate)
      if (rate.count > RATE_MAX_CREATES) {
        socket.emit('game_error', 'Too many games created. Wait a moment.')
        return
      }

      // IP-level game cap
      const ipGames = gamesPerIp.get(clientIp) ?? new Set()
      if (ipGames.size >= MAX_GAMES_PER_IP) {
        socket.emit('game_error', 'Too many active games from your connection.')
        return
      }

      // Validate options
      const validated = validateCreateOpts(opts)
      if (typeof validated === 'string') {
        socket.emit('game_error', validated)
        return
      }

      const gameId = nanoid(8)
      const state  = createGame(validated, gameId)
      setGame(gameId, state)

      // Log AI connection status so user can verify keys
      logAIConnectionStatus(validated.selectedAIs)

      ipGames.add(gameId)
      gamesPerIp.set(clientIp, ipGames)

      socket.join(gameId)
      const humanPlayerId = validated.watchOnly ? '' : `human_${gameId}`
      ;(socket.data as { playerId?: string; gameId?: string }).playerId = humanPlayerId
      ;(socket.data as { playerId?: string; gameId?: string }).gameId   = gameId

      socket.emit('game_state', buildClientState(state, humanPlayerId))
      socket.emit('game_created', gameId)

      // Decouple startRound from the emit — give the client time to
      // receive game_created and redirect before AI turns block the loop
      setTimeout(() => startRound(gameId, io), 200)
    })

    // ── join_game ──────────────────────────────────────────────────────────────
    socket.on('join_game', (rawGameId: unknown, rawPlayerId: unknown) => {
      if (!isValidGameId(rawGameId)) {
        socket.emit('game_error', 'Invalid game ID')
        return
      }
      if (rawPlayerId !== '' && !isValidPlayerId(rawPlayerId)) {
        socket.emit('game_error', 'Invalid player ID')
        return
      }

      const gameId   = rawGameId as string
      const playerId = rawPlayerId as string
      const state    = getGame(gameId)

      if (!state) {
        socket.emit('game_error', `Game ${gameId} not found`)
        return
      }

      // Never allow impersonating an AI player
      if (playerId) {
        const player = state.players.find(p => p.id === playerId)
        if (!player || player.isAI) {
          socket.emit('game_error', 'Cannot join as this player')
          return
        }
      }

      socket.join(gameId)
      ;(socket.data as { playerId?: string; gameId?: string }).playerId = playerId
      ;(socket.data as { playerId?: string; gameId?: string }).gameId   = gameId
      socket.emit('game_state', buildClientState(state, playerId))
    })

    // ── player_action ──────────────────────────────────────────────────────────
    socket.on('player_action', async (payload: unknown) => {
      if (!payload || typeof payload !== 'object') {
        socket.emit('game_error', 'Malformed action')
        return
      }
      const p = payload as Record<string, unknown>

      // Validate gameId and playerId from payload
      if (!isValidGameId(p.gameId))   { socket.emit('game_error', 'Invalid game ID'); return }
      if (!isValidPlayerId(p.playerId)) { socket.emit('game_error', 'Invalid player ID'); return }
      if (!VALID_ACTIONS.has(p.action as string)) { socket.emit('game_error', 'Invalid action'); return }

      const gameId   = p.gameId   as string
      const playerId = p.playerId as string
      const action   = p.action   as ActionPayload['action']
      const amount   = p.amount !== undefined ? Number(p.amount) : 0

      if (!isValidAmount(amount)) { socket.emit('game_error', 'Invalid amount'); return }

      // ★ CRITICAL: verify the socket owns this playerId
      const socketData = socket.data as { playerId?: string; gameId?: string }
      if (socketData.playerId !== playerId) {
        socket.emit('game_error', 'Not authorised to act for this player')
        return
      }
      // ★ CRITICAL: verify the socket is in the correct game
      if (socketData.gameId !== gameId) {
        socket.emit('game_error', 'Not in this game')
        return
      }

      const state = getGame(gameId)
      if (!state) { socket.emit('game_error', 'Game not found'); return }

      // Prevent acting during an AI turn
      if (aiTurnActive.has(gameId)) {
        socket.emit('game_error', 'AI is still thinking')
        return
      }

      let next: GameState
      try {
        next = processAction(state, playerId, action, Math.floor(amount))
      } catch (err) {
        socket.emit('game_error', (err as Error).message)
        return
      }

      setGame(gameId, next)
      await broadcastGameState(gameId, io, next)

      if (next.phase === 'showdown') {
        await handleShowdown(gameId, io)
      } else {
        await triggerAITurn(gameId, io)
      }
    })

    // ── next_round ───────────────────────────────────────────────────────────
    socket.on('next_round', async (rawGameId: unknown) => {
      if (!isValidGameId(rawGameId)) {
        socket.emit('game_error', 'Invalid game ID')
        return
      }
      const gameId = rawGameId as string
      const socketData = socket.data as { playerId?: string; gameId?: string }
      if (socketData.gameId !== gameId) {
        socket.emit('game_error', 'Not in this game')
        return
      }
      await handleNextRound(gameId, io)
    })

    socket.on('disconnect', () => {
      createRateMap.delete(socket.id)
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(3000, () => {
    console.log('PokerLLM running on http://localhost:3000')
  })
})
