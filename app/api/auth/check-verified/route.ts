import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  try {
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
    // Distinguishing "not found" from "unverified" would let anyone probe
    // which emails have accounts (enumeration). A non-existent account is
    // simply reported as not verified.
    return NextResponse.json({ verified: !!user?.emailVerified })
  } catch (error) {
    console.error('Check-verified error:', error)
    return NextResponse.json({ verified: false }, { status: 500 })
  }
}
