'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter }                from 'next/navigation'
import { useSocket }                from '@/hooks/useSocket'
import { useAudio }                 from '@/hooks/useAudio'
import { PokerTable }               from '@/components/game/PokerTable'
import { ChatPanel }                from '@/components/game/ChatPanel'
import type { PlayerAction, WinnerInfo } from '@/types/poker'

type Props = { params: Promise<{ gameId: string }> }

export default function GamePage({ params }: Props) {
  const { gameId } = use(params)
  const router = useRouter()
  const { playSound } = useAudio()

  const { socket, connected, gameState, winners, thinkingId, error, nextRound, aiReflections, chatBubbles, chatLog, sendChat } = useSocket()
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

  // Join game on connect AND reconnect — connected dependency ensures
  // socket.data gets re-set on the server after any disconnect/reconnect
  useEffect(() => {
    if (!socket || !connected) return
    const pid = `human_${gameId}`
    setPlayerId(pid)
    socket.emit('join_game', gameId, pid)
  }, [socket, gameId, connected])

  // Redirect to home if game doesn't exist (stale URL / server restart)
  useEffect(() => {
    if (error && error.toLowerCase().includes('not found')) {
      window.location.href = '/'
    }
  }, [error])

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
          {/* Top bar — Golden-Flop style */}
          <div className="relative mb-3 sm:mb-5 overflow-hidden rounded-lg sm:rounded-xl border-2 border-[#FFD700]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <img src="/images/topbar-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3">
              {/* Left: Room ID + status */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${connected ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.7)]' : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]'}`} />
                <span className="font-pixel text-[6px] sm:text-[7px] text-white/40 tracking-wide">{gameId.slice(0, 6)}</span>
              </div>

              {/* Center: Title */}
              <h1 className="font-pixel font-bold text-[10px] sm:text-[16px] text-[#FFD700] tracking-[2px] sm:tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                POKER LLM
              </h1>

              {/* Right: Leave button (red like Golden-Flop) */}
              <button
                onClick={() => router.push('/')}
                className="font-pixel text-[7px] sm:text-[8px] text-white bg-[rgba(180,30,30,0.92)] border-[1.5px] border-[#FF4444] rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2.5 transition-all active:scale-95 hover:brightness-110 tracking-wide shadow-[0_0_10px_rgba(255,0,0,0.2)]"
              >
                LEAVE
              </button>
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
            aiReflections={aiReflections}
            chatBubbles={chatBubbles}
            onAction={handleAction}
            onNextRound={() => nextRound(gameId)}
          />

          {/* Fold wins now render the standard ResultModal */}
        </div>
      </div>

      {/* Live chat panel — bottom-left */}
      <ChatPanel
        chatLog={chatLog}
        onSend={(msg) => sendChat(gameId, msg)}
      />
    </main>
  )
}
