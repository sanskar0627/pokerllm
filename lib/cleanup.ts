import { prisma } from '@/lib/db'

/**
 * Deletes unverified users whose verification tokens have expired.
 * Called directly from server.ts setInterval — no HTTP self-call needed.
 */
export async function cleanupUnverifiedUsers() {
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
  return { deletedUsers, deletedTokens, message }
}
