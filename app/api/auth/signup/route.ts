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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password and create user
    const passwordHash = await hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        passwordHash,
        credits: 100, // signup bonus
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

    // Log the signup bonus transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: 100,
        type: 'signup_bonus',
        details: 'Welcome bonus — 100 free credits',
      },
    })

    // Send verification email
    const emailResult = await sendVerificationEmail(trimmedEmail, token)
    if (!emailResult.success) {
      console.warn(`[Email] Failed to send verification to ${trimmedEmail}, token: ${token}`)
    }

    return NextResponse.json(
      {
        message: 'Account created. Please check your email to verify.',
        // Include token in dev mode for testing
        ...(process.env.NODE_ENV !== 'production' && { verifyToken: token }),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
