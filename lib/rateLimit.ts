/**
 * Tiny in-memory fixed-window rate limiter.
 *
 * Sufficient for a single long-running server process (we run `bun server.ts`,
 * so API routes and the socket share one process). If this ever runs on
 * multiple instances, swap the Map for Redis.
 */

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

// Opportunistic cleanup so the Map doesn't grow unbounded.
let lastSweep = Date.now()
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

/**
 * @param key      Unique bucket key (e.g. `signup:<ip>` or `login:<email>`).
 * @param limit    Max requests allowed per window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const w = buckets.get(key)
  if (!w || w.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 }
  }

  if (w.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) }
  }

  w.count++
  return { allowed: true, remaining: limit - w.count, retryAfterSec: 0 }
}

/**
 * Best-effort client IP extraction.
 *
 * IMPORTANT: x-forwarded-for and x-real-ip are trivially spoofable unless
 * a trusted reverse proxy (nginx, Cloudflare, etc.) strips and re-sets them.
 * When running behind a proxy, set TRUSTED_PROXY=1 so we read the header.
 * Without the flag, we ignore proxy headers entirely and fall back to a
 * constant (all API-route requests share one bucket, which is still safe
 * for low-volume signup/login rate limits).
 */
export function clientIpFrom(req: Request): string {
  if (process.env.TRUSTED_PROXY === '1') {
    const xff = req.headers.get('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
    return req.headers.get('x-real-ip')?.trim() || 'unknown'
  }
  // No trusted proxy: don't trust any header — use a fixed key.
  // This means rate limits apply globally, which is fine for auth endpoints.
  return 'direct'
}
