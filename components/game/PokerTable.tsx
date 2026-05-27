'use client'

import type { ClientGameState, ClientPlayer, PlayerAction, WinnerInfo } from '@/types/poker'
import { PlayerSeat }    from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { PotDisplay }    from './PotDisplay'
import { ActionButtons } from './ActionButtons'
import { ActionLog }     from './ActionLog'
import { ResultModal }   from '@/components/result/ResultModal'

interface Props {
  gameState:  ClientGameState
  playerId:   string
  thinkingId: string | null
  winners:    WinnerInfo[] | null
  onAction:    (action: PlayerAction, amount?: number) => void
  onNextRound: () => void
}

export function PokerTable({ gameState, playerId, thinkingId, winners, onAction, onNextRound }: Props) {
  const { players, dealerIdx, currentTurnIdx } = gameState
  const winnerIds = new Set(winners?.map(w => w.playerId) ?? [])

  function seat(player: ClientPlayer) {
    const idx = players.indexOf(player)
    return (
      <PlayerSeat
        key={player.id}
        player={player}
        isActive={idx === currentTurnIdx}
        isDealer={idx === dealerIdx}
        isThinking={thinkingId === player.id}
        isSelf={player.id === playerId}
        isWinner={winnerIds.has(player.id)}
      />
    )
  }

  // ── Distribute players around the table for desktop ──
  // The human (self) always goes bottom-center.
  // AIs spread across top, left, right.
  const total = players.length

  let topPlayers: ClientPlayer[] = []
  let leftPlayers: ClientPlayer[] = []
  let rightPlayers: ClientPlayer[] = []
  let bottomPlayers: ClientPlayer[] = []

  if (total <= 2) {
    topPlayers = players.slice(0, 1)
    bottomPlayers = players.slice(1)
  } else if (total === 3) {
    topPlayers = players.slice(0, 2)
    bottomPlayers = players.slice(2)
  } else if (total === 4) {
    topPlayers = [players[0], players[1]]
    leftPlayers = []
    rightPlayers = [players[2]]
    bottomPlayers = [players[3]]
  } else if (total === 5) {
    topPlayers = [players[0], players[1]]
    leftPlayers = [players[2]]
    rightPlayers = [players[3]]
    bottomPlayers = [players[4]]
  } else {
    // 6 players
    topPlayers = [players[0], players[1], players[2]]
    leftPlayers = [players[3]]
    rightPlayers = [players[4]]
    bottomPlayers = [players[5]]
  }

  return (
    <div className="relative flex flex-col gap-4 w-full max-w-7xl mx-auto">
      {/* Action log — fixed top-right */}
      <div className="absolute top-0 right-0 z-20">
        <ActionLog log={gameState.log} players={gameState.players} />
      </div>

      {/* Top row */}
      {topPlayers.length > 0 && (
        <div className="flex justify-center gap-6 pr-68">
          {topPlayers.map(p => seat(p))}
        </div>
      )}

      {/* Middle: left seats + table + right seats */}
      <div className="flex items-stretch gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-3 justify-center items-center shrink-0"
             style={{ minWidth: leftPlayers.length > 0 ? 156 : 0 }}>
          {leftPlayers.map(p => seat(p))}
        </div>

        {/* Table felt (wide desktop) */}
        <div className="relative flex-1 rounded-[2.5rem] overflow-hidden
                        shadow-[0_0_40px_rgba(255,215,0,0.12)]"
             style={{ minHeight: 300 }}>
          <img
            src="/images/table.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 rounded-[2.5rem] border-[3px] border-[#FFD700]/30 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center justify-center gap-6 h-full py-10 px-8">
            <PotDisplay
              pot={gameState.pot}
              currentBet={gameState.currentBet}
              phase={gameState.phase}
              roundNumber={gameState.roundNumber}
            />
            <CommunityCards cards={gameState.communityCards} />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3 justify-center items-center shrink-0"
             style={{ minWidth: rightPlayers.length > 0 ? 156 : 0 }}>
          {rightPlayers.map(p => seat(p))}
        </div>
      </div>

      {/* Bottom row */}
      {bottomPlayers.length > 0 && (
        <div className="flex justify-center gap-6">
          {bottomPlayers.map(p => seat(p))}
        </div>
      )}

      {/* Action buttons */}
      {playerId && (
        <ActionButtons
          gameState={gameState}
          playerId={playerId}
          onAction={onAction}
        />
      )}

      {/* Result modal */}
      {winners && (
        <ResultModal
          winners={winners}
          players={gameState.players}
          onClose={onNextRound}
        />
      )}
    </div>
  )
}
