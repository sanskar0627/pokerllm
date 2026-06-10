/**
 * Permanent (Long-term) AI Memory — Postgres-backed via Prisma
 *
 * Persists across games and server restarts in Neon Postgres.
 * Each AI model has its own isolated memory per user.
 *
 * Key rules:
 *   - NEVER expose one model's memory to another model
 *   - NEVER expose permanent memory to human players (only injected into AI prompts)
 *   - All memory is scoped by (userId, aiModel) — multi-tenant safe
 *   - All writes are async (non-blocking) — fire and forget from game loop
 */

import { prisma } from '@/lib/db'
import type {
  AIModel,
  AIGameMemory,
  GameState,
  GamePhase,
} from '@/types/poker'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_AI_NOTES_PER_USER   = 50   // per AI model, per user
const MAX_GLOBAL_INSIGHTS     = 100  // per AI model (shared across all users)
const MAX_PATTERNS_PER_PROFILE = 15
const MAX_TRAITS_PER_PROFILE   = 10

// ─── Save an AI-authored note (the AI decides what to remember) ─────────────

export async function saveAINote(
  model: AIModel,
  userId: string,
  text: string,
  category: string,
  gameId: string,
  phase?: GamePhase,
): Promise<void> {
  const trimmed = text.trim().slice(0, 200)
  if (!trimmed || !userId) return

  try {
    // Check for exact duplicate
    const existing = await prisma.aiNote.findFirst({
      where: { aiModel: model, userId, text: trimmed },
    })
    if (existing) {
      console.log(`[PERM-MEM] ⏭️ ${model.toUpperCase()} skipped duplicate note`)
      return
    }

    await prisma.aiNote.create({
      data: {
        aiModel: model,
        userId,
        text: trimmed,
        category,
        gameId,
        phase: phase ?? null,
      },
    })

    // Enforce cap — delete oldest if over limit
    const count = await prisma.aiNote.count({
      where: { aiModel: model, userId },
    })
    if (count > MAX_AI_NOTES_PER_USER) {
      const oldest = await prisma.aiNote.findMany({
        where: { aiModel: model, userId },
        orderBy: { createdAt: 'asc' },
        take: count - MAX_AI_NOTES_PER_USER,
        select: { id: true },
      })
      await prisma.aiNote.deleteMany({
        where: { id: { in: oldest.map(n => n.id) } },
      })
    }

    console.log(`[PERM-MEM] 🧠 ${model.toUpperCase()} saved note [${category}]: "${trimmed.slice(0, 60)}..."`)
  } catch (err) {
    console.error(`[PERM-MEM] ❌ Failed to save AI note:`, (err as Error).message)
  }
}

// ─── Promote game learnings to permanent storage ────────────────────────────

export async function promoteGameLearnings(
  model: AIModel,
  userId: string,
  gameMemory: AIGameMemory,
  opponents: { name: string; isAI: boolean; won: boolean }[],
  gameState: GameState,
): Promise<void> {
  try {
    // ── Update player profiles for each opponent ──────────────────────────
    for (const opp of opponents) {
      if (opp.isAI) continue // Only build profiles for human players

      // Upsert the profile
      const profile = await prisma.aiPlayerProfile.upsert({
        where: {
          userId_aiModel: { userId, aiModel: model },
        },
        create: {
          userId,
          aiModel: model,
          gamesPlayed: 1,
          wins: opp.won ? 1 : 0,
          losses: opp.won ? 0 : 1,
          overallStyle: 'Unknown',
          traits: [],
          patterns: [],
        },
        update: {
          gamesPlayed: { increment: 1 },
          wins: opp.won ? { increment: 1 } : undefined,
          losses: opp.won ? undefined : { increment: 1 },
        },
      })

      // Merge opponent notes from reflections
      const newPatterns = [...profile.patterns]
      const oppNotes = Object.entries(gameMemory.opponentNotes)
      for (const [oppId, notes] of oppNotes) {
        const matchedPlayer = gameState.players.find(p => p.id === oppId)
        if (matchedPlayer && !matchedPlayer.isAI) {
          for (const note of notes) {
            const trimmed = note.trim().slice(0, 120)
            if (trimmed && !newPatterns.includes(trimmed)) {
              newPatterns.push(trimmed)
            }
          }
        }
      }

      // Derive play style from PlayerStats
      const oppPlayer = gameState.players.find(p => !p.isAI)
      let overallStyle = profile.overallStyle
      const newTraits = [...profile.traits]

      if (oppPlayer) {
        const stats = gameState.playerStats[oppPlayer.id]
        if (stats && stats.handsPlayed >= 3) {
          const vpip = Math.round((stats.vpipHands / stats.handsPlayed) * 100)
          const aggFactor = (stats.calls + stats.checks) > 0
            ? stats.raises / (stats.calls + stats.checks)
            : stats.raises > 0 ? 99 : 0

          if (vpip >= 60 && aggFactor >= 1.5)      overallStyle = 'LAG (Loose-Aggressive)'
          else if (vpip >= 60)                       overallStyle = 'Calling Station'
          else if (vpip <= 30 && aggFactor >= 1.5)  overallStyle = 'TAG (Tight-Aggressive)'
          else if (vpip <= 30)                       overallStyle = 'Nit (Tight-Passive)'
          else if (aggFactor >= 2.0)                overallStyle = 'Aggressive'
          else                                       overallStyle = 'Balanced'

          const vpipTrait = `VPIP ${vpip}% over ${stats.handsPlayed} hands`
          const existingVpipIdx = newTraits.findIndex(t => t.startsWith('VPIP'))
          if (existingVpipIdx >= 0) newTraits[existingVpipIdx] = vpipTrait
          else newTraits.push(vpipTrait)
        }
      }

      // Cap arrays
      const cappedPatterns = newPatterns.slice(-MAX_PATTERNS_PER_PROFILE)
      const cappedTraits = newTraits.slice(-MAX_TRAITS_PER_PROFILE)

      await prisma.aiPlayerProfile.update({
        where: { userId_aiModel: { userId, aiModel: model } },
        data: {
          patterns: cappedPatterns,
          traits: cappedTraits,
          overallStyle,
        },
      })
    }

    // ── Promote strategy insights to global memory ─────────────────────────
    for (const insight of gameMemory.strategyNotes) {
      const trimmed = insight.trim().slice(0, 120)
      if (!trimmed) continue

      try {
        await prisma.aiGlobalInsight.create({
          data: { aiModel: model, text: trimmed, source: 'game_learning' },
        })
      } catch {
        // Unique constraint violation = duplicate, skip silently
      }
    }

    // Enforce global insight cap
    const globalCount = await prisma.aiGlobalInsight.count({
      where: { aiModel: model },
    })
    if (globalCount > MAX_GLOBAL_INSIGHTS) {
      const oldest = await prisma.aiGlobalInsight.findMany({
        where: { aiModel: model },
        orderBy: { createdAt: 'asc' },
        take: globalCount - MAX_GLOBAL_INSIGHTS,
        select: { id: true },
      })
      await prisma.aiGlobalInsight.deleteMany({
        where: { id: { in: oldest.map(o => o.id) } },
      })
    }

    console.log(`[PERM-MEM] 🧠 ${model.toUpperCase()} promoted learnings for user ${userId.slice(0, 8)}...`)
  } catch (err) {
    console.error(`[PERM-MEM] ❌ Failed to promote learnings:`, (err as Error).message)
  }
}

// ─── Build prompt section with permanent memory ─────────────────────────────

export async function buildPermanentMemorySection(
  model: AIModel,
  userId: string,
): Promise<string> {
  try {
    const lines: string[] = []

    // ── Per-user opponent profile ──────────────────────────────────────────
    const profile = await prisma.aiPlayerProfile.findUnique({
      where: { userId_aiModel: { userId, aiModel: model } },
    })

    if (profile && profile.gamesPlayed > 0) {
      const winRate = Math.round((profile.wins / profile.gamesPlayed) * 100)
      lines.push(`  This player — seen in ${profile.gamesPlayed} game(s), style: ${profile.overallStyle}, win rate: ${winRate}%`)

      if (profile.patterns.length > 0) {
        const recent = profile.patterns.slice(-4)
        for (const p of recent) lines.push(`    • ${p}`)
      }
      if (profile.traits.length > 0) {
        const recent = profile.traits.slice(-3)
        for (const t of recent) lines.push(`    • ${t}`)
      }
    } else {
      lines.push(`  NEW player — no history yet, observe carefully.`)
    }

    // ── AI-authored personal notes about this user ─────────────────────────
    const notes = await prisma.aiNote.findMany({
      where: { aiModel: model, userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    })

    if (notes.length > 0) {
      lines.push('')
      lines.push('  YOUR SAVED NOTES (written by you in previous games):')

      // Group by category
      const byCategory = new Map<string, string[]>()
      for (const note of notes) {
        if (!byCategory.has(note.category)) byCategory.set(note.category, [])
        byCategory.get(note.category)!.push(note.text)
      }

      for (const [cat, catNotes] of byCategory) {
        const recent = catNotes.slice(0, 4)
        lines.push(`    [${cat.toUpperCase()}]`)
        for (const n of recent) lines.push(`      • ${n}`)
      }
    }

    // ── Global strategy insights (from all games, all users) ───────────────
    const globalInsights = await prisma.aiGlobalInsight.findMany({
      where: { aiModel: model },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    if (globalInsights.length > 0) {
      lines.push('')
      lines.push('  Cross-game strategy learnings:')
      for (const g of globalInsights) lines.push(`    • ${g.text}`)
    }

    if (lines.length === 0) {
      return '  No long-term memories yet — first game with this system.'
    }

    return lines.join('\n')
  } catch (err) {
    console.error(`[PERM-MEM] ❌ Failed to build memory section:`, (err as Error).message)
    return '  No long-term memories yet — memory system unavailable.'
  }
}

// ─── Admin / debug helpers ──────────────────────────────────────────────────

export async function clearPermanentMemory(model: AIModel, userId?: string): Promise<void> {
  if (userId) {
    await prisma.aiPlayerProfile.deleteMany({ where: { aiModel: model, userId } })
    await prisma.aiNote.deleteMany({ where: { aiModel: model, userId } })
    console.log(`[PERM-MEM] 🗑️ Cleared ${model} memory for user ${userId.slice(0, 8)}...`)
  } else {
    await prisma.aiPlayerProfile.deleteMany({ where: { aiModel: model } })
    await prisma.aiNote.deleteMany({ where: { aiModel: model } })
    await prisma.aiGlobalInsight.deleteMany({ where: { aiModel: model } })
    console.log(`[PERM-MEM] 🗑️ Cleared ALL permanent memory for ${model}`)
  }
}

export async function clearAllPermanentMemory(): Promise<void> {
  await prisma.aiPlayerProfile.deleteMany()
  await prisma.aiNote.deleteMany()
  await prisma.aiGlobalInsight.deleteMany()
  console.log(`[PERM-MEM] 🗑️ Cleared ALL permanent memory for ALL models`)
}
