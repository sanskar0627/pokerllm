import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Fetch game records + AI profiles in parallel
  const [gameRecords, aiProfiles, user] = await Promise.all([
    prisma.gameRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // last 50 games
    }),
    prisma.aiPlayerProfile.findMany({
      where: { userId },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),
  ])

  // Compute stats
  const totalGames = gameRecords.length
  const wins = gameRecords.filter(g => g.result === 'win').length
  const losses = gameRecords.filter(g => g.result === 'loss').length
  const abandoned = gameRecords.filter(g => g.result === 'abandoned').length
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

  // Count games per AI model
  const aiModelCounts: Record<string, number> = {}
  for (const record of gameRecords) {
    for (const model of record.models) {
      aiModelCounts[model] = (aiModelCounts[model] || 0) + 1
    }
  }

  // Find favorite AI (most played against)
  const favoriteAI = Object.entries(aiModelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Calculate win streak (current and longest)
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  // gameRecords are sorted desc by createdAt
  for (const record of gameRecords) {
    if (record.result === 'win') {
      tempStreak++
      if (tempStreak > longestStreak) longestStreak = tempStreak
    } else {
      tempStreak = 0
    }
  }
  // Current streak = from most recent game backwards
  for (const record of gameRecords) {
    if (record.result === 'win') {
      currentStreak++
    } else {
      break
    }
  }

  // Total rounds played
  const totalRounds = gameRecords.reduce((sum, g) => sum + g.rounds, 0)

  return NextResponse.json({
    user,
    stats: {
      totalGames,
      wins,
      losses,
      abandoned,
      winRate,
      totalRounds,
      currentStreak,
      longestStreak,
      favoriteAI,
      aiModelCounts,
    },
    aiProfiles,
    gameRecords: gameRecords.map(g => ({
      id: g.id,
      gameId: g.gameId,
      models: g.models,
      rounds: g.rounds,
      result: g.result,
      createdAt: g.createdAt,
    })),
  })
}
