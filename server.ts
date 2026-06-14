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
import { getAIDecision, logAIConnectionStatus, reflectOnHand, clearGameMemory, getGameMemories, addChatMessage } from '@/lib/llmOrchestrator'
import { promoteGameLearnings } from '@/lib/permanentMemory'
import { getSocketSession } from '@/lib/socketAuth'

import type {
  ServerToClientEvents,
  ClientToServerEvents,
  CreateGameOptions,
  ActionPayload,
  GameState,
  AIModel,
  AIReflectionPayload,
} from '@/types/poker'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_AI_MODELS   = new Set<AIModel>(['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'groq'])
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

      // ── Emit AI table talk if the AI said something ──
      if (payload.chat) {
        const chatMsg = {
          playerId: player.id,
          playerName: player.name,
          message: payload.chat,
          ts: Date.now(),
        }
        io.to(gameId).emit('ai_chat', chatMsg)
        // Store in chat log so other AIs can see and reply
        addChatMessage(gameId, player.name, payload.chat)
        console.log(`[CHAT] 💬 ${player.name}: "${payload.chat}"`)
      }

      if (next.phase === 'showdown') {
        // Don't broadcast here — handleShowdown will broadcast once WITH winners
        aiTurnActive.delete(gameId)
        await handleShowdown(gameId, io)
        return
      }

      // Only broadcast non-showdown states (showdown is handled above)
      await broadcastGameState(gameId, io, next)
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

    const active = dealt.players.filter(p => p.isActive)
    const dealer = dealt.players[dealt.dealerIdx]?.name ?? '?'
    const sb     = dealt.players[dealt.smallBlindIdx]?.name ?? '?'
    const bb     = dealt.players[dealt.bigBlindIdx]?.name ?? '?'
    console.log(`\n┌─── ROUND ${dealt.roundNumber} ─── ${gameId} ───────────────────────┐`)
    console.log(`│  ${active.length} players | Dealer: ${dealer} | SB: ${sb} | BB: ${bb}`)
    console.log(`└──────────────────────────────────────────────┘`)

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

    const winSummary = winners.map(w => `${state.players.find(p => p.id === w.playerId)?.name ?? w.playerId}: ${w.handName} (+${w.amount})`).join(', ')
    console.log(`  🏆 SHOWDOWN → ${winSummary}`)

    // ── Post-showdown AI reflections (run in parallel, stored privately) ──
    // Reflections are computed and stored in AI memory (feeds into future decisions)
    // but are NOT sent to the client until the game is fully over (prevents human from
    // exploiting AI strategies mid-game).
    const aiPlayers = state.players.filter(p => p.isAI && p.isActive)
    if (aiPlayers.length > 0) {
      console.log(`  💭 AIs reflecting on hand (private — not sent to client)...`)
      const reflectionPromises = aiPlayers.map(p => reflectOnHand(state, p.id))
      Promise.allSettled(reflectionPromises).then(results => {
        const count = results.filter(r => r.status === 'fulfilled' && r.value).length
        if (count > 0) console.log(`  💭 ${count} AI reflection(s) stored in memory`)
      })
    }

    console.log(`  ⏸  Waiting for CONTINUE...`)
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

      // ── Game over: NOW send all accumulated AI reflections to the client ──
      // This is the ONLY time the human sees AI thinking — game is finished, no exploit possible.
      const memories = getGameMemories(gameId)
      if (memories) {
        const payload: AIReflectionPayload = { reflections: [] }
        for (const [playerId, mem] of memories) {
          const player = ended.players.find(p => p.id === playerId)
          if (!player) continue
          for (const r of mem.reflections) {
            payload.reflections.push({
              playerId,
              playerName: player.name,
              roundNumber: r.roundNumber,
              insights: r.insights,
              selfCritique: r.selfCritique,
              // Sanitize opponent reads: use names not IDs, so human can't reverse-engineer
              opponentReads: Object.fromEntries(
                Object.entries(r.opponentReads).map(([oppId, read]) => {
                  const oppName = ended.players.find(p => p.id === oppId)?.name ?? oppId
                  return [oppName, read]
                })
              ),
            })
          }
        }
        if (payload.reflections.length > 0) {
          io.to(gameId).emit('ai_reflections', payload)
          console.log(`  💭 Sent ${payload.reflections.length} total AI reflection(s) to client (game over)`)
        }
      }

      // ── Promote temporary learnings to permanent memory before clearing ──
      const tempMemories = getGameMemories(gameId)
      if (tempMemories) {
        const winner = activePlayers[0]
        for (const [aiPlayerId, aiMem] of tempMemories) {
          const aiPlayer = ended.players.find(p => p.id === aiPlayerId)
          if (!aiPlayer?.model) continue

          // Build opponent list for this AI (everyone except itself)
          const opponents = ended.players
            .filter(p => p.id !== aiPlayerId)
            .map(p => ({
              name: p.name,
              isAI: p.isAI,
              won: winner?.id === p.id,
            }))

          promoteGameLearnings(aiPlayer.model, ended.userId, aiMem, opponents, ended)
        }
      }

      // Clean up temporary game memory
      clearGameMemory(gameId)
      setTimeout(() => deleteGame(gameId), 5 * 60 * 1000)
      console.log(`\n╔════════════════════════════════════════════╗`)
      console.log(`║  GAME OVER: ${gameId} — ${activePlayers[0]?.name ?? 'nobody'} wins!`)
      console.log(`╚════════════════════════════════════════════╝`)
      return
    }

    // Only skip round counter for pure preflop folds (no community cards dealt = no real hand played)
    const wasPreflopFold = (state.winners?.every(w => w.handName === 'Last Standing') ?? false)
                           && state.communityCards.length === 0
    const prevRound = state.roundNumber

    console.log(`  ✅ Round ${prevRound} complete${wasPreflopFold ? ' (preflop fold)' : ''} → next round`)
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

// Periodically clean up unverified users whose tokens have expired
function startUnverifiedUserCleanup() {
  const CLEANUP_INTERVAL = 15 * 60 * 1000  // every 15 minutes
  const run = () => {
    const baseUrl = `http://localhost:3000`
    fetch(`${baseUrl}/api/cron/cleanup-unverified`)
      .then(r => r.json())
      .then(data => {
        if (data.deletedUsers > 0 || data.deletedTokens > 0) {
          console.log(`[cron] ${data.message}`)
        }
      })
      .catch(err => console.error('[cron] cleanup fetch failed:', err.message))
  }
  // First run 1 minute after server starts (wait for Next.js to be ready)
  setTimeout(run, 60_000)
  setInterval(run, CLEANUP_INTERVAL)
}

// ─── Server bootstrap ─────────────────────────────────────────────────────────

app.prepare().then(() => {
  const handle     = app.getRequestHandler()
  const noCachePages = new Set(['/signup', '/login', '/verify'])
  const httpServer = createServer((req, res) => {
    const pathname = (req.url || '').split('?')[0]
    if (noCachePages.has(pathname)) {
      res.setHeader('Cache-Control', 'no-store')
    }
    handle(req, res)
  })

  // Lock CORS to localhost (we run on localhost:3000). Override with
  // ALLOWED_ORIGIN (comma-separated) when deploying to a real domain.
  const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  })

  // ── Socket authentication ────────────────────────────────────────────────
  // The socket triggers paid LLM calls, so every connection must carry a valid
  // NextAuth session cookie. Anonymous connections are rejected at handshake.
  io.use(async (socket, next) => {
    try {
      const session = await getSocketSession(socket.handshake.headers.cookie)
      if (!session) {
        return next(new Error('unauthorized'))
      }
      ;(socket.data as { userId?: string }).userId = session.userId
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  // Track create_game rate per socket: { count, windowStart }
  const createRateMap = new Map<string, { count: number; windowStart: number }>()
  // Track game count per IP
  const gamesPerIp    = new Map<string, Set<string>>()

  startGameReaper()
  startUnverifiedUserCleanup()

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
      const userId = (socket.data as { userId?: string }).userId ?? ''
      const state  = createGame(validated, gameId, userId)
      setGame(gameId, state)

      const playerNames = state.players.map(p => p.name).join(' vs ')
      console.log(`\n╔════════════════════════════════════════════╗`)
      console.log(`║  NEW GAME: ${gameId}`)
      console.log(`║  Players: ${playerNames}`)
      console.log(`║  Stack: ${validated.startingStack} | Blinds: ${validated.smallBlind}/${validated.bigBlind}`)
      console.log(`╚════════════════════════════════════════════╝`)

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

      // Determine effective player ID
      let effectivePlayerId = playerId
      if (playerId) {
        const player = state.players.find(p => p.id === playerId)
        if (!player || player.isAI) {
          // No matching human player — check if this is a watch-only game (all players are AI)
          const hasHuman = state.players.some(p => !p.isAI)
          if (!hasHuman) {
            // Allow joining as spectator
            effectivePlayerId = ''
          } else {
            socket.emit('game_error', 'Cannot join as this player')
            return
          }
        }
      }

      socket.join(gameId)
      ;(socket.data as { playerId?: string; gameId?: string }).playerId = effectivePlayerId
      ;(socket.data as { playerId?: string; gameId?: string }).gameId   = gameId
      socket.emit('game_state', buildClientState(state, effectivePlayerId))
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

      if (next.phase === 'showdown') {
        // Don't broadcast here — handleShowdown broadcasts once WITH winners
        await handleShowdown(gameId, io)
      } else {
        await broadcastGameState(gameId, io, next)
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

    // ── send_chat (human player chat) ──────────────────────────────────────────
    socket.on('send_chat', (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const p = payload as Record<string, unknown>
      if (!isValidGameId(p.gameId) || typeof p.message !== 'string') return

      const gameId  = p.gameId as string
      const message = (p.message as string).slice(0, 120).replace(/[<>"]/g, '')
      if (!message.trim()) return

      const socketData = socket.data as { playerId?: string; gameId?: string }
      if (socketData.gameId !== gameId) return

      const state = getGame(gameId)
      if (!state) return

      const player = state.players.find(pl => pl.id === socketData.playerId)
      if (!player) return

      const chatMsg = {
        playerId: player.id,
        playerName: player.name,
        message,
        ts: Date.now(),
      }
      io.to(gameId).emit('ai_chat', chatMsg)
      addChatMessage(gameId, player.name, message)
      console.log(`[CHAT] 💬 ${player.name}: "${message}"`)
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
