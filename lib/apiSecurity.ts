import type { NextRequest } from 'next/server'

/**
 * CSRF hardening for mutating API routes: on top of SameSite=Lax session
 * cookies, browser-sent requests must originate from our own host.
 * Requests without an Origin header (curl, server-to-server) still require
 * a valid session cookie, which browsers won't attach cross-site.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === req.nextUrl.host
  } catch {
    return false
  }
}
