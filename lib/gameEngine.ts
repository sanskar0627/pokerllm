import type {
  Card, Suit, Rank, GameState, Player, PlayerAction,
  CreateGameOptions, ClientGameState, ClientPlayer, AIModel
} from '@/types/poker'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

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

export function createGame(opts: CreateGameOptions, gameId: string): GameState {
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

  return {
    id:             gameId,
    phase:          'waiting',
    players,
    deck:           shuffleDeck(createDeck()),
    communityCards: [],
    pot:            0,
    currentBet:     0,
    currentTurnIdx: 0,
    dealerIdx:      0,
    smallBlindIdx:  1 % players.length,
    bigBlindIdx:    2 % players.length,
    smallBlind:     opts.smallBlind,
    bigBlind:       opts.bigBlind,
    roundNumber:    1,
    log:            [],
    createdAt:      now,
    lastActionAt:   now,
  }
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
      { playerId: players[sbIdx].id, action: 'post' as const, amount: sb, phase: 'preflop', ts: now },
      { playerId: players[bbIdx].id, action: 'post' as const, amount: bb, phase: 'preflop', ts: now },
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
    const owed = Math.min(raiseTotal - player.bet, player.stack)
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

  const dealerIdx     = nextActive(state.dealerIdx)
  const smallBlindIdx = nextActive(dealerIdx)
  const bigBlindIdx   = nextActive(smallBlindIdx)

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
    if (p.id === requestingPlayerId || state.phase === 'showdown') {
      return { ...rest, cards }
    }
    return { ...rest, cards: p.cards.map(() => '??') as '??'[] }
  })

  const { deck: _deck, players: _players, ...rest } = state
  return { ...rest, players } as ClientGameState
}
