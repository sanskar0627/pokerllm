import type { AIModel } from '@/types/poker'

/**
 * Credits charged per LLM turn (approximated from real API pricing).
 * 1 credit ≈ $0.001 in API cost.
 */
export const CREDIT_PER_TURN: Record<AIModel, number> = {
  claude:   3,   // Claude Sonnet 4.5 — most expensive
  chatgpt:  2,   // GPT-4o-mini
  gemini:   1,   // Gemini Flash — cheapest
  grok:     2,   // Grok
  deepseek: 1,   // DeepSeek — very cheap
  groq:     1,   // Groq — very cheap / free tier
}

/** Average LLM calls per AI per round (preflop + flop + turn + river, some fold early) */
const AVG_ACTIONS_PER_ROUND = 3

/**
 * Estimate the total credit cost for a game.
 */
export function estimateGameCost(selectedAIs: AIModel[], rounds: number): number {
  const costPerRound = selectedAIs.reduce(
    (sum, model) => sum + CREDIT_PER_TURN[model] * AVG_ACTIONS_PER_ROUND,
    0
  )
  return costPerRound * rounds
}

/**
 * Get the credit cost for a single AI action.
 */
export function getActionCost(model: AIModel): number {
  return CREDIT_PER_TURN[model] ?? 1
}

/**
 * Display name for credit packages.
 */
export const CREDIT_PACKAGES = [
  { credits: 100,  price: 0,     label: 'Starter (Free)',  description: 'Signup bonus' },
  { credits: 500,  price: 4.99,  label: 'Casual',          description: '~25 games' },
  { credits: 1500, price: 9.99,  label: 'Regular',         description: '~75 games' },
  { credits: 5000, price: 24.99, label: 'Pro',             description: '~250 games' },
] as const
