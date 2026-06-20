import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_PATTERNS = [
  /^\/api\/profile/,       // profile data + leaderboard
  /^\/game\//,             // game pages
]

// Public API routes that should never be blocked
const PUBLIC_PATTERNS = [
  /^\/api\/auth\//,        // NextAuth + signup + verify + check-verified + resend
  /^\/api\/cron\//,        // cron cleanup (has its own CRON_SECRET check)
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PATTERNS.some(p => p.test(pathname))
  const isPublic = PUBLIC_PATTERNS.some(p => p.test(pathname))

  if (isProtected && !isPublic) {
    // Check for session token (covers both secure and non-secure cookie names)
    const token =
      request.cookies.get('authjs.session-token')?.value ||
      request.cookies.get('__Secure-authjs.session-token')?.value

    if (!token) {
      // API routes return 401; pages redirect to login
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/game/:path*',
  ],
}
