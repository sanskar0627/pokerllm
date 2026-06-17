import { evaluateHand, getBestHand, determineWinners } from '@/lib/handEvaluator'
import { createDeck, shuffleDeck, dealHoleCards, processAction, advancePhase, isBettingRoundOver, rotateBlinds, createGame } from '@/lib/gameEngine'
import type { Card, GameState, Player } from '@/types/poker'

function card(rank: string, suit: string): Card {
  return { rank, suit } as Card
}

let pass = 0
let fail = 0
function assert(condition: boolean, msg: string) {
  if (condition) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ FAIL: ${msg}`) }
}

console.log('\n═══ HAND EVALUATOR TESTS ═══\n')

const rf = evaluateHand([card('A','hearts'), card('K','hearts'), card('Q','hearts'), card('J','hearts'), card('10','hearts')])
assert(rf.rank === 1, `Royal Flush: rank=${rf.rank} name="${rf.name}"`)

const sf = evaluateHand([card('9','clubs'), card('8','clubs'), card('7','clubs'), card('6','clubs'), card('5','clubs')])
assert(sf.rank === 2, `Straight Flush: rank=${sf.rank} name="${sf.name}"`)

const foak = evaluateHand([card('K','hearts'), card('K','diamonds'), card('K','clubs'), card('K','spades'), card('2','hearts')])
assert(foak.rank === 3, `Four of a Kind: rank=${foak.rank} name="${foak.name}"`)

const fh = evaluateHand([card('Q','hearts'), card('Q','diamonds'), card('Q','clubs'), card('J','hearts'), card('J','diamonds')])
assert(fh.rank === 4, `Full House: rank=${fh.rank} name="${fh.name}"`)

const fl = evaluateHand([card('A','spades'), card('J','spades'), card('8','spades'), card('5','spades'), card('3','spades')])
assert(fl.rank === 5, `Flush: rank=${fl.rank} name="${fl.name}"`)

const st = evaluateHand([card('9','hearts'), card('8','diamonds'), card('7','clubs'), card('6','spades'), card('5','hearts')])
assert(st.rank === 6, `Straight: rank=${st.rank} name="${st.name}"`)

const wheel = evaluateHand([card('A','hearts'), card('2','diamonds'), card('3','clubs'), card('4','spades'), card('5','hearts')])
assert(wheel.rank === 6, `Wheel Straight: rank=${wheel.rank} name="${wheel.name}"`)
assert(wheel.tiebreak[0] === 5, `Wheel high=5 (not 14): tiebreak=${wheel.tiebreak}`)

const tok = evaluateHand([card('7','hearts'), card('7','diamonds'), card('7','clubs'), card('K','spades'), card('2','hearts')])
assert(tok.rank === 7, `Three of a Kind: rank=${tok.rank} name="${tok.name}"`)

const tp = evaluateHand([card('J','hearts'), card('J','diamonds'), card('4','clubs'), card('4','spades'), card('A','hearts')])
assert(tp.rank === 8, `Two Pair: rank=${tp.rank} name="${tp.name}"`)

const pair = evaluateHand([card('10','hearts'), card('10','diamonds'), card('K','clubs'), card('8','spades'), card('2','hearts')])
assert(pair.rank === 9, `Pair: rank=${pair.rank} name="${pair.name}"`)

const hc = evaluateHand([card('A','hearts'), card('J','diamonds'), card('8','clubs'), card('5','spades'), card('3','hearts')])
assert(hc.rank === 10, `High Card: rank=${hc.rank} name="${hc.name}"`)

// Tiebreaks
console.log('\n── Tiebreak Tests ──')
const pairK = evaluateHand([card('K','hearts'), card('K','diamonds'), card('Q','clubs'), card('J','spades'), card('2','hearts')])
const pairQ = evaluateHand([card('Q','hearts'), card('Q','clubs'), card('K','clubs'), card('J','spades'), card('2','hearts')])
assert(pairK.rank === pairQ.rank && pairK.tiebreak[0] > pairQ.tiebreak[0], `Pair of Kings beats Pair of Queens`)

// Best 5 from 7
console.log('\n── Best 5 from 7 ──')
const best = getBestHand(
  [card('A','hearts'), card('K','hearts')],
  [card('Q','hearts'), card('J','hearts'), card('10','hearts'), card('2','clubs'), card('3','diamonds')]
)
assert(best.rank === 1, `Royal Flush from 7 cards: rank=${best.rank} name="${best.name}"`)

const best2 = getBestHand(
  [card('K','clubs'), card('K','spades')],
  [card('K','hearts'), card('7','hearts'), card('7','diamonds'), card('2','clubs'), card('3','diamonds')]
)
assert(best2.rank === 4, `Full House KKK77 from 7: rank=${best2.rank} name="${best2.name}"`)

console.log('\n═══ GAME ENGINE TESTS ═══\n')

const deck = createDeck()
assert(deck.length === 52, `Deck has 52 cards: ${deck.length}`)
const shuffled = shuffleDeck(deck)
assert(shuffled.length === 52, `Shuffled deck has 52 cards`)

// Create game
const game = createGame({
  selectedAIs: ['groq' as any],
  humanPlayerName: 'TestHuman',
  startingStack: 5000,
  smallBlind: 25,
  bigBlind: 50,
  watchOnly: false,
}, 'test123')
assert(game.players.length === 2, `2 players created`)
assert(game.phase === 'waiting', `Phase is waiting`)

// Deal hole cards
const dealt = dealHoleCards(game)
assert(dealt.phase === 'preflop', `Phase after deal: ${dealt.phase}`)
assert(dealt.players.every(p => p.cards.length === 2), `Each player has 2 cards`)
assert(dealt.pot === 75, `Pot after blinds: ${dealt.pot}`)
assert(dealt.currentBet === 50, `Current bet = big blind: ${dealt.currentBet}`)

// HEADS-UP BLIND CHECK
console.log('\n── Heads-Up Blind Structure ──')
const huDealer = dealt.dealerIdx
const huSB = dealt.smallBlindIdx
const huBB = dealt.bigBlindIdx
console.log(`  Dealer: seat ${huDealer} (${dealt.players[huDealer].name})`)
console.log(`  SB: seat ${huSB} (${dealt.players[huSB].name})`)  
console.log(`  BB: seat ${huBB} (${dealt.players[huBB].name})`)
console.log(`  First to act: seat ${dealt.currentTurnIdx} (${dealt.players[dealt.currentTurnIdx].name})`)

if (dealt.players.length === 2) {
  // Standard heads-up: Dealer = SB, other = BB
  // Preflop: SB (dealer) acts first
  const dealerIsSB = huDealer === huSB
  assert(dealerIsSB, `Heads-up: Dealer SHOULD be SB. Dealer=${huDealer} SB=${huSB} BB=${huBB}`)
  
  // Preflop first-to-act should be SB (dealer) in heads-up
  assert(dealt.currentTurnIdx === huSB, `Heads-up preflop: SB acts first. currentTurn=${dealt.currentTurnIdx} SB=${huSB}`)
}

// Full play-through: call + check → flop
console.log('\n── Full Street Progression ──')
let s = dealt
let cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'call')
assert(s.phase === 'preflop', `Still preflop after SB calls: ${s.phase}`)

cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'check')
assert(s.phase === 'flop', `Flop after BB checks: ${s.phase}`)
assert(s.communityCards.length === 3, `Flop has 3 community cards`)
assert(s.currentBet === 0, `Bets reset on flop`)

// Check through flop → turn
cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'check')
cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'check')
assert(s.phase === 'turn', `Turn after flop checks: ${s.phase}`)
assert(s.communityCards.length === 4, `Turn has 4 community cards`)

// Check through turn → river
cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'check')
cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'check')
assert(s.phase === 'river', `River: ${s.phase}`)
assert(s.communityCards.length === 5, `River has 5 community cards`)

// Check through river → showdown
cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'check')
cp = s.players[s.currentTurnIdx]
s = processAction(s, cp.id, 'check')
assert(s.phase === 'showdown', `Showdown: ${s.phase}`)

// Winner determination
const winners = determineWinners(s)
assert(winners.length >= 1, `At least 1 winner: ${winners.length}`)
assert(winners.reduce((sum, w) => sum + w.amount, 0) === s.pot, `Winners get entire pot: ${winners.reduce((sum, w) => sum + w.amount, 0)} = ${s.pot}`)

// Fold → immediate showdown
console.log('\n── Fold → Showdown ──')
let foldState = dealHoleCards(game)
cp = foldState.players[foldState.currentTurnIdx]
foldState = processAction(foldState, cp.id, 'fold')
assert(foldState.phase === 'showdown', `Fold in heads-up → showdown`)
const foldWinners = determineWinners(foldState)
assert(foldWinners.length === 1, `One winner after fold`)
assert(foldWinners[0].handName === 'Last Standing', `Winner by fold: "${foldWinners[0].handName}"`)
assert(foldWinners[0].amount === foldState.pot, `Fold winner gets pot: ${foldWinners[0].amount}`)

// Raise mechanics
console.log('\n── Raise Mechanics ──')
let rState = dealHoleCards(createGame({
  selectedAIs: ['groq' as any],
  humanPlayerName: 'Raiser',
  startingStack: 5000,
  smallBlind: 25,
  bigBlind: 50,
  watchOnly: false,
}, 'raise_test'))

let rp = rState.players[rState.currentTurnIdx]
rState = processAction(rState, rp.id, 'raise', 150)
assert(rState.currentBet === 150, `After raise to 150, currentBet=${rState.currentBet}`)
// The other player should need to act now
const otherP = rState.players[rState.currentTurnIdx]
assert(otherP.bet < 150, `Other player hasn't matched: bet=${otherP.bet}`)
assert(!otherP.hasActed, `Other player needs to act: hasActed=${otherP.hasActed}`)

// Rotate blinds
console.log('\n── Rotate Blinds ──')
const rotated = rotateBlinds(dealt)
assert(rotated.roundNumber === dealt.roundNumber + 1, `Round incremented: ${rotated.roundNumber}`)
assert(rotated.pot === 0, `Pot reset`)
assert(rotated.communityCards.length === 0, `Community cards cleared`)
assert(rotated.log.length === 0, `Log cleared`)
assert(rotated.dealerIdx !== dealt.dealerIdx, `Dealer moved`)

// Postflop first-to-act check
console.log('\n── Postflop Action Order ──')
let postflopState = dealt
cp = postflopState.players[postflopState.currentTurnIdx]
postflopState = processAction(postflopState, cp.id, 'call')
cp = postflopState.players[postflopState.currentTurnIdx]
postflopState = processAction(postflopState, cp.id, 'check')
// Now on flop — first to act should be first active after dealer
const flopFirstActor = postflopState.players[postflopState.currentTurnIdx]
console.log(`  Flop first to act: ${flopFirstActor.name} (seat ${postflopState.currentTurnIdx})`)
console.log(`  Dealer: seat ${postflopState.dealerIdx}`)
// Postflop: first to act is player after dealer
assert(postflopState.currentTurnIdx !== postflopState.dealerIdx, `Postflop: non-dealer acts first`)

console.log(`\n═══ RESULTS: ${pass} passed, ${fail} failed ═══\n`)
if (fail > 0) process.exit(1)
