import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, clientIpFrom } from '@/lib/rateLimit'

export async function POST(req: Request) {
  try {
    // Rate limit: 5 signup attempts per IP per 10 minutes.
    const ip = clientIpFrom(req)
    const rl = rateLimit(`signup:${ip}`, 5, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const body = await req.json()
    const { name, email, password } = body

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    const trimmedEmail = email.toLowerCase().trim()
    const trimmedName = name.trim()

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 50 characters' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists — return the SAME generic response
    // regardless of whether the email is taken or new (prevents enumeration).
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    })

    if (existingUser) {
      // Don't reveal that the account exists. Return 200 with generic message.
      return NextResponse.json({
        message: 'If this email is available, a verification link has been sent.',
      })
    }

    // Hash password and create user
    const passwordHash = await hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        passwordHash,
      },
    })

    // Create verification token
    const token = nanoid(32)
    const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    await prisma.verificationToken.create({
      data: {
        identifier: trimmedEmail,
        token,
        expires,
      },
    })

    // Send verification email
    const emailResult = await sendVerificationEmail(trimmedEmail, token)
    if (!emailResult.success) {
      console.warn(`[Email] Failed to send verification to ${trimmedEmail}`)
    }

    return NextResponse.json({
      message: 'If this email is available, a verification link has been sent.',
      // Include token ONLY in explicit development mode for testing.
      // NODE_ENV must be exactly 'development' — unset or 'staging' won't leak tokens.
      ...(process.env.NODE_ENV === 'development' && { verifyToken: token }),
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
