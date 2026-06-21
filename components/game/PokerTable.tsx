'use client'

import { useState, useEffect, memo, useMemo } from 'react'
import type { ClientGameState, ClientPlayer, PlayerAction, WinnerInfo, AIReflectionPayload, TurnTimerPayload } from '@/types/poker'
import { PlayerSeat }    from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { PotDisplay }    from './PotDisplay'
import { ActionButtons } from './ActionButtons'
import { ActionLog }     from './ActionLog'
import { TurnTimer }     from './TurnTimer'
import { ResultModal }   from '@/components/result/ResultModal'
import { GameOverModal } from '@/components/result/GameOverModal'

// ─── Dust Particles — fewer on mobile, GPU-accelerated ──────────────────────

const DustParticles = memo(function DustParticles() {
  // Fewer particles for better performance (8 instead of 14)
  const particles = useMemo(() => Array.from({ length: 8 }).map((_, i) => ({
    left: `${5 + (i * 12) % 90}%`,
    bottom: `${(i * 7) % 30}%`,
    size: 2 + (i % 3),
    duration: 6 + (i % 5),
    delay: (i * 0.8) % 5,
    opacity: 0.3 + (i % 3) * 0.15,
  })), [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5] hidden sm:block">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[#FFD700] animate-dust will-change-transform"
          style={{
            left: p.left,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            '--dust-duration': `${p.duration}s`,
            '--dust-delay': `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
})

// ─── Win Popup Toast — bottom-right like Golden-Flop ─────────────────────────

function WinToast({ winners, players }: { winners: WinnerInfo[]; players: ClientPlayer[] }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible || winners.length === 0) return null

  const w = winners[0]
  const name = players.find(p => p.id === w.playerId)?.name ?? w.playerId

  return (
    <div className={`fixed bottom-20 sm:bottom-6 right-2 sm:right-6 z-40 ${visible ? 'animate-slide-in-right' : 'animate-slide-out-right'}`}>
      <div className="bg-[rgba(26,10,46,0.95)] border-2 border-[#FFD700]/60 rounded-xl px-3 sm:px-5 py-2 sm:py-3.5 shadow-[0_0_24px_rgba(255,215,0,0.3)] flex items-center gap-2 sm:gap-3 max-w-[220px] sm:max-w-xs">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/40 flex items-center justify-center shrink-0">
          <span className="text-base sm:text-lg select-none">🏆</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-pixel text-[7px] sm:text-[8px] text-[#FFD700] tracking-wide">{name.toUpperCase()} WINS</span>
          <span className="font-pixel text-[5px] sm:text-[6px] text-[#00FFFF]">{w.handName}</span>
          <div className="flex items-center gap-1">
            <img src="/images/coin.png" alt="" className="w-3 h-3 object-contain" draggable={false} />
            <span className="font-pixel text-[6px] sm:text-[7px] text-[#FFD700] tabular-nums">+{w.amount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Countdown Overlay ───────────────────────────────────────────────────────

function CountdownOverlay({ count }: { count: number }) {
  return (
    <div className="absolute inset-[8%] sm:inset-[6%] z-30 flex flex-col items-center justify-center bg-black/60 rounded-[2rem] sm:rounded-[3rem]">
      <span className="font-pixel text-[10px] text-[#FFD700]/70 tracking-[3px] mb-4">GAME STARTING IN</span>
      <span
        key={count}
        className="font-pixel text-[64px] text-[#FFD700] animate-countdown drop-shadow-[0_0_32px_rgba(255,215,0,0.6)]"
      >
        {count}
      </span>
    </div>
  )
}

// ─── Main PokerTable Component ───────────────────────────────────────────────

interface Props {
  gameState:      ClientGameState
  playerId:       string
  thinkingId:     string | null
  winners:        WinnerInfo[] | null
  aiReflections:  AIReflectionPayload['reflections']
  chatBubbles:    Record<string, string>
  turnTimer:      TurnTimerPayload | null
  onAction:       (action: PlayerAction, amount?: number) => void
  onNextRound:    () => void
}

export function PokerTable({ gameState, playerId, thinkingId, winners, aiReflections, chatBubbles, turnTimer, onAction, onNextRound }: Props) {
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
        chatMessage={chatBubbles[player.id]}
        watchOnly={gameState.watchOnly}
      />
    )
  }

  // ── 6-seat layout matching Golden-Flop ──
  const total = players.length

  let topPlayers: ClientPlayer[] = []
  let leftPlayers: ClientPlayer[] = []
  let rightPlayers: ClientPlayer[] = []
  let bottomPlayers: ClientPlayer[] = []

  if (total <= 2) {
    topPlayers = players.slice(0, 1)
    bottomPlayers = players.slice(1)
  } else if (total === 3) {
    topPlayers = [players[0]]
    leftPlayers = [players[1]]
    bottomPlayers = [players[2]]
  } else if (total === 4) {
    topPlayers = [players[0], players[1]]
    rightPlayers = [players[2]]
    bottomPlayers = [players[3]]
  } else if (total === 5) {
    topPlayers = [players[0], players[1]]
    leftPlayers = [players[2]]
    rightPlayers = [players[3]]
    bottomPlayers = [players[4]]
  } else {
    topPlayers = [players[0], players[1], players[2]]
    leftPlayers = [players[3]]
    rightPlayers = [players[4]]
    bottomPlayers = [players[5]]
  }

  return (
    <div className="relative flex flex-col gap-1.5 sm:gap-3 w-full max-w-7xl mx-auto px-0.5 sm:px-0">
      {/* Action log — top-right */}
      <div className="absolute -top-1 right-1 sm:right-3 z-20">
        <ActionLog log={gameState.log} players={gameState.players} />
      </div>

      {/* Top row */}
      {topPlayers.length > 0 && (
        <div className={`flex justify-center gap-2 sm:gap-8 ${topPlayers.length > 1 ? 'sm:pr-68' : ''}`}>
          {topPlayers.map(p => seat(p))}
        </div>
      )}

      {/* Middle: left seats + table felt + right seats */}
      <div className="flex items-center gap-1 sm:gap-6">
        {/* Left column */}
        <div className="flex flex-col gap-2 sm:gap-4 justify-center items-center shrink-0"
             style={{ minWidth: leftPlayers.length > 0 ? 60 : 0 }}>
          {leftPlayers.map(p => seat(p))}
        </div>

        {/* Table felt — tabletop.png image */}
        <div className="relative flex-1 overflow-visible"
             style={{ aspectRatio: '780 / 320', maxHeight: 'clamp(180px, 35vh, 400px)' }}>
          {/* Table image */}
          <img
            src="/images/tabletop-removebg-preview.png"
            alt=""
            className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_4px_40px_rgba(0,0,0,0.7)] rotate-180"
            draggable={false}
          />

          {/* Dust particles — hidden on mobile */}
          <DustParticles />

          {/* Waiting overlay */}
          {gameState.phase === 'waiting' && (
            <div className="absolute inset-[8%] sm:inset-[6%] z-30 flex flex-col items-center justify-center bg-black/50 rounded-[1.5rem] sm:rounded-[3rem]">
              <span className="font-pixel text-[9px] sm:text-[14px] text-[#FFD700] tracking-[3px] sm:tracking-[4px] animate-pulse drop-shadow-[0_0_16px_rgba(255,215,0,0.4)]">
                WAITING
              </span>
              <span className="font-pixel text-[5px] sm:text-[7px] text-white/40 mt-1.5 sm:mt-3 tracking-wide">
                Setting up the table...
              </span>
            </div>
          )}

          {/* Table content: pot + community cards */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 sm:gap-4 px-2 sm:px-12">
            <PotDisplay
              pot={gameState.pot}
              currentBet={gameState.currentBet}
              phase={gameState.phase}
              roundNumber={gameState.roundNumber}
              bigBlind={gameState.bigBlind}
            />
            <CommunityCards cards={gameState.communityCards} />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2 sm:gap-4 justify-center items-center shrink-0"
             style={{ minWidth: rightPlayers.length > 0 ? 60 : 0 }}>
          {rightPlayers.map(p => seat(p))}
        </div>
      </div>

      {/* Bottom row — pulled closer to table */}
      {bottomPlayers.length > 0 && (
        <div className="flex justify-center gap-2 sm:gap-8 -mt-1 sm:-mt-3">
          {bottomPlayers.map(p => seat(p))}
        </div>
      )}

      {/* Turn timer bar + action buttons */}
      <div className="-mt-0.5 sm:-mt-1 space-y-1">
        {turnTimer && (
          <TurnTimer
            timer={turnTimer}
            isSelf={turnTimer.playerId === playerId}
            playerName={players.find(p => p.id === turnTimer.playerId)?.name}
          />
        )}
        {playerId && (
          <ActionButtons
            gameState={gameState}
            playerId={playerId}
            onAction={onAction}
          />
        )}
      </div>

      {/* Win toast */}
      {winners && gameState.phase !== 'ended' && (
        <WinToast winners={winners} players={gameState.players} />
      )}

      {/* Result modal */}
      {winners && gameState.phase !== 'ended' && (
        <ResultModal
          winners={winners}
          players={gameState.players}
          onClose={onNextRound}
        />
      )}

      {/* Game Over modal */}
      {gameState.phase === 'ended' && (
        <GameOverModal
          players={gameState.players}
          playerId={playerId}
          aiReflections={aiReflections}
        />
      )}
    </div>
  )
}
