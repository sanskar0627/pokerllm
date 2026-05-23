import type { GameState } from '@/types/poker'

const games = new Map<string, GameState>()

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId)
}

export function setGame(gameId: string, state: GameState): void {
  games.set(gameId, state)
}

export function deleteGame(gameId: string): void {
  games.delete(gameId)
}

export function getAllGames(): GameState[] {
  return Array.from(games.values())
}

export function gameExists(gameId: string): boolean {
  return games.has(gameId)
}
