import { createServer } from 'http'
import { Server } from 'socket.io'
import next from 'next'
import { nanoid } from 'nanoid'

import { getGame, setGame, setGameForce, deleteGame, getAllGames, rehydrateFromRedis } from '@/lib/store'
import {
  createGame,
  dealHoleCards,
  processAction,
  buildClientState,
  rotateBlinds,
} from '@/lib/gameEngine'
import { determineWinners } from '@/lib/handEvaluator'
import { getAIDecision, logAIConnectionStatus, reflectOnHand, clearGameMemory, getGameMemories, addChatMessage, rehydrateAIMemory, type AIDecisionResult } from '@/lib/llmOrchestrator'
import { promoteGameLearnings } from '@/lib/permanentMemory'
import { getSocketSession } from '@/lib/socketAuth'
import { cleanupUnverifiedUsers } from '@/lib/cleanup'
import { prisma } from '@/lib/db'

import type {
  ServerToClientEvents,
  ClientToServerEvents,
  CreateGameOptions,
  ActionPayload,
  GameState,
  AIModel,
  AIReflectionPayload,
  TurnTimerPayload,
  AIStatusPayload,
  AIThinkingEntry,
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

// ─── Turn timers ─────────────────────────────────────────────────────────────
const HUMAN_TURN_MS     = 120_000     // 2 minutes total for human
const AI_TURN_MS        = 120_000     // 2 minutes total for AI (visual countdown)
const TURN_WARNING_MS   = 10_000      // last 10 seconds = warning phase
const TIMER_TICK_MS     = 1_000       // emit countdown every 1s during warning

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

/** Sanitize human chat messages to prevent LLM prompt injection.
 *  - Strips HTML/script chars
 *  - Truncates to 120 chars
 *  - Replaces injection trigger phrases with harmless text
 *  - Returns null if nothing useful remains */
function sanitizeChatMessage(raw: string): string | null {
  let msg = raw
    .replace(/[^\x20-\x7E]/g, '')  // printable ASCII only
    .replace(/[<>'"`;]/g, '')       // no HTML/script chars
    .trim()
    .slice(0, 120)

  if (msg.length === 0) return null

  // Block/defang prompt injection patterns (case-insensitive)
  const INJECTION_PATTERNS = [
    /ignore\s*(all\s*)?(previous|prior|above|your|system|the)\s*(instructions?|prompts?|rules?|context)/gi,
    /forget\s*(all\s*)?(previous|prior|above|your|system|the)\s*(instructions?|prompts?|rules?|context)/gi,
    /disregard\s*(all\s*)?(previous|prior|above|your|system|the)\s*(instructions?|prompts?|rules?|context)/gi,
    /override\s*(all\s*)?(previous|prior|above|your|system|the)\s*(instructions?|prompts?|rules?|context)/gi,
    /you\s+are\s+(now|a|an)\s/gi,
    /new\s+instructions?\s*:/gi,
    /system\s*prompt/gi,
    /\bact\s+as\b/gi,
    /\brole\s*play\b/gi,
    /always\s+(fold|call|raise|check|go\s+all)/gi,
    /never\s+(fold|call|raise|check|bluff)/gi,
    /you\s+must\s+(fold|call|raise|check|always|never)/gi,
    /\bjailbreak\b/gi,
    /\bDAN\b/g,
    /respond\s+with/gi,
    /output\s+(your|the|all)/gi,
  ]

  for (const pattern of INJECTION_PATTERNS) {
    msg = msg.replace(pattern, '[nice try]')
  }

  if (msg.trim().length === 0) return null
  return msg
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

// ─── Human turn timer management ─────────────────────────────────────────────
// One timer per game. When a human's turn starts, we set a 2-minute deadline.
// During the last 10 seconds, we emit per-second countdown ticks.
// On expiry, the server auto-calls for the player.

interface ActiveTimer {
  gameId:      string
  playerId:    string
  expiresAt:   number
  mainTimer:   ReturnType<typeof setTimeout>    // auto-call at 2min
  warnTimer:   ReturnType<typeof setTimeout>    // starts tick interval at warning
  tickTimer?:  ReturnType<typeof setInterval>   // per-second countdown during warning
}

const turnTimers = new Map<string, ActiveTimer>()

function clearTurnTimer(gameId: string): void {
  const t = turnTimers.get(gameId)
  if (!t) return
  clearTimeout(t.mainTimer)
  clearTimeout(t.warnTimer)
  if (t.tickTimer) clearInterval(t.tickTimer)
  turnTimers.delete(gameId)
}

function startTurnTimer(gameId: string, playerId: string, io: Server): void {
  clearTurnTimer(gameId)

  const expiresAt = Date.now() + HUMAN_TURN_MS

  // Emit initial timer state
  io.to(gameId).emit('turn_timer', {
    playerId,
    totalMs: HUMAN_TURN_MS,
    remainingMs: HUMAN_TURN_MS,
    phase: 'running',
  } as TurnTimerPayload)

  // Warning phase: start 1s ticks during the last 10 seconds
  const warnTimer = setTimeout(() => {
    const tickInterval = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now())
      io.to(gameId).emit('turn_timer', {
        playerId,
        totalMs: HUMAN_TURN_MS,
        remainingMs: remaining,
        phase: remaining <= 0 ? 'expired' : 'warning',
      } as TurnTimerPayload)
      if (remaining <= 0) clearInterval(tickInterval)
    }, TIMER_TICK_MS)

    const existing = turnTimers.get(gameId)
    if (existing) existing.tickTimer = tickInterval
  }, HUMAN_TURN_MS - TURN_WARNING_MS)

  // Main timer: auto-call after full duration
  const mainTimer = setTimeout(async () => {
    clearTurnTimer(gameId)

    await withGameLock(gameId, async () => {
      // Guard: don't auto-act if an AI turn is currently processing
      if (aiTurnActive.has(gameId)) return

      const state = getGame(gameId)
      if (!state || state.phase === 'showdown' || state.phase === 'ended') return

      const currentPlayer = state.players[state.currentTurnIdx]
      if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.isAI) return

      io.to(gameId).emit('turn_timer', {
        playerId, totalMs: HUMAN_TURN_MS, remainingMs: 0, phase: 'expired',
      } as TurnTimerPayload)

      const callAmt = Math.max(0, state.currentBet - currentPlayer.bet)
      const autoAction: 'check' | 'call' = callAmt === 0 ? 'check' : 'call'
      console.log(`[timer] ⏰ ${currentPlayer.name} timed out — auto-${autoAction}`)

      let next: GameState
      try {
        next = processAction(state, playerId, autoAction, 0)
      } catch {
        try { next = processAction(state, playerId, 'fold', 0) }
        catch { return }
      }

      setGame(gameId, next)

      if (next.phase === 'showdown') {
        await handleShowdown(gameId, io)
      } else {
        await broadcastGameState(gameId, io, next)
        await triggerAITurn(gameId, io)
      }
    })
  }, HUMAN_TURN_MS)

  turnTimers.set(gameId, { gameId, playerId, expiresAt, mainTimer, warnTimer })
}

// ─── Persist game result to database ──────────────────────────────────────

async function saveGameRecord(
  state: GameState,
  result: 'win' | 'loss' | 'abandoned',
): Promise<void> {
  try {
    if (!state.userId) return // watch-only or missing userId — skip

    const models = state.players
      .filter(p => p.isAI && p.model)
      .map(p => p.model as string)

    await prisma.gameRecord.create({
      data: {
        userId:  state.userId,
        gameId:  state.id,
        models,
        rounds:  state.roundNumber,
        result,
      },
    })
    console.log(`[db] 💾 Saved GameRecord for ${state.id} — result: ${result}, rounds: ${state.roundNumber}`)
  } catch (err) {
    // Non-fatal: don't crash the game loop over a DB write failure
    console.error(`[db] ❌ Failed to save GameRecord for ${state.id}:`, (err as Error).message)
  }
}

// ─── Game helpers ─────────────────────────────────────────────────────────────

async function broadcastGameState(gameId: string, io: Server, state: GameState): Promise<void> {
  const sockets = await io.in(gameId).fetchSockets()
  for (const socket of sockets) {
    const pid = (socket.data as { playerId?: string }).playerId ?? ''
    socket.emit('game_state', buildClientState(state, pid))
  }
  // Start turn timer if the current turn is a human player
  maybeStartTurnTimer(gameId, state, io)
}

/** Start the turn timer for both human AND AI players. */
function maybeStartTurnTimer(gameId: string, state: GameState, io: Server): void {
  if (state.phase === 'showdown' || state.phase === 'ended' || state.phase === 'waiting') {
    clearTurnTimer(gameId)
    return
  }
  const current = state.players[state.currentTurnIdx]
  if (!current || current.folded || !current.isActive) {
    clearTurnTimer(gameId)
    return
  }
  if (current.isAI) {
    // For AI turns: emit a single timer event so the client can show the countdown.
    // The actual timeout is handled by the API call timeout (120s). No server-side
    // auto-action needed — the AI loop handles failures via try/catch fallback.
    clearTurnTimer(gameId)
    io.to(gameId).emit('turn_timer', {
      playerId: current.id,
      totalMs: AI_TURN_MS,
      remainingMs: AI_TURN_MS,
      phase: 'running',
    } as TurnTimerPayload)
  } else {
    startTurnTimer(gameId, current.id, io)
  }
}

// Guard against concurrent AI turns on the same game
const aiTurnActive = new Set<string>()

// ─── Per-game mutex ──────────────────────────────────────────────────────────
// Prevents race conditions where timer auto-fold, player_action, and AI turns
// can all mutate the same game state concurrently. Only one mutation runs at
// a time per game.
const gameLocks = new Map<string, Promise<void>>()

async function withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing lock on this game to finish
  const existing = gameLocks.get(gameId) ?? Promise.resolve()
  let release: () => void
  const newLock = new Promise<void>(resolve => { release = resolve })
  gameLocks.set(gameId, newLock)

  try {
    await existing
    return await fn()
  } finally {
    release!()
    // Clean up if we're still the latest lock
    if (gameLocks.get(gameId) === newLock) {
      gameLocks.delete(gameId)
    }
  }
}

// Track game count per IP + reverse map for cleanup
const gamesPerIp = new Map<string, Set<string>>()
const gameToIp   = new Map<string, string>()

/** Remove a gameId from IP tracking maps */
function cleanupGameIp(gameId: string): void {
  const ip = gameToIp.get(gameId)
  if (ip) {
    const ipGames = gamesPerIp.get(ip)
    if (ipGames) {
      ipGames.delete(gameId)
      if (ipGames.size === 0) gamesPerIp.delete(ip)
    }
    gameToIp.delete(gameId)
  }
}

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

      const payload: AIDecisionResult = await getAIDecision(state, player.id)

      // ── Emit AI status notification if there was an error/fallback ──
      if (payload._status) {
        io.to(gameId).emit('ai_status', {
          playerId: player.id,
          playerName: player.name,
          type: payload._status.type,
          message: payload._status.message,
          ts: Date.now(),
        } as AIStatusPayload)
      }

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

      // ── Emit AI thinking log (watch mode: shows reasoning panel) ──
      if (payload._thinking && fresh.watchOnly) {
        io.to(gameId).emit('ai_thinking_log', {
          playerId: player.id,
          playerName: player.name,
          model: player.model!,
          action: payload.action,
          amount: payload.amount ?? 0,
          thinking: payload._thinking,
          phase: fresh.phase,
          ts: Date.now(),
        } as AIThinkingEntry)
      }

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
    clearTurnTimer(gameId) // no timer during showdown
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
    //
    // Optimization: only reflect every 3 rounds to reduce API costs (~66% fewer
    // reflection calls). AIs still learn effectively from periodic reflections.
    const REFLECT_EVERY = 3
    const shouldReflect = state.roundNumber % REFLECT_EVERY === 0 || state.roundNumber === 1
    const aiPlayers = state.players.filter(p => p.isAI && p.isActive)
    if (aiPlayers.length > 0 && shouldReflect) {
      console.log(`  💭 AIs reflecting on hand (round ${state.roundNumber}, next reflection in ${REFLECT_EVERY} rounds)...`)
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

      // ── Save game result to database ──
      const humanPlayer = ended.players.find(p => !p.isAI)
      const winner = activePlayers[0]
      if (humanPlayer) {
        const humanWon = winner?.id === humanPlayer.id
        await saveGameRecord(ended, humanWon ? 'win' : 'loss')
      } else {
        // Watch-only game — still save for history
        await saveGameRecord(ended, 'win')
      }

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

      // Clean up temporary game memory + IP tracking
      clearGameMemory(gameId)
      cleanupGameIp(gameId)
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
  setInterval(async () => {
    const now = Date.now()
    for (const state of getAllGames()) {
      if (now - state.lastActionAt > GAME_TTL_MS) {
        // Acquire the per-game lock so we don't race with an in-flight
        // AI turn or player action that's mutating this game.
        await withGameLock(state.id, async () => {
          // Re-check after acquiring lock — the game may have had new
          // activity or been deleted while we were waiting.
          const fresh = getGame(state.id)
          if (!fresh || now - fresh.lastActionAt <= GAME_TTL_MS) return

          saveGameRecord(fresh, 'abandoned')
          cleanupGameIp(fresh.id)
          clearTurnTimer(fresh.id)
          deleteGame(fresh.id)
          console.log(`[reaper] cleaned up stale game ${fresh.id}`)
        })
      }
    }
  }, 5 * 60 * 1000) // run every 5 minutes
}

// Periodically clean up unverified users whose tokens have expired
function startUnverifiedUserCleanup() {
  const CLEANUP_INTERVAL = 15 * 60 * 1000  // every 15 minutes
  const run = async () => {
    try {
      const result = await cleanupUnverifiedUsers()
      if (result.deletedUsers > 0 || result.deletedTokens > 0) {
        console.log(`[cleanup] ${result.message}`)
      }
    } catch (err) {
      console.error('[cleanup] failed:', (err as Error).message)
    }
  }
  // First run 1 minute after server starts
  setTimeout(run, 60_000)
  setInterval(run, CLEANUP_INTERVAL)
}

// ─── Server bootstrap ─────────────────────────────────────────────────────────

app.prepare().then(async () => {
  // Restore any active games + AI memory from Redis (survives server restarts)
  await rehydrateFromRedis()
  await rehydrateAIMemory()

  const handle     = app.getRequestHandler()
  const noCachePages = new Set(['/signup', '/login', '/verify'])
  const httpServer = createServer((req, res) => {
    const pathname = (req.url || '').split('?')[0]
    if (noCachePages.has(pathname)) {
      res.setHeader('Cache-Control', 'no-store')
    }
    // Security headers on every response (belt-and-suspenders with next.config.ts)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    if (!dev) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }
    handle(req, res)
  })

  // CORS: in production, ALLOWED_ORIGIN must be explicitly set.
  // In dev, fall back to localhost.
  if (!dev && !process.env.ALLOWED_ORIGIN) {
    console.error('❌ FATAL: ALLOWED_ORIGIN env var is required in production. Set it to your domain(s), comma-separated.')
    process.exit(1)
  }
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
  startGameReaper()
  startUnverifiedUserCleanup()

  io.on('connection', socket => {
    // Use the direct TCP connection address — x-forwarded-for is trivially
    // spoofable unless a trusted reverse proxy strips and re-sets it.
    // When behind a proxy, set TRUSTED_PROXY=1 to read the header.
    const clientIp = process.env.TRUSTED_PROXY === '1'
      ? ((socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? socket.handshake.address)
      : socket.handshake.address

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
      setGameForce(gameId, state) // always persist on creation

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
      gameToIp.set(gameId, clientIp)

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

      // ★ Verify game ownership — only the user who created the game can join it
      const socketUserId = (socket.data as { userId?: string }).userId
      if (state.userId && socketUserId !== state.userId) {
        socket.emit('game_error', 'Not your game')
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

      await withGameLock(gameId, async () => {
        const state = getGame(gameId)
        if (!state) { socket.emit('game_error', 'Game not found'); return }

        // Prevent acting during an AI turn
        if (aiTurnActive.has(gameId)) {
          socket.emit('game_error', 'AI is still thinking')
          return
        }

        // Human acted — stop their turn timer
        clearTurnTimer(gameId)

        let next: GameState
        try {
          next = processAction(state, playerId, action, Math.floor(amount))
        } catch (err) {
          socket.emit('game_error', (err as Error).message)
          return
        }

        setGame(gameId, next)

        if (next.phase === 'showdown') {
          await handleShowdown(gameId, io)
        } else {
          await broadcastGameState(gameId, io, next)
          await triggerAITurn(gameId, io)
        }
      })
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

      // ★ Verify game ownership — only the user who created the game can advance rounds
      const socketUserId = (socket.data as { userId?: string }).userId
      const state = getGame(gameId)
      if (state?.userId && socketUserId !== state.userId) {
        socket.emit('game_error', 'Not your game')
        return
      }

      // Wrap in mutex — prevents double-click race where two calls both see
      // phase === 'showdown' before either completes. The second call will
      // wait, then find phase !== 'showdown' and exit harmlessly.
      await withGameLock(gameId, async () => {
        await handleNextRound(gameId, io)
      })
    })

    // ── leave_game — user clicked LEAVE, end the game immediately ────────────
    socket.on('leave_game', async (rawGameId: unknown) => {
      if (!isValidGameId(rawGameId)) return
      const gameId = rawGameId as string
      const socketData = socket.data as { playerId?: string; gameId?: string }
      if (socketData.gameId !== gameId) return

      // Verify ownership
      const socketUserId = (socket.data as { userId?: string }).userId
      const state = getGame(gameId)
      if (!state) return
      if (state.userId && socketUserId !== state.userId) return

      await withGameLock(gameId, async () => {
        const fresh = getGame(gameId)
        if (!fresh) return

        // Mark game as ended
        const ended = { ...fresh, phase: 'ended' as const }
        setGame(gameId, ended)

        // Broadcast final state
        await broadcastGameState(gameId, io, ended)

        // Save game record
        const humanPlayer = ended.players.find(p => !p.isAI)
        if (humanPlayer) {
          await saveGameRecord(ended, 'abandoned')
        } else {
          await saveGameRecord(ended, 'abandoned')
        }

        // Stop AI turns, timers, clean up
        aiTurnActive.delete(gameId)
        clearTurnTimer(gameId)
        clearGameMemory(gameId)
        cleanupGameIp(gameId)

        // Remove everyone from the socket room
        const room = io.sockets.adapter.rooms.get(gameId)
        if (room) {
          for (const sid of room) {
            io.sockets.sockets.get(sid)?.leave(gameId)
          }
        }

        // Delete game after short delay (allow final state to be received)
        setTimeout(() => deleteGame(gameId), 5000)
        console.log(`[game] Player left — ended game ${gameId}`)
      })
    })

    // ── send_chat (human player chat) ──────────────────────────────────────────
    socket.on('send_chat', (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const p = payload as Record<string, unknown>
      if (!isValidGameId(p.gameId) || typeof p.message !== 'string') return

      const gameId  = p.gameId as string
      const message = sanitizeChatMessage((p.message as string))
      if (!message) return

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
      const socketData = socket.data as { playerId?: string; gameId?: string }
      const disconnectedGameId = socketData.gameId

      if (disconnectedGameId) {
        // Pause the game: clear turn timer and mark AI turns as inactive
        // so the game doesn't silently continue without the human watching
        clearTurnTimer(disconnectedGameId)

        // Check if this was the last socket in the room
        const room = io.sockets.adapter.rooms.get(disconnectedGameId)
        if (!room || room.size === 0) {
          // No one left watching — pause AI turns by removing the game from active set
          // (triggerAITurn checks this set, so removing it stops the loop)
          aiTurnActive.delete(disconnectedGameId)
          console.log(`[socket] all players left game ${disconnectedGameId} — paused`)
        }
      }

      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(3000, () => {
    console.log('PokerLLM running on http://localhost:3000')
  })

  // ─── Graceful shutdown ─────────────────────────────────────────────────────
  // On SIGTERM/SIGINT: persist games, then exit immediately.
  // In dev mode we skip the AI-turn wait entirely — fast restarts matter more.

  let shuttingDown = false

  async function gracefulShutdown(signal: string) {
    if (shuttingDown) {
      // Second Ctrl+C → force exit immediately
      console.log('\n[shutdown] Forced exit.')
      process.exit(1)
    }
    shuttingDown = true
    console.log(`\n[shutdown] ${signal} received — shutting down...`)

    // 1. Clear all turn timers immediately
    for (const gameId of turnTimers.keys()) {
      clearTurnTimer(gameId)
    }
    aiTurnActive.clear()

    // 2. Force-persist all active games to Redis (best-effort, 3s max)
    try {
      const games = getAllGames()
      await Promise.race([
        Promise.all(games.map(s => setGameForce(s.id, s))),
        new Promise(r => setTimeout(r, 3000)),
      ])
      console.log(`[shutdown] Persisted ${games.length} game(s)`)
    } catch {
      console.warn('[shutdown] Redis persist failed — continuing exit')
    }

    // 3. Exit immediately — don't wait for io.close()/httpServer.close()
    //    which can hang on open WebSocket connections
    console.log('[shutdown] Goodbye.')
    process.exit(0)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'))
})
