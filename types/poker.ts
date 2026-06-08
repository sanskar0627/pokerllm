export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

export type GamePhase =
  | 'waiting'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'ended'

export type PlayerAction = 'fold' | 'call' | 'raise' | 'check'

export type AIModel =
  | 'claude'
  | 'chatgpt'
  | 'gemini'
  | 'grok'
  | 'deepseek'
  | 'groq'

export interface Player {
  id:        string
  name:      string
  stack:     number
  cards:     Card[]
  bet:       number
  totalBet:  number
  folded:    boolean
  isAI:      boolean
  model?:    AIModel
  seatIndex: number
  isActive:  boolean
  hasActed:  boolean
}

export interface ActionLog {
  playerId: string
  action:   PlayerAction | 'post_sb' | 'post_bb'   // blind posting
  amount:   number
  phase:    GamePhase
  ts:       number
}

// Summary of a completed hand — stored permanently for AI analysis
export interface HandSummary {
  roundNumber:    number
  winners:        { playerId: string; handName: string; amount: number }[]
  communityCards: Card[]
  pot:            number
  playerActions:  Record<string, {  // keyed by playerId
    actions: { action: string; amount: number; phase: string }[]
    finalBet: number
    folded:   boolean
    wentToShowdown: boolean
    // Showdown data — only set if wentToShowdown is true
    showdownCards?: Card[]      // the hole cards they revealed
    showdownHandName?: string   // e.g. "Two Pair", "Flush"
    showdownHandRank?: number   // 1 (Royal Flush) to 10 (High Card)
    chipChange?: number         // net chips won/lost this hand (positive = profit)
  }>
}

// Round-by-round stack record — tracks how each player's chips change over time
export interface StackSnapshot {
  roundNumber:  number
  stackBefore:  number    // chips at start of this round
  stackAfter:   number    // chips at end of this round
  chipChange:   number    // net change this round
}

// Cumulative per-player stats that persist across hands
export interface PlayerStats {
  handsPlayed:   number
  vpipHands:     number   // hands where player voluntarily put chips in (not just blinds)
  folds:         number
  calls:         number
  raises:        number
  checks:        number
  preflopRaises: number   // PFR — preflop raise count
  showdowns:     number
  wins:          number
  totalBet:      number   // total chips wagered across all hands
  foldToRaise:   number   // times folded after facing a raise
  facedRaise:    number   // times faced a raise (for fold-to-raise %)
  // ── Extended tracking (full opponent dossier) ──
  startingStack:   number            // chips at game start (baseline)
  stackHistory:    StackSnapshot[]   // round-by-round chip record
  biggestWin:      number            // largest single-hand profit
  biggestLoss:     number            // largest single-hand loss (stored as negative)
  currentStreak:   number            // positive = consecutive wins, negative = consecutive losses
  longestWinStreak:  number          // best winning streak this game
  longestLoseStreak: number          // worst losing streak this game
  bluffsDetected:  number            // raised aggressively + showed weak hand at showdown
  bluffAttempts:   number            // total aggressive showdowns (denominator for bluff rate)
  // Phase-specific action counts (preflop vs postflop behavior)
  preflopFolds:   number
  preflopCalls:   number
  preflopChecks:  number
  flopRaises:     number
  flopCalls:      number
  flopFolds:      number
  flopChecks:     number
  turnRaises:     number
  turnCalls:      number
  turnFolds:      number
  turnChecks:     number
  riverRaises:    number
  riverCalls:     number
  riverFolds:     number
  riverChecks:    number
}

export interface GameState {
  id:             string
  userId:         string              // authenticated user who created this game (for AI memory scoping)
  phase:          GamePhase
  players:        Player[]
  deck:           Card[]
  communityCards: Card[]
  pot:            number
  currentBet:     number
  currentTurnIdx: number
  dealerIdx:      number
  smallBlindIdx:  number
  bigBlindIdx:    number
  smallBlind:     number
  bigBlind:       number
  roundNumber:    number
  winners?:       WinnerInfo[]
  log:            ActionLog[]
  handHistory:    HandSummary[]                // complete history of every past hand
  playerStats:    Record<string, PlayerStats>  // cumulative stats across all hands
  createdAt:      number
  lastActionAt:   number
}

export interface WinnerInfo {
  playerId: string
  handName: string
  amount:   number
}

export interface CreateGameOptions {
  humanPlayerName?: string
  selectedAIs:      AIModel[]
  startingStack:    number
  smallBlind:       number
  bigBlind:         number
  watchOnly:        boolean
}

export type ClientPlayer = Omit<Player, 'cards'> & {
  cards: Card[] | '??'[]
}

export type ClientGameState = Omit<GameState, 'deck'> & {
  players: ClientPlayer[]
}

// AI table talk — trash talk, bluffs, compliments, teasing between players
export interface AIChatMessage {
  playerId:   string      // who said it
  playerName: string      // display name
  message:    string      // the chat message
  ts:         number      // timestamp
}

export interface ServerToClientEvents {
  game_state:      (state: ClientGameState) => void
  game_created:    (gameId: string) => void
  game_error:      (msg: string) => void
  llm_thinking:    (playerId: string) => void
  game_over:       (winners: WinnerInfo[]) => void
  ai_reflections:  (payload: AIReflectionPayload) => void
  ai_chat:         (msg: AIChatMessage) => void
}

export interface ClientToServerEvents {
  join_game:     (gameId: string, playerId: string) => void
  player_action: (payload: ActionPayload) => void
  create_game:   (opts: CreateGameOptions) => void
  next_round:    (gameId: string) => void
  send_chat:     (payload: { gameId: string; message: string }) => void
}

export interface ActionPayload {
  gameId:   string
  playerId: string
  action:   PlayerAction
  amount?:  number
  chat?:    string          // optional table talk from AI
}

// ─── AI Memory & Thinking System ─────────────────────────────────────────────

/** A single thought captured during an AI decision */
export interface AIThought {
  roundNumber: number
  phase:       GamePhase
  thinking:    string        // the AI's reasoning for this action
  action:      PlayerAction
  amount:      number
}

/** Post-showdown reflection — what the AI learned from a completed hand */
export interface AIReflection {
  roundNumber:    number
  insights:       string[]     // key takeaways from this hand
  opponentReads:  Record<string, string>  // playerId → observation
  selfCritique:   string       // what the AI would do differently
}

/** Per-game memory for a single AI player */
export interface AIGameMemory {
  thoughts:       AIThought[]       // decision log across all rounds
  reflections:    AIReflection[]    // post-hand analyses
  opponentNotes:  Record<string, string[]>  // accumulated reads per opponent
  strategyNotes:  string[]          // cross-hand strategy adjustments
}

/** Sent to client after each showdown */
export interface AIReflectionPayload {
  reflections: {
    playerId:   string
    playerName: string
    roundNumber: number
    insights:   string[]
    selfCritique: string
    opponentReads: Record<string, string>
  }[]
}

// ─── Permanent (Long-term) Memory ────────────────────────────────────────────
// Now stored in Neon Postgres via Prisma (see prisma/schema.prisma).
// Schema: AiPlayerProfile, AiNote, AiGlobalInsight
// All memory is scoped by (userId, aiModel) for multi-tenant safety.
