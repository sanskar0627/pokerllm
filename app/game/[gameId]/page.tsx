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
  const { musicOn, soundOn, toggleMusic, toggleSound } = useAudio()

  const { socket, connected, gameState, winners, thinkingId, error, nextRound } = useSocket()
  const [playerId, setPlayerId] = useState<string>('')
  const [foldWinToast, setFoldWinToast] = useState<WinnerInfo | null>(null)
  const autoNextRef = useRef(false)

  useEffect(() => {
    if (!socket) return
    const pid = `human_${gameId}`
    setPlayerId(pid)
    socket.emit('join_game', gameId, pid)
  }, [socket, gameId])

  // Auto-continue for fold wins ("Last Standing") — no modal, just a brief toast
  const isFoldWin = winners?.every(w => w.handName === 'Last Standing') ?? false

  useEffect(() => {
    if (!winners || !isFoldWin) {
      autoNextRef.current = false
      return
    }
    // Prevent double-firing
    if (autoNextRef.current) return
    autoNextRef.current = true

    // Show brief toast
    setFoldWinToast(winners[0])

    // Auto-continue after 1.5s
    const timer = setTimeout(() => {
      setFoldWinToast(null)
      nextRound(gameId)
    }, 1500)
    return () => clearTimeout(timer)
  }, [winners, isFoldWin, gameId, nextRound])

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
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto
                            shadow-[0_0_16px_rgba(255,215,0,0.3)]" />
            <p className="font-pixel text-[8px] text-white/40 tracking-[2px]">
              {connected ? 'LOADING GAME...' : 'CONNECTING...'}
            </p>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">
                <p className="font-pixel text-[7px] text-red-400">{error}</p>
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

      <div className="relative z-10 min-h-screen py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {/* Top bar with background image */}
          <div className="relative mb-5 overflow-hidden rounded-xl">
            <img src="/images/topbar-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="relative z-10 flex items-center justify-between px-6 py-3">
              <button
                onClick={() => router.push('/')}
                className="font-game font-semibold text-[16px] text-[#FFD700] hover:text-[#FFD700]/80 transition-colors tracking-wide"
              >
                &larr; LOBBY
              </button>
              <h1 className="font-game font-bold text-[20px] text-[#FFD700] tracking-[4px] drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
                POKER LLM
              </h1>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-red-400'}`} />
                <span className="font-game text-[13px] text-white/40">{gameId.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 text-center animate-fade-up">
              <p className="font-pixel text-[7px] text-red-400">{error}</p>
            </div>
          )}

          <PokerTable
            gameState={gameState}
            playerId={playerId}
            thinkingId={thinkingId}
            winners={isFoldWin ? null : winners}
            onAction={handleAction}
            onNextRound={() => nextRound(gameId)}
          />

          {/* Brief toast for fold wins (opponent folded, no full modal needed) */}
          {foldWinToast && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
              <div className="bg-[#1a0a2e]/95 border border-[#FFD700]/40 rounded-xl px-6 py-3 flex items-center gap-3
                              shadow-[0_0_24px_rgba(255,215,0,0.2)] backdrop-blur-sm">
                <img src="/images/coin.png" alt="" className="w-6 h-6" draggable={false} />
                <span className="font-game font-semibold text-[14px] text-[#FFD700]">
                  +{foldWinToast.amount.toLocaleString()}
                </span>
                <span className="font-game text-[12px] text-white/50">
                  Opponent folded
                </span>
              </div>
            </div>
          )}
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
