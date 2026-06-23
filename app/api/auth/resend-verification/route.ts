import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, clientIpFrom } from '@/lib/rateLimit'

export async function POST(req: Request) {
  try {
    // Rate limit per IP first (cheap, before reading body).
    const ip = clientIpFrom(req)
    const ipRl = rateLimit(`resend:ip:${ip}`, 5, 10 * 60 * 1000)
    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipRl.retryAfterSec) } }
      )
    }

    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const trimmedEmail = email.toLowerCase().trim()

    // Per-email limit: stops anyone from email-bombing one address (max 3 / 15 min).
    const emailRl = rateLimit(`resend:email:${trimmedEmail}`, 3, 15 * 60 * 1000)
    if (!emailRl.allowed) {
      // Generic success response — don't reveal anything about the address.
      return NextResponse.json({ message: 'If that email exists, a new verification link has been sent.' })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    })

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json({ message: 'If that email exists, a new verification link has been sent.' })
    }

    if (user.emailVerified) {
      // Don't reveal verification status — return same generic message
      return NextResponse.json({ message: 'If that email exists, a new verification link has been sent.' })
    }

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: trimmedEmail },
    })

    // Create new token
    const token = nanoid(32)
    const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    await prisma.verificationToken.create({
      data: {
        identifier: trimmedEmail,
        token,
        expires,
      },
    })

    // Send new verification email
    const emailResult = await sendVerificationEmail(trimmedEmail, token)
    if (!emailResult.success) {
      console.warn(`[Email] Failed to resend verification to ${trimmedEmail}`)
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Verification email sent!' })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
