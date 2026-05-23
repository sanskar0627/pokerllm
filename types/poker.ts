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
  action:   PlayerAction | 'post'   // 'post' = mandatory blind posting
  amount:   number
  phase:    GamePhase
  ts:       number
}

export interface GameState {
  id:             string
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

export interface ServerToClientEvents {
  game_state:   (state: ClientGameState) => void
  game_created: (gameId: string) => void
  game_error:   (msg: string) => void
  llm_thinking: (playerId: string) => void
  game_over:    (winners: WinnerInfo[]) => void
}

export interface ClientToServerEvents {
  join_game:     (gameId: string, playerId: string) => void
  player_action: (payload: ActionPayload) => void
  create_game:   (opts: CreateGameOptions) => void
  next_round:    (gameId: string) => void
}

export interface ActionPayload {
  gameId:   string
  playerId: string
  action:   PlayerAction
  amount?:  number
}
