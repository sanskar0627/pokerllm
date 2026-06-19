import type { GameState } from '@/types/poker'
import { getRedis, isRedisReady, waitForRedis } from '@/lib/redis'

// ─── In-memory cache (fast synchronous access for game engine) ───────────────
const games = new Map<string, GameState>()

const GAME_PREFIX = 'pokerllm:game:'
const GAME_TTL = 60 * 60 // 1 hour TTL in Redis

// ─── Background persistence (non-blocking) ───────────────────────────────────

function persistToRedis(gameId: string, state: GameState): void {
  const r = getRedis()
  if (!r || !isRedisReady()) return
  try {
    const data = JSON.stringify(state)
    r.setex(`${GAME_PREFIX}${gameId}`, GAME_TTL, data).catch((err) => {
      console.error(`[store] Redis persist failed for ${gameId}:`, err.message)
    })
  } catch (err) {
    console.error(`[store] Redis serialize failed for ${gameId}:`, (err as Error).message)
  }
}

function deleteFromRedis(gameId: string): void {
  const r = getRedis()
  if (!r || !isRedisReady()) return
  r.del(`${GAME_PREFIX}${gameId}`).catch((err) => {
    console.error(`[store] Redis delete failed for ${gameId}:`, err.message)
  })
}

// ─── Persistence control ────────────────────────────────────────────────────
// Full serialization (including handHistory) is expensive. We only persist to
// Redis at key moments:  showdown, game end, every 5th round, or game creation.
// In-memory Map is always the authoritative source during gameplay.

const PERSIST_EVERY_N_ROUNDS = 5
const lastPersistedRound = new Map<string, number>()

function shouldPersist(state: GameState): boolean {
  // Always persist on these phases (data could be lost on crash)
  if (state.phase === 'showdown' || state.phase === 'ended' || state.phase === 'waiting') return true
  // Persist every N rounds
  const lastRound = lastPersistedRound.get(state.id) ?? 0
  if (state.roundNumber - lastRound >= PERSIST_EVERY_N_ROUNDS) return true
  return false
}

// ─── Public API (stays synchronous — no call sites need to change) ───────────

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId)
}

export function setGame(gameId: string, state: GameState): void {
  games.set(gameId, state)
  if (shouldPersist(state)) {
    lastPersistedRound.set(state.id, state.roundNumber)
    persistToRedis(gameId, state)
  }
}

/** Force-persist to Redis regardless of round (call on game creation). */
export function setGameForce(gameId: string, state: GameState): void {
  games.set(gameId, state)
  lastPersistedRound.set(state.id, state.roundNumber)
  persistToRedis(gameId, state)
}

export function deleteGame(gameId: string): void {
  games.delete(gameId)
  lastPersistedRound.delete(gameId)
  deleteFromRedis(gameId)
}

export function getAllGames(): GameState[] {
  return Array.from(games.values())
}

export function gameExists(gameId: string): boolean {
  return games.has(gameId)
}

// ─── Rehydration (call once on server boot) ──────────────────────────────────

export async function rehydrateFromRedis(): Promise<number> {
  const ready = await waitForRedis(3000)
  if (!ready) {
    console.warn('[store] Redis not ready — skipping rehydration')
    return 0
  }

  const r = getRedis()!
  try {
    let restored = 0
    const stream = r.scanStream({ match: `${GAME_PREFIX}*`, count: 100 })

    for await (const keys of stream) {
    for (const key of keys as string[]) {
      try {
        const data = await r.get(key)
        if (!data) continue
        const state: GameState = JSON.parse(data)
        if (Date.now() - state.lastActionAt < GAME_TTL * 1000) {
          games.set(state.id, state)
          restored++
        } else {
          await r.del(key)
        }
      } catch {
        await r.del(key)
      }
    }
    }

    if (restored > 0) {
      console.log(`[store] Rehydrated ${restored} game(s) from Redis`)
    }
    return restored
  } catch (err) {
    console.error('[store] Rehydration failed:', (err as Error).message)
    return 0
  }
}
