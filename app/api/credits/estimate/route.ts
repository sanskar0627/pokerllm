import { NextResponse } from 'next/server'
import { estimateGameCost, CREDIT_PER_TURN } from '@/lib/pricing'
import type { AIModel } from '@/types/poker'

const VALID_MODELS = new Set(Object.keys(CREDIT_PER_TURN))

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { selectedAIs, rounds } = body

    if (!Array.isArray(selectedAIs) || selectedAIs.length === 0) {
      return NextResponse.json({ error: 'Select at least one AI' }, { status: 400 })
    }

    // Validate models
    const validAIs = selectedAIs.filter((m: string) => VALID_MODELS.has(m)) as AIModel[]
    if (validAIs.length === 0) {
      return NextResponse.json({ error: 'No valid AI models selected' }, { status: 400 })
    }

    const numRounds = Math.max(1, Math.min(100, Math.round(rounds || 10)))
    const estimate = estimateGameCost(validAIs, numRounds)

    return NextResponse.json({
      estimate,
      perRound: estimate / numRounds,
      models: validAIs,
      rounds: numRounds,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
