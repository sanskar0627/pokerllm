'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter }                from 'next/navigation'
import { useSocket }                from '@/hooks/useSocket'
import { useAudio }                 from '@/hooks/useAudio'
import { PokerTable }               from '@/components/game/PokerTable'
import type { PlayerAction, WinnerInfo } from '@/types/poker'

type Props = { params: Promise<{ gameId: string }> }

export default function GamePage({ params }: Props) {
  const { gameId } = use(params)
  const router = useRouter()
  const { musicOn, soundOn, toggleMusic, toggleSound, playSound } = useAudio()

  const { socket, connected, gameState, winners, thinkingId, error, nextRound } = useSocket()
  const [playerId, setPlayerId] = useState<string>('')
  // Removed fold-win auto-advance states

  // SFX triggers
  const prevPhaseRef = useRef<string>('')
  const prevCardsCountRef = useRef<number>(0)
  const prevPotRef = useRef<number>(0)
  const prevWinnersRef = useRef<WinnerInfo[] | null>(null)

  useEffect(() => {
    if (!gameState) return

    const phaseChanged = prevPhaseRef.current && prevPhaseRef.current !== gameState.phase
    const cardsDealt = gameState.communityCards.length > prevCardsCountRef.current
    const betPlaced = gameState.pot > prevPotRef.current

    if (phaseChanged || cardsDealt) {
      playSound('card-shuffle')
    } else if (betPlaced) {
      playSound('chip-toss')
    }

    prevPhaseRef.current = gameState.phase
    prevCardsCountRef.current = gameState.communityCards.length
    prevPotRef.current = gameState.pot
  }, [gameState, playSound])

  useEffect(() => {
    if (winners && winners.length > 0 && !prevWinnersRef.current) {
      playSound('win-coins')
    }
    prevWinnersRef.current = winners
  }, [winners, playSound])

  useEffect(() => {
    if (!socket) return
    const pid = `human_${gameId}`
    setPlayerId(pid)
    socket.emit('join_game', gameId, pid)
  }, [socket, gameId])

  // Hand results now require manual confirmation via ResultModal

  function handleAction(action: PlayerAction, amount?: number) {
    if (!socket || !playerId) return
    socket.emit('player_action', { gameId, playerId, action, amount })
  }

  if (!gameState) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        {/* Table room background */}
        <img
          src="/images/table-room-bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-center space-y-5">
            <div className="w-14 h-14 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto
                            shadow-[0_0_24px_rgba(255,215,0,0.4)]" />
            <p className="font-pixel text-[9px] text-[#FFD700] tracking-[3px] animate-pulse">
              {connected ? 'LOADING GAME felt...' : 'CONNECTING TO CASINO...'}
            </p>
            {error && (
              <div className="bg-red-500/10 border-2 border-red-500/35 rounded-xl px-5 py-3.5 max-w-sm mx-auto shadow-md">
                <p className="font-pixel text-[8px] text-red-400 leading-relaxed uppercase">{error}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Table room background */}
      <img
        src="/images/table-room-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 min-h-screen py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {/* Top bar with background image */}
          <div className="relative mb-5 overflow-hidden rounded-xl border-2 border-[#FFD700]/30 shadow-lg">
            <img src="/images/topbar-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative z-10 flex items-center justify-between px-6 py-3">
              <button
                onClick={() => router.push('/')}
                className="font-pixel text-[10px] text-[#FFD700] hover:text-[#FFD700]/80 bg-black/40 border border-[#FFD700]/30 rounded-lg px-4 py-2 transition-all active:scale-95 tracking-wide shadow-md"
              >
                &larr; LOBBY
              </button>
              <h1 className="font-pixel font-bold text-[14px] sm:text-[18px] text-[#FFD700] tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                POKER LLM
              </h1>
              <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.7)]' : 'bg-red-400'}`} />
                <span className="font-pixel text-[8px] text-white/50">{gameId.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-red-500/10 border-2 border-red-500/35 rounded-xl px-4 py-2.5 text-center animate-fade-up shadow-md">
              <p className="font-pixel text-[8px] text-red-400 uppercase tracking-wide">{error}</p>
            </div>
          )}

          <PokerTable
            gameState={gameState}
            playerId={playerId}
            thinkingId={thinkingId}
            winners={winners}
            onAction={handleAction}
            onNextRound={() => nextRound(gameId)}
          />

          {/* Fold wins now render the standard ResultModal */}
        </div>
      </div>

      {/* Bottom-right audio controls */}
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2">
        <button onClick={toggleSound} className="w-10 h-10 active:scale-90 transition-transform">
          <img
            src={soundOn ? '/images/sound-on.png' : '/images/sound-off.png'}
            alt="Sound" className="w-full h-full object-contain"
          />
        </button>
        <button onClick={toggleMusic} className="w-10 h-10 active:scale-90 transition-transform">
          <img
            src={musicOn ? '/images/music-button-on.png' : '/images/music-button-off.png'}
            alt="Music" className="w-full h-full object-contain"
          />
        </button>
      </div>
    </main>
  )
}
