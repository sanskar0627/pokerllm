import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Aggregate game stats at the DB level instead of loading all records into memory.
  // Groups by userId, counts total games and wins, sums rounds — single query.
  const stats = await prisma.gameRecord.groupBy({
    by: ['userId'],
    _count: { id: true },
    _sum: { rounds: true },
    having: { id: { _count: { gte: 1 } } },
  })

  // Get win counts separately (groupBy can't filter + count conditionally)
  const winCounts = await prisma.gameRecord.groupBy({
    by: ['userId'],
    where: { result: 'win' },
    _count: { id: true },
  })
  const winMap = new Map(winCounts.map(w => [w.userId, w._count.id]))

  // Fetch user info only for the users who have games (max ~50)
  const userIds = stats.map(s => s.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  // Build leaderboard entries
  const leaderboard = stats
    .map(s => {
      const user = userMap.get(s.userId)
      const total = s._count.id
      const wins = winMap.get(s.userId) ?? 0
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

      return {
        userId: s.userId,
        name: user?.name ?? 'Anonymous',
        image: user?.image ?? null,
        totalGames: total,
        wins,
        winRate,
        totalRounds: s._sum.rounds ?? 0,
      }
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.winRate !== a.winRate) return b.winRate - a.winRate
      return b.totalGames - a.totalGames
    })
    .slice(0, 20)

  return NextResponse.json({
    leaderboard,
    currentUserId: session.user.id,
  })
}
