/**
 * Side pot calculation tests.
 * Run: npx tsx lib/__tests__/sidePots.test.ts
 */

import { determineWinners } from '../handEvaluator'
import type { GameState, Player, Card } from '../../types/poker'

// Helper: build a minimal GameState for testing showdown
function makeState(players: Partial<Player>[], communityCards: Card[], pot: number): GameState {
  return {
    id: 'test',
    phase: 'showdown',
    players: players.map((p, i) => ({
      id: p.id ?? `p${i}`,
      name: p.name ?? `Player${i}`,
      stack: p.stack ?? 0,
      cards: p.cards ?? [],
      bet: 0,
      totalBet: p.totalBet ?? 0,
      folded: p.folded ?? false,
      isAI: false,
      seatIndex: i,
      isActive: p.isActive ?? true,
      hasActed: true,
    })) as Player[],
    deck: [],
    communityCards,
    pot,
    currentBet: 0,
    currentTurnIdx: 0,
    dealerIdx: 0,
    smallBlindIdx: 1,
    bigBlindIdx: 2,
    smallBlind: 50,
    bigBlind: 100,
    roundNumber: 1,
    log: [],
    createdAt: Date.now(),
    lastActionAt: Date.now(),
    handHistory: [],
    playerStats: {},
  } as unknown as GameState
}

// Board that doesn't accidentally create straights/flushes for test hands
const BOARD: Card[] = [
  { rank: '2', suit: 'hearts' },
  { rank: '5', suit: 'diamonds' },
  { rank: '9', suit: 'clubs' },
  { rank: 'J', suit: 'spades' },
  { rank: 'K', suit: 'hearts' },
]

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    console.log(`  ❌ FAIL: ${msg}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Test 1: 2 Players, No Side Pot ═══')
// Both bet 1000 each. Total pot = 2000. Winner gets all.
{
  const state = makeState([
    { id: 'A', cards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'diamonds' }], totalBet: 1000, stack: 0 },
    { id: 'B', cards: [{ rank: '4', suit: 'clubs' }, { rank: '3', suit: 'clubs' }], totalBet: 1000, stack: 0 },
  ], BOARD, 2000)

  const result = determineWinners(state)
  assert(result.length === 1, 'One winner')
  assert(result[0].playerId === 'A', 'Player A wins (better hand)')
  assert(result[0].amount === 2000, `Winner gets full pot 2000 (got ${result[0].amount})`)
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Test 2: 3 Players, 1 All-In Short Stack ═══')
// Player A: all-in 500, Player B: bet 2000, Player C: bet 2000
// Total pot = 4500
// Main pot = 500 × 3 = 1500 (A, B, C eligible)
// Side pot = 1500 × 2 = 3000 (B, C only)
// Player A has best hand (pair of aces) → wins main pot only
// Player B has pair of queens → wins side pot
{
  const state = makeState([
    { id: 'A', cards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'diamonds' }], totalBet: 500, stack: 0 },
    { id: 'B', cards: [{ rank: 'Q', suit: 'clubs' }, { rank: 'Q', suit: 'spades' }], totalBet: 2000, stack: 3000 },
    { id: 'C', cards: [{ rank: '4', suit: 'clubs' }, { rank: '3', suit: 'clubs' }], totalBet: 2000, stack: 3000 },
  ], BOARD, 4500)

  const result = determineWinners(state)
  const aWin = result.find(w => w.playerId === 'A')
  const bWin = result.find(w => w.playerId === 'B')
  const cWin = result.find(w => w.playerId === 'C')

  assert(aWin != null, 'Player A wins something')
  assert(aWin?.amount === 1500, `Player A gets main pot 1500 (got ${aWin?.amount})`)
  assert(bWin != null, 'Player B wins side pot')
  assert(bWin?.amount === 3000, `Player B gets side pot 3000 (got ${bWin?.amount})`)
  assert(cWin == null, 'Player C wins nothing')

  const totalDistributed = result.reduce((sum, w) => sum + w.amount, 0)
  assert(totalDistributed === 4500, `Total distributed equals pot: ${totalDistributed} === 4500`)
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Test 3: 3 Players, 2 All-Ins at Different Levels ═══')
// Player A: all-in 300, Player B: all-in 800, Player C: bet 800
// Total pot = 1900
// Main pot = 300 × 3 = 900 (A, B, C)
// Side pot = 500 × 2 = 1000 (B, C)
// Player A has pair of aces (best), B has pair of queens (second), C has nothing
{
  const state = makeState([
    { id: 'A', cards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'clubs' }], totalBet: 300, stack: 0 },
    { id: 'B', cards: [{ rank: 'Q', suit: 'diamonds' }, { rank: 'Q', suit: 'clubs' }], totalBet: 800, stack: 0 },
    { id: 'C', cards: [{ rank: '3', suit: 'diamonds' }, { rank: '4', suit: 'clubs' }], totalBet: 800, stack: 4200 },
  ], BOARD, 1900)

  const result = determineWinners(state)
  const aWin = result.find(w => w.playerId === 'A')
  const bWin = result.find(w => w.playerId === 'B')
  const cWin = result.find(w => w.playerId === 'C')

  assert(aWin?.amount === 900, `A gets main pot 900 (got ${aWin?.amount})`)
  assert(bWin?.amount === 1000, `B gets side pot 1000 (got ${bWin?.amount})`)
  assert(cWin == null, 'C wins nothing')

  const totalDistributed = result.reduce((sum, w) => sum + w.amount, 0)
  assert(totalDistributed === 1900, `Total distributed equals pot: ${totalDistributed} === 1900`)
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Test 4: Player Folds But Contributed Chips ═══')
// Player A: bet 500, FOLDED. Player B: bet 1000. Player C: bet 1000.
// Total pot = 2500
// Main pot = 500 × 3 = 1500 (B, C eligible — A folded)
// Side pot = 500 × 2 = 1000 (B, C)
// Player C has pair of aces (best among non-folded)
{
  const state = makeState([
    { id: 'A', cards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'clubs' }], totalBet: 500, stack: 500, folded: true },
    { id: 'B', cards: [{ rank: '3', suit: 'diamonds' }, { rank: '4', suit: 'clubs' }], totalBet: 1000, stack: 4000 },
    { id: 'C', cards: [{ rank: 'Q', suit: 'diamonds' }, { rank: 'Q', suit: 'clubs' }], totalBet: 1000, stack: 4000 },
  ], BOARD, 2500)

  const result = determineWinners(state)
  const aWin = result.find(w => w.playerId === 'A')
  const cWin = result.find(w => w.playerId === 'C')

  assert(aWin == null, 'Folded player A wins nothing')
  assert(cWin?.amount === 2500, `C gets entire pot 2500 (got ${cWin?.amount})`)
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Test 5: Split Pot (Tie) Within a Side Pot ═══')
// Player A: all-in 500. Player B: bet 1500. Player C: bet 1500.
// B and C have identical hands (same rank cards, different suits)
// Main pot = 500 × 3 = 1500 → A wins (pair of aces, best hand)
// Side pot = 1000 × 2 = 2000 → B and C split (tied with pair of 10s)
{
  const state = makeState([
    { id: 'A', cards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'diamonds' }], totalBet: 500, stack: 0 },
    { id: 'B', cards: [{ rank: '10', suit: 'hearts' }, { rank: '10', suit: 'clubs' }], totalBet: 1500, stack: 3500 },
    { id: 'C', cards: [{ rank: '10', suit: 'diamonds' }, { rank: '10', suit: 'spades' }], totalBet: 1500, stack: 3500 },
  ], BOARD, 3500)

  const result = determineWinners(state)
  const aWin = result.find(w => w.playerId === 'A')
  const bWin = result.find(w => w.playerId === 'B')
  const cWin = result.find(w => w.playerId === 'C')

  assert(aWin?.amount === 1500, `A gets main pot 1500 (got ${aWin?.amount})`)
  assert(bWin?.amount === 1000, `B gets half side pot 1000 (got ${bWin?.amount})`)
  assert(cWin?.amount === 1000, `C gets half side pot 1000 (got ${cWin?.amount})`)

  const totalDistributed = result.reduce((sum, w) => sum + w.amount, 0)
  assert(totalDistributed === 3500, `Total distributed equals pot: ${totalDistributed} === 3500`)
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Test 6: Everyone Folds Except One (No Showdown) ═══')
// Only one contender left. They get the full pot.
{
  const state = makeState([
    { id: 'A', cards: [{ rank: '2', suit: 'spades' }, { rank: '3', suit: 'spades' }], totalBet: 500, folded: true },
    { id: 'B', cards: [{ rank: '4', suit: 'clubs' }, { rank: '5', suit: 'clubs' }], totalBet: 500, folded: true },
    { id: 'C', cards: [{ rank: '7', suit: 'hearts' }, { rank: '8', suit: 'hearts' }], totalBet: 500, stack: 500 },
  ], BOARD, 1500)

  const result = determineWinners(state)
  assert(result.length === 1, 'One winner')
  assert(result[0].playerId === 'C', 'Last standing wins')
  assert(result[0].amount === 1500, `Gets full pot 1500 (got ${result[0].amount})`)
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Test 7: 4 Players, 2 All-Ins + 2 Active ═══')
// A: all-in 200, B: all-in 600, C: bet 1500, D: bet 1500
// Total pot = 3800
// Main pot  = 200 × 4 = 800  (A, B, C, D)
// Side 1    = 400 × 3 = 1200 (B, C, D)  — 600-200=400 per player, 3 contributed
// Side 2    = 900 × 2 = 1800 (C, D)     — 1500-600=900, only C and D
// A has pair of aces (best), D has pair of queens (second best), B and C have trash
{
  const state = makeState([
    { id: 'A', cards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'clubs' }], totalBet: 200, stack: 0 },
    { id: 'B', cards: [{ rank: '3', suit: 'diamonds' }, { rank: '4', suit: 'clubs' }], totalBet: 600, stack: 0 },
    { id: 'C', cards: [{ rank: '6', suit: 'diamonds' }, { rank: '7', suit: 'diamonds' }], totalBet: 1500, stack: 3500 },
    { id: 'D', cards: [{ rank: 'Q', suit: 'diamonds' }, { rank: 'Q', suit: 'clubs' }], totalBet: 1500, stack: 3500 },
  ], BOARD, 3800)

  const result = determineWinners(state)
  const aWin = result.find(w => w.playerId === 'A')
  const bWin = result.find(w => w.playerId === 'B')
  const dWin = result.find(w => w.playerId === 'D')

  assert(aWin?.amount === 800, `A gets main pot 800 (got ${aWin?.amount})`)
  assert(bWin == null, 'B wins nothing (worst hand)')
  assert(dWin?.amount === 1200 + 1800, `D gets side1 + side2 = 3000 (got ${dWin?.amount})`)

  const totalDistributed = result.reduce((sum, w) => sum + w.amount, 0)
  assert(totalDistributed === 3800, `Total distributed equals pot: ${totalDistributed} === 3800`)
}

// ──────────────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
else console.log('All tests passed! ✅')
