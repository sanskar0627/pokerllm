import type {
  Card, Suit, Rank, GameState, Player, PlayerAction,
  CreateGameOptions, ClientGameState, ClientPlayer, AIModel,
  HandSummary
} from '@/types/poker'
import { getBestHand } from '@/lib/handEvaluator'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** Numeric value for a rank (2=2 … A=14) — used for initial dealer draw */
function rankValue(r: Rank): number {
  if (r === 'A') return 14
  if (r === 'K') return 13
  if (r === 'Q') return 12
  if (r === 'J') return 11
  return parseInt(r, 10)
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// ─── Game creation ───────────────────────────────────────────────────────────

export function createGame(opts: CreateGameOptions, gameId: string, userId: string = ''): GameState {
  const players: Player[] = []
  let seatIndex = 0

  // Add AI players
  for (const model of opts.selectedAIs) {
    players.push({
      id:        model,
      name:      model.charAt(0).toUpperCase() + model.slice(1),
      stack:     opts.startingStack,
      cards:     [],
      bet:       0,
      totalBet:  0,
      folded:    false,
      isAI:      true,
      model:     model as AIModel,
      seatIndex: seatIndex++,
      isActive:  true,
      hasActed:  false,
    })
  }

  // Add human player if not watch-only
  if (!opts.watchOnly && opts.humanPlayerName) {
    players.push({
      id:        `human_${gameId}`,
      name:      opts.humanPlayerName,
      stack:     opts.startingStack,
      cards:     [],
      bet:       0,
      totalBet:  0,
      folded:    false,
      isAI:      false,
      seatIndex: seatIndex++,
      isActive:  true,
      hasActed:  false,
    })
  }

  const now = Date.now()

  // ── Random dealer assignment by card draw ──────────────────────────
  // Deal one card to each player from a shuffled deck. Highest card = dealer.
  const drawDeck = shuffleDeck(createDeck())
  const draws = players.map((p, i) => ({ idx: i, card: drawDeck[i] }))
  // Sort descending by rank value (ties broken by random shuffle order)
  draws.sort((a, b) => rankValue(b.card.rank) - rankValue(a.card.rank))

  const dealerIdx = draws[0].idx                                              // highest card

  // Heads-up (2 players): Dealer = SB, other = BB
  // 3+ players: SB = left of dealer, BB = left of SB
  let smallBlindIdx: number
  let bigBlindIdx: number
  if (players.length === 2) {
    smallBlindIdx = dealerIdx
    bigBlindIdx   = getNextSeatIdx(players, dealerIdx)
  } else {
    smallBlindIdx = getNextSeatIdx(players, dealerIdx)
    bigBlindIdx   = getNextSeatIdx(players, smallBlindIdx)
  }

  // Initialize cumulative stats for all players
  const playerStats: Record<string, import('@/types/poker').PlayerStats> = {}
  for (const p of players) {
    playerStats[p.id] = {
      handsPlayed: 0, vpipHands: 0, folds: 0, calls: 0, raises: 0,
      checks: 0, preflopRaises: 0, showdowns: 0, wins: 0, totalBet: 0,
      foldToRaise: 0, facedRaise: 0,
      // Extended tracking
      startingStack: p.stack,
      stackHistory: [],
      biggestWin: 0,
      biggestLoss: 0,
      currentStreak: 0,
      longestWinStreak: 0,
      longestLoseStreak: 0,
      bluffsDetected: 0,
      bluffAttempts: 0,
      // Phase-specific counts
      preflopFolds: 0, preflopCalls: 0, preflopChecks: 0,
      flopRaises: 0, flopCalls: 0, flopFolds: 0, flopChecks: 0,
      turnRaises: 0, turnCalls: 0, turnFolds: 0, turnChecks: 0,
      riverRaises: 0, riverCalls: 0, riverFolds: 0, riverChecks: 0,
    }
  }

  return {
    id:             gameId,
    userId,
    phase:          'waiting',
    players,
    deck:           shuffleDeck(createDeck()),   // fresh deck (draw deck discarded)
    communityCards: [],
    pot:            0,
    currentBet:     0,
    currentTurnIdx: 0,
    dealerIdx,
    smallBlindIdx,
    bigBlindIdx,
    smallBlind:     opts.smallBlind,
    bigBlind:       opts.bigBlind,
    roundNumber:    1,
    log:            [],
    handHistory:    [],
    playerStats,
    createdAt:      now,
    lastActionAt:   now,
  }
}

/** Simple next-seat helper for initial setup (all players active) */
function getNextSeatIdx(players: Player[], fromIdx: number): number {
  return (fromIdx + 1) % players.length
}

// ─── Deal hole cards + post blinds ───────────────────────────────────────────

export function dealHoleCards(state: GameState): GameState {
  let deck = [...state.deck]
  const players = state.players.map(p => ({ ...p, cards: [] as Card[] }))

  // Deal 2 cards to each active player
  for (let i = 0; i < 2; i++) {
    for (const p of players) {
      if (p.isActive) {
        p.cards = [...p.cards, deck[0]]
        deck = deck.slice(1)
      }
    }
  }

  // Post small blind
  const sbIdx = state.smallBlindIdx
  const bbIdx = state.bigBlindIdx
  const sb = Math.min(state.smallBlind, players[sbIdx].stack)
  const bb = Math.min(state.bigBlind,   players[bbIdx].stack)

  players[sbIdx] = {
    ...players[sbIdx],
    stack:    players[sbIdx].stack - sb,
    bet:      sb,
    totalBet: sb,
  }
  players[bbIdx] = {
    ...players[bbIdx],
    stack:    players[bbIdx].stack - bb,
    bet:      bb,
    totalBet: bb,
  }

  const pot = sb + bb
  const firstTurnIdx = getNextActivePlayerIdx(
    { ...state, players },
    bbIdx
  )

  const now = Date.now()

  return {
    ...state,
    phase:          'preflop',
    players,
    deck,
    pot,
    currentBet:     bb,
    currentTurnIdx: firstTurnIdx,
    lastActionAt:   now,
    log: [
      ...state.log,
      { playerId: players[sbIdx].id, action: 'post_sb' as const, amount: sb, phase: 'preflop', ts: now },
      { playerId: players[bbIdx].id, action: 'post_bb' as const, amount: bb, phase: 'preflop', ts: now },
    ],
  }
}

// ─── Community cards ──────────────────────────────────────────────────────────

export function dealCommunityCards(state: GameState, count: number): GameState {
  const newCards = state.deck.slice(0, count)
  return {
    ...state,
    communityCards: [...state.communityCards, ...newCards],
    deck:           state.deck.slice(count),
  }
}

// ─── Phase advancement ────────────────────────────────────────────────────────

export function advancePhase(state: GameState): GameState {
  const { phase } = state

  // Reset bets and action flags for new street
  const players = state.players.map(p => ({ ...p, bet: 0, hasActed: false }))
  const firstIdx = getNextActivePlayerIdx({ ...state, players }, state.dealerIdx)

  let next = {
    ...state,
    players,
    currentBet:     0,
    currentTurnIdx: firstIdx,
    lastActionAt:   Date.now(),
  }

  if (phase === 'preflop') {
    next = { ...dealCommunityCards(next, 3), phase: 'flop' }
  } else if (phase === 'flop') {
    next = { ...dealCommunityCards(next, 1), phase: 'turn' }
  } else if (phase === 'turn') {
    next = { ...dealCommunityCards(next, 1), phase: 'river' }
  } else if (phase === 'river') {
    next = { ...next, phase: 'showdown' }
  }

  return next
}

// ─── Action processing ────────────────────────────────────────────────────────

export function processAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
  amount?: number
): GameState {
  const playerIdx = state.players.findIndex(p => p.id === playerId)
  if (playerIdx === -1) throw new Error(`Player ${playerId} not found`)
  if (playerIdx !== state.currentTurnIdx) throw new Error(`Not ${playerId}'s turn`)

  const player = state.players[playerIdx]
  let players = [...state.players]
  let pot = state.pot
  let currentBet = state.currentBet
  let chipsMoved = 0
  const now = Date.now()

  if (action === 'fold') {
    players[playerIdx] = { ...player, folded: true, hasActed: true }

  } else if (action === 'check') {
    if (state.currentBet !== player.bet) {
      throw new Error('Cannot check — there is a bet to call')
    }
    players[playerIdx] = { ...player, hasActed: true }

  } else if (action === 'call') {
    const owed = Math.min(currentBet - player.bet, player.stack)
    players[playerIdx] = {
      ...player,
      stack:    player.stack - owed,
      bet:      player.bet + owed,
      totalBet: player.totalBet + owed,
      hasActed: true,
    }
    pot += owed
    chipsMoved = owed

  } else if (action === 'raise') {
    const raiseTotal = amount ?? currentBet * 2

    // ── Validate the raise. A raise MUST exceed the current bet, and the
    //    player must actually commit positive chips. Without this, a client
    //    could send { action:'raise', amount:0 } (or any amount <= their own
    //    bet), making `owed` negative — which would ADD chips to their stack
    //    and corrupt the pot/currentBet. This is the chip-minting exploit.
    if (!Number.isFinite(raiseTotal) || raiseTotal <= currentBet) {
      throw new Error('Raise must be greater than the current bet')
    }
    const owed = Math.min(raiseTotal - player.bet, player.stack)
    if (owed <= 0) {
      throw new Error('Raise must commit additional chips')
    }
    players[playerIdx] = {
      ...player,
      stack:    player.stack - owed,
      bet:      player.bet + owed,
      totalBet: player.totalBet + owed,
      hasActed: true,
    }
    pot += owed
    chipsMoved = owed
    currentBet = players[playerIdx].bet

    // A raise re-opens action for everyone else
    players = players.map((p, i) =>
      i === playerIdx ? p : { ...p, hasActed: p.folded || !p.isActive ? p.hasActed : false }
    )
  }

  // Always log the incremental chips moved (what the player actually put in this action)
  const newLog = [
    ...state.log,
    { playerId, action, amount: chipsMoved, phase: state.phase, ts: now },
  ]

  // Count active (non-folded) players
  const activePlayers = players.filter(p => p.isActive && !p.folded)

  // Only one player left — jump to showdown
  if (activePlayers.length === 1) {
    return {
      ...state,
      players,
      pot,
      currentBet,
      phase:          'showdown',
      currentTurnIdx: players.findIndex(p => p.id === activePlayers[0].id),
      log:            newLog,
      lastActionAt:   now,
    }
  }

  let nextState: GameState = {
    ...state,
    players,
    pot,
    currentBet,
    log:          newLog,
    lastActionAt: now,
  }

  if (isBettingRoundOver(nextState)) {
    nextState = advancePhase(nextState)
  } else {
    nextState = {
      ...nextState,
      currentTurnIdx: getNextActivePlayerIdx(nextState, playerIdx),
    }
  }

  return nextState
}

// ─── Turn helpers ─────────────────────────────────────────────────────────────

export function getNextActivePlayerIdx(state: GameState, fromIdx: number): number {
  const len = state.players.length
  for (let i = 1; i <= len; i++) {
    const idx = (fromIdx + i) % len
    const p = state.players[idx]
    if (p.isActive && !p.folded) return idx
  }
  return fromIdx
}

export function isBettingRoundOver(state: GameState): boolean {
  const active = state.players.filter(p => p.isActive && !p.folded)
  return active.every(p => p.hasActed && (p.bet === state.currentBet || p.stack === 0))
}

// ─── Blind rotation ───────────────────────────────────────────────────────────

export function rotateBlinds(state: GameState): GameState {
  const len = state.players.length

  const nextActive = (from: number) => {
    for (let i = 1; i <= len; i++) {
      const idx = (from + i) % len
      if (state.players[idx].isActive) return idx
    }
    return from
  }

  const dealerIdx = nextActive(state.dealerIdx)

  // Heads-up (2 active): Dealer = SB, other = BB
  // 3+ active: SB = left of dealer, BB = left of SB
  const activeCount = state.players.filter(p => p.isActive).length
  let smallBlindIdx: number
  let bigBlindIdx: number
  if (activeCount === 2) {
    smallBlindIdx = dealerIdx
    bigBlindIdx   = nextActive(dealerIdx)
  } else {
    smallBlindIdx = nextActive(dealerIdx)
    bigBlindIdx   = nextActive(smallBlindIdx)
  }

  // ── Accumulate per-player stats from this hand's log before clearing ──
  const updatedStats = { ...state.playerStats }
  for (const p of state.players) {
    if (!updatedStats[p.id]) {
      updatedStats[p.id] = {
        handsPlayed: 0, vpipHands: 0, folds: 0, calls: 0, raises: 0,
        checks: 0, preflopRaises: 0, showdowns: 0, wins: 0, totalBet: 0,
        foldToRaise: 0, facedRaise: 0,
        startingStack: p.stack, stackHistory: [],
        biggestWin: 0, biggestLoss: 0,
        currentStreak: 0, longestWinStreak: 0, longestLoseStreak: 0,
        bluffsDetected: 0, bluffAttempts: 0,
        preflopFolds: 0, preflopCalls: 0, preflopChecks: 0,
        flopRaises: 0, flopCalls: 0, flopFolds: 0, flopChecks: 0,
        turnRaises: 0, turnCalls: 0, turnFolds: 0, turnChecks: 0,
        riverRaises: 0, riverCalls: 0, riverFolds: 0, riverChecks: 0,
      }
    }
    const s = { ...updatedStats[p.id], stackHistory: [...updatedStats[p.id].stackHistory] }
    if (p.isActive) s.handsPlayed++

    const myActions = state.log.filter(e => e.playerId === p.id)
    const voluntaryActions = myActions.filter(e =>
      e.action !== 'post_sb' && e.action !== 'post_bb'
    )

    for (const a of voluntaryActions) {
      if (a.action === 'fold')  s.folds++
      if (a.action === 'call')  s.calls++
      if (a.action === 'raise') s.raises++
      if (a.action === 'check') s.checks++
      if (a.action === 'raise' && a.phase === 'preflop') s.preflopRaises++
      s.totalBet += a.amount

      // ── Phase-specific action tracking ──
      const phase = a.phase
      if (phase === 'preflop') {
        if (a.action === 'fold')  s.preflopFolds++
        if (a.action === 'call')  s.preflopCalls++
        if (a.action === 'check') s.preflopChecks++
        // preflopRaises already tracked above
      } else if (phase === 'flop') {
        if (a.action === 'raise') s.flopRaises++
        if (a.action === 'call')  s.flopCalls++
        if (a.action === 'fold')  s.flopFolds++
        if (a.action === 'check') s.flopChecks++
      } else if (phase === 'turn') {
        if (a.action === 'raise') s.turnRaises++
        if (a.action === 'call')  s.turnCalls++
        if (a.action === 'fold')  s.turnFolds++
        if (a.action === 'check') s.turnChecks++
      } else if (phase === 'river') {
        if (a.action === 'raise') s.riverRaises++
        if (a.action === 'call')  s.riverCalls++
        if (a.action === 'fold')  s.riverFolds++
        if (a.action === 'check') s.riverChecks++
      }
    }

    // VPIP: did they voluntarily put money in (call or raise, not just blinds)?
    if (voluntaryActions.some(a => a.action === 'call' || a.action === 'raise')) {
      s.vpipHands++
    }

    // Showdown: reached showdown without folding?
    const wentToShowdown = p.isActive && !p.folded && state.phase === 'showdown'
    if (wentToShowdown) {
      s.showdowns++
    }

    // ── Win/loss tracking + streaks ──
    const isWinner = state.winners?.some(w => w.playerId === p.id) ?? false
    if (isWinner) {
      s.wins++
      // Streak: extend win streak or start new one
      s.currentStreak = s.currentStreak > 0 ? s.currentStreak + 1 : 1
      if (s.currentStreak > s.longestWinStreak) s.longestWinStreak = s.currentStreak
    } else if (p.isActive) {
      // Lost or folded this hand
      s.currentStreak = s.currentStreak < 0 ? s.currentStreak - 1 : -1
      if (Math.abs(s.currentStreak) > s.longestLoseStreak) s.longestLoseStreak = Math.abs(s.currentStreak)
    }

    // ── Stack snapshot (round-by-round money record) ──
    if (p.isActive) {
      const winAmount = (state.winners ?? [])
        .filter(w => w.playerId === p.id)
        .reduce((sum, w) => sum + w.amount, 0)
      const chipChange = winAmount - p.totalBet

      // Stack BEFORE this hand = current stack - chipChange (reverse-engineer)
      const stackBefore = p.stack - chipChange
      s.stackHistory.push({
        roundNumber: state.roundNumber,
        stackBefore,
        stackAfter: p.stack,
        chipChange,
      })

      // Biggest win / biggest loss
      if (chipChange > s.biggestWin) s.biggestWin = chipChange
      if (chipChange < s.biggestLoss) s.biggestLoss = chipChange
    }

    // ── Bluff detection from showdown data ──
    if (wentToShowdown && p.cards.length === 2 && state.communityCards.length >= 3) {
      const hadRaise = voluntaryActions.some(a => a.action === 'raise')
      if (hadRaise) {
        s.bluffAttempts++
        // Bluff = raised aggressively but showed weak hand (pair or worse, rank >= 9)
        const best = getBestHand(p.cards, state.communityCards)
        if (best.rank >= 9) s.bluffsDetected++
      }
    }

    // Fold-to-raise tracking: scan log for raise → this player's next action
    for (let i = 0; i < state.log.length; i++) {
      const entry = state.log[i]
      if (entry.action === 'raise' && entry.playerId !== p.id) {
        // Find this player's next action after the raise
        const nextAction = state.log.slice(i + 1).find(e => e.playerId === p.id)
        if (nextAction) {
          s.facedRaise++
          if (nextAction.action === 'fold') s.foldToRaise++
        }
      }
    }

    updatedStats[p.id] = s
  }

  // ── Archive this hand into handHistory before clearing ──
  const playerActions: HandSummary['playerActions'] = {}
  for (const p of state.players) {
    if (!p.isActive) continue
    const myEntries = state.log
      .filter(e => e.playerId === p.id && e.action !== 'post_sb' && e.action !== 'post_bb')
    const wentToShowdown = !p.folded && state.phase === 'showdown'

    // Calculate net chip change for this hand
    const winAmount = (state.winners ?? [])
      .filter(w => w.playerId === p.id)
      .reduce((sum, w) => sum + w.amount, 0)
    const chipChange = winAmount - p.totalBet  // profit = winnings minus investment

    // Evaluate showdown hand if player went to showdown and has cards
    let showdownCards: Card[] | undefined
    let showdownHandName: string | undefined
    let showdownHandRank: number | undefined

    if (wentToShowdown && p.cards.length === 2 && state.communityCards.length >= 3) {
      showdownCards = [...p.cards]
      const best = getBestHand(p.cards, state.communityCards)
      showdownHandName = best.name
      showdownHandRank = best.rank
    }

    playerActions[p.id] = {
      actions: myEntries.map(e => ({ action: e.action, amount: e.amount, phase: e.phase })),
      finalBet: p.totalBet,
      folded: p.folded,
      wentToShowdown,
      showdownCards,
      showdownHandName,
      showdownHandRank,
      chipChange,
    }
  }

  const handSummary: HandSummary = {
    roundNumber:    state.roundNumber,
    winners:        (state.winners ?? []).map(w => ({ playerId: w.playerId, handName: w.handName, amount: w.amount })),
    communityCards: [...state.communityCards],
    pot:            state.pot,
    playerActions,
  }

  const players = state.players.map(p => ({
    ...p,
    bet:      0,
    totalBet: 0,
    folded:   false,
    cards:    [],
    hasActed: false,
  }))

  return {
    ...state,
    players,
    deck:           shuffleDeck(createDeck()),
    communityCards: [],
    pot:            0,
    currentBet:     0,
    currentTurnIdx: 0,
    dealerIdx,
    smallBlindIdx,
    bigBlindIdx,
    roundNumber:    state.roundNumber + 1,
    winners:        undefined,
    log:            [],
    handHistory:    [...state.handHistory, handSummary],
    playerStats:    updatedStats,
    lastActionAt:   Date.now(),
  }
}

// ─── Client state (masks hole cards) ─────────────────────────────────────────

export function buildClientState(
  state: GameState,
  requestingPlayerId: string
): ClientGameState {
  const players: ClientPlayer[] = state.players.map(p => {
    const { cards, ...rest } = p
    // You always see your own cards
    if (p.id === requestingPlayerId) {
      return { ...rest, cards }
    }
    // At showdown, reveal only non-folded players (folded = mucked, hidden per poker rules)
    if (state.phase === 'showdown' && !p.folded) {
      return { ...rest, cards }
    }
    return { ...rest, cards: p.cards.map(() => '??') as '??'[] }
  })

  const { deck: _deck, players: _players, ...rest } = state
  return { ...rest, players } as ClientGameState
}
