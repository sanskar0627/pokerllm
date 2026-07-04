import type { NextRequest } from 'next/server'

/**
 * CSRF hardening for mutating API routes: on top of SameSite=Lax session
 * cookies, browser-sent requests must originate from our own host.
 * Requests without an Origin header (curl, server-to-server) still require
 * a valid session cookie, which browsers won't attach cross-site.
 *
 * IMPORTANT (proxy-aware): behind Railway/any reverse proxy, `req.nextUrl.host`
 * is the INTERNAL host (e.g. localhost:8080), not the public domain the
 * browser sends in Origin. So we accept the Origin if its host matches ANY
 * trusted identity of this deployment: X-Forwarded-Host, the Host header,
 * nextUrl.host, or the configured public URLs (ALLOWED_ORIGIN / NEXTAUTH_URL /
 * AUTH_URL). Anything else is rejected.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }

  const trusted = new Set<string>()

  // Proxy-forwarded public host (Railway sets this)
  const fwdHost = req.headers.get('x-forwarded-host')
  if (fwdHost) trusted.add(fwdHost.split(',')[0].trim().toLowerCase())

  // Direct Host header + Next's own view of the URL
  const host = req.headers.get('host')
  if (host) trusted.add(host.trim().toLowerCase())
  trusted.add(req.nextUrl.host.toLowerCase())

  // Configured public origins
  for (const envUrl of [process.env.NEXTAUTH_URL, process.env.AUTH_URL]) {
    if (!envUrl) continue
    try { trusted.add(new URL(envUrl).host.toLowerCase()) } catch { /* ignore malformed */ }
  }
  if (process.env.ALLOWED_ORIGIN) {
    for (const o of process.env.ALLOWED_ORIGIN.split(',')) {
      try { trusted.add(new URL(o.trim()).host.toLowerCase()) } catch { /* ignore malformed */ }
    }
  }

  return trusted.has(originHost.toLowerCase())
}
