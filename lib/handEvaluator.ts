import type { Card, GameState, WinnerInfo } from '@/types/poker'

export interface HandResult {
  rank:     number    // 1 (Royal Flush) → 10 (High Card) — lower is better
  name:     string
  tiebreak: number[]  // card values for tie-breaking, highest first
}

// Numeric value of a card rank for comparisons
const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

function val(card: Card): number {
  return RANK_VALUE[card.rank]
}

// ─── 5-card hand classifier ───────────────────────────────────────────────────

export function evaluateHand(cards: Card[]): HandResult {
  // cards must be exactly 5
  const values  = cards.map(val).sort((a, b) => b - a)
  const suits   = cards.map(c => c.suit)
  const isFlush = suits.every(s => s === suits[0])

  // Straight detection (handles A-2-3-4-5 low straight)
  const unique  = [...new Set(values)].sort((a, b) => b - a)
  let isStraight = false
  let straightHigh = 0
  if (unique.length === 5 && unique[0] - unique[4] === 4) {
    isStraight = true
    straightHigh = unique[0]
  } else if (
    // Wheel: A-2-3-4-5
    unique.length === 5 &&
    unique[0] === 14 &&
    unique[1] === 5 &&
    unique[2] === 4 &&
    unique[3] === 3 &&
    unique[4] === 2
  ) {
    isStraight  = true
    straightHigh = 5
  }

  // Group by rank count
  const freq: Record<number, number> = {}
  for (const v of values) freq[v] = (freq[v] ?? 0) + 1

  const counts = Object.values(freq).sort((a, b) => b - a)
  // Sorted groups: [value, count] desc by count then value
  const groups = Object.entries(freq)
    .map(([v, c]) => [Number(v), c] as [number, number])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])

  const tiebreakByGroups = groups.flatMap(([v, c]) => Array(c).fill(v))

  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: 1, name: 'Royal Flush', tiebreak: [14] }
  }
  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 2, name: 'Straight Flush', tiebreak: [straightHigh] }
  }
  // Four of a Kind
  if (counts[0] === 4) {
    return { rank: 3, name: 'Four of a Kind', tiebreak: tiebreakByGroups }
  }
  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    return { rank: 4, name: 'Full House', tiebreak: tiebreakByGroups }
  }
  // Flush
  if (isFlush) {
    return { rank: 5, name: 'Flush', tiebreak: values }
  }
  // Straight
  if (isStraight) {
    return { rank: 6, name: 'Straight', tiebreak: [straightHigh] }
  }
  // Three of a Kind
  if (counts[0] === 3) {
    return { rank: 7, name: 'Three of a Kind', tiebreak: tiebreakByGroups }
  }
  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    return { rank: 8, name: 'Two Pair', tiebreak: tiebreakByGroups }
  }
  // Pair
  if (counts[0] === 2) {
    return { rank: 9, name: 'Pair', tiebreak: tiebreakByGroups }
  }
  // High Card
  return { rank: 10, name: 'High Card', tiebreak: values }
}

// ─── Best 5 from 7 ────────────────────────────────────────────────────────────

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function compareHands(a: HandResult, b: HandResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank  // lower rank = better
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const diff = (b.tiebreak[i] ?? 0) - (a.tiebreak[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function getBestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const all   = [...holeCards, ...communityCards]
  const combos = combinations(all, 5)
  let best: HandResult | null = null
  for (const combo of combos) {
    const result = evaluateHand(combo)
    if (!best || compareHands(result, best) < 0) {
      best = result
    }
  }
  return best!
}

// ─── Side pot calculation ────────────────────────────────────────────────────
//
// When players go all-in for different amounts, the pot must be split into
// layers. Each layer (pot) is contested only by players who contributed to it.
//
// Algorithm:
//   1. Collect all players who put chips in (totalBet > 0), including folded ones.
//      Folded players contributed chips but can't win.
//   2. Get unique bet levels sorted ascending.
//   3. For each level, calculate the "layer" each contributor put into that slice.
//   4. Each pot is won by the best hand among ELIGIBLE players (non-folded,
//      contributed at least up to that level).

interface SidePot {
  amount:      number    // total chips in this pot
  eligibleIds: string[]  // player IDs who can win this pot (non-folded, contributed enough)
}

function buildSidePots(state: GameState): SidePot[] {
  // All players who invested chips (including folded — they contributed but can't win)
  const contributors = state.players
    .filter(p => p.isActive && p.totalBet > 0)

  if (contributors.length === 0) return []

  // Unique bet levels, ascending
  const levels = [...new Set(contributors.map(p => p.totalBet))].sort((a, b) => a - b)

  const pots: SidePot[] = []
  let previousLevel = 0

  for (const level of levels) {
    const layerPerPlayer = level - previousLevel
    if (layerPerPlayer <= 0) continue

    // Count how many players contributed at least up to this level
    const contributorsAtThisLevel = contributors.filter(p => p.totalBet >= level)
    const potAmount = layerPerPlayer * contributorsAtThisLevel.length

    // Only non-folded players who bet at least this much can win
    const eligible = contributorsAtThisLevel
      .filter(p => !p.folded)
      .map(p => p.id)

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligibleIds: eligible })
    }

    previousLevel = level
  }

  return pots
}

// ─── Showdown winner determination ───────────────────────────────────────────

export function determineWinners(state: GameState): WinnerInfo[] {
  const contenders = state.players.filter(p => p.isActive && !p.folded)

  // If only one player left (everyone else folded), they win automatically
  // No hand evaluation needed — community cards may not be fully dealt
  if (contenders.length === 1) {
    return [{
      playerId: contenders[0].id,
      handName: 'Last Standing',
      amount:   state.pot,
    }]
  }

  // If no contenders somehow, return empty
  if (contenders.length === 0) return []

  // Evaluate each contender's best hand
  const evaluated = new Map(
    contenders.map(p => [p.id, { player: p, result: getBestHand(p.cards, state.communityCards) }])
  )

  // Build side pots
  const pots = buildSidePots(state)

  // If side pot calculation somehow produces nothing (shouldn't happen),
  // fall back to simple split of the entire pot
  if (pots.length === 0) {
    const best = [...evaluated.values()].reduce((a, b) =>
      compareHands(a.result, b.result) <= 0 ? a : b
    )
    return [{ playerId: best.player.id, handName: best.result.name, amount: state.pot }]
  }

  // For each pot, find the winner(s) among eligible players
  const winnings = new Map<string, { amount: number; handName: string }>()

  for (const pot of pots) {
    // Eligible players who are also contenders (non-folded)
    const eligible = pot.eligibleIds
      .map(id => evaluated.get(id))
      .filter(Boolean) as { player: typeof contenders[0]; result: HandResult }[]

    if (eligible.length === 0) {
      // All eligible players folded (pot goes to remaining contender with best hand)
      // This can happen if a player goes all-in, then folds (impossible in real poker
      // but defensively handled). Give to the overall best hand among all contenders.
      const fallback = [...evaluated.values()].reduce((a, b) =>
        compareHands(a.result, b.result) <= 0 ? a : b
      )
      const prev = winnings.get(fallback.player.id) ?? { amount: 0, handName: fallback.result.name }
      winnings.set(fallback.player.id, { amount: prev.amount + pot.amount, handName: fallback.result.name })
      continue
    }

    // Find the best hand among eligible players for this pot
    let best = eligible[0].result
    for (const e of eligible) {
      if (compareHands(e.result, best) < 0) best = e.result
    }

    // All eligible players who tie for best hand
    const potWinners = eligible.filter(e => compareHands(e.result, best) === 0)
    const share = Math.floor(pot.amount / potWinners.length)
    const remainder = pot.amount - share * potWinners.length

    for (let i = 0; i < potWinners.length; i++) {
      const pw = potWinners[i]
      const prev = winnings.get(pw.player.id) ?? { amount: 0, handName: pw.result.name }
      winnings.set(pw.player.id, {
        amount: prev.amount + share + (i === 0 ? remainder : 0),
        handName: pw.result.name,
      })
    }
  }

  // Convert to WinnerInfo array
  return [...winnings.entries()].map(([playerId, { amount, handName }]) => ({
    playerId,
    handName,
    amount,
  }))
}
