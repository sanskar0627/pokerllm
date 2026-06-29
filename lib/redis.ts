import Redis from 'ioredis'

/**
 * Shared Redis client — single connection used by store.ts, llmOrchestrator.ts, etc.
 * Gracefully degrades: if Redis is unavailable, all operations are no-ops.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let redis: Redis | null = null
let redisReady = false

export function getRedis(): Redis | null {
  if (redis) return redis
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
    })
    redis.on('connect', () => {
      redisReady = true
      console.log('[redis] Connected')
    })
    redis.on('error', (err) => {
      console.error('[redis] Error:', err.message)
      redisReady = false
    })
    redis.on('close', () => {
      redisReady = false
    })
    redis.connect().catch(() => {
      console.warn('[redis] Not available — running in-memory only')
    })
    return redis
  } catch {
    console.warn('[redis] Init failed — running in-memory only')
    return null
  }
}

export function isRedisReady(): boolean {
  return redisReady
}

/**
 * Wait for Redis connection (max waitMs). Returns true if connected.
 */
export async function waitForRedis(waitMs = 3000): Promise<boolean> {
  const r = getRedis()
  if (!r) return false
  if (redisReady) return true
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), waitMs)
    r.once('connect', () => { clearTimeout(timeout); resolve(true) })
  })
}
