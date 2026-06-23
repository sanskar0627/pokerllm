import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit, clientIpFrom } from '@/lib/rateLimit'

export async function GET(req: Request) {
  try {
    // Rate limit: 10 attempts per minute per IP
    const ip = clientIpFrom(req)
    const rl = rateLimit(`verify:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      )
    }

    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: { token },
      })
      return NextResponse.json(
        { error: 'Verification token has expired. Please sign up again.' },
        { status: 400 }
      )
    }

    // Mark user as verified
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    })

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { token },
    })

    return NextResponse.json({ message: 'Email verified successfully' })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
