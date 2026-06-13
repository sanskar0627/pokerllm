import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cleanup cron job — deletes unverified users whose verification tokens have expired.
 *
 * Should run every 15 minutes.
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * What it does:
 * 1. Finds all expired verification tokens
 * 2. For each, checks if the user is still unverified
 * 3. Deletes the unverified user (cascade deletes transactions, accounts, etc.)
 * 4. Deletes the expired token
 */
export async function GET(req: Request) {
  // Auth check — either via CRON_SECRET header or skip in dev
  const authHeader = req.headers.get('authorization')
  if (process.env.NODE_ENV === 'production') {
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const now = new Date()

    // Find all expired verification tokens
    const expiredTokens = await prisma.verificationToken.findMany({
      where: {
        expires: { lt: now },
      },
    })

    let deletedUsers = 0
    let deletedTokens = 0

    for (const token of expiredTokens) {
      // Find the user by email (identifier)
      const user = await prisma.user.findUnique({
        where: { email: token.identifier },
      })

      // Delete user only if they exist AND are still unverified
      if (user && !user.emailVerified) {
        await prisma.user.delete({
          where: { id: user.id },
        })
        deletedUsers++
      }

      // Always clean up the expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: token.identifier,
            token: token.token,
          },
        },
      })
      deletedTokens++
    }

    const message = `Cleanup complete: ${deletedUsers} unverified user(s) removed, ${deletedTokens} expired token(s) deleted.`
    console.log(`[Cron] ${message}`)

    return NextResponse.json({
      success: true,
      deletedUsers,
      deletedTokens,
      message,
    })
  } catch (error) {
    console.error('[Cron] Cleanup error:', error)
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}
