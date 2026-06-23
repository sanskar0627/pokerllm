import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit, clientIpFrom } from '@/lib/rateLimit'

export async function GET(req: Request) {
  try {
    // Rate limit: 20 requests per minute per IP
    // (verify page polls every 3s, so ~20/min is generous for one user
    //  but blocks bulk enumeration)
    const ip = clientIpFrom(req)
    const rl = rateLimit(`check-verified:${ip}`, 20, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { verified: false },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      )
    }

    const url = new URL(req.url)
    const email = url.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ verified: false, error: 'Email required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { emailVerified: true },
    })

    // Return a generic { verified } shape whether or not the user exists.
    // A non-existent account is reported as not verified (no enumeration leak).
    return NextResponse.json({ verified: !!user?.emailVerified })
  } catch (error) {
    console.error('Check-verified error:', error)
    return NextResponse.json({ verified: false }, { status: 500 })
  }
}
