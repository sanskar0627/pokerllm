import { decode } from 'next-auth/jwt'

/**
 * WebSocket authentication helper.
 *
 * The Socket.io server is what actually triggers paid LLM API calls, so it
 * must verify the caller is a logged-in user — the Next.js page middleware
 * only guards the /game *page*, not the socket itself.
 *
 * NextAuth (v5) stores the session as an ENCRYPTED JWT (JWE) in a cookie.
 * The same secret NextAuth uses to encrypt it is AUTH_SECRET ?? NEXTAUTH_SECRET,
 * and the "salt" used for key derivation is the cookie name.
 */

// Matches the cookie names NextAuth uses (http dev vs https prod).
const COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
] as const

const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

/** Minimal cookie-header parser — no external dependency needed. */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(val)
  }
  return out
}

export interface SocketSession {
  userId: string
  /** Display name from the session token (used for spectator chat) */
  userName?: string
}

/**
 * Verify a Socket.io handshake cookie header and return the session, or null.
 * Returns null if no valid, non-expired session token is present.
 */
export async function getSocketSession(
  cookieHeader: string | undefined
): Promise<SocketSession | null> {
  if (!SECRET) {
    // Fail closed: if the server has no secret configured we cannot trust anyone.
    console.error('[socketAuth] No AUTH_SECRET/NEXTAUTH_SECRET set — rejecting socket')
    return null
  }

  const cookies = parseCookies(cookieHeader)

  for (const name of COOKIE_NAMES) {
    const token = cookies[name]
    if (!token) continue
    try {
      const payload = await decode<{ id?: string; sub?: string; name?: string; email?: string }>({
        token,
        secret: SECRET,
        salt: name,
      })
      const userId = payload?.id ?? payload?.sub
      if (userId) {
        const userName = payload?.name ?? payload?.email?.split('@')[0]
        return { userId, userName }
      }
    } catch {
      // try the next cookie name
    }
  }

  return null
}
