'use client'

import { use, useEffect, useState, useRef, useCallback } from 'react'
import { useSession }               from 'next-auth/react'
import Link                         from 'next/link'
import { useSocket }                from '@/hooks/useSocket'
import { useAudio }                 from '@/hooks/useAudio'
import { PokerTable }               from '@/components/game/PokerTable'
import { ChatPanel }                from '@/components/game/ChatPanel'
import { ThinkingPanel }            from '@/components/game/ThinkingPanel'
import { AssetPreloader }           from '@/components/game/AssetPreloader'
import type { PlayerAction, WinnerInfo } from '@/types/poker'

type Props = { params: Promise<{ gameId: string }> }

export default function GamePage({ params }: Props) {
  const { gameId } = use(params)
  const { data: session } = useSession()
  const { playSound } = useAudio()

  const { socket, connected, gameState, winners, thinkingId, error, nextRound, aiReflections, chatBubbles, chatLog, turnTimer, aiStatusMessages, aiThinkingLog, sendChat, leaveGame } = useSocket()
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

  // Stable reference so the memoized ChatPanel doesn't re-render on every state update
  const handleSendChat = useCallback((msg: string) => sendChat(gameId, msg), [sendChat, gameId])

  if (!gameState) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        {/* Start warming card/button assets while we connect */}
        <AssetPreloader />
        {/* Table room background */}
        <img
          src="/images/table-room-bg.png"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-center space-y-5">
            <div className="w-14 h-14 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto
                            shadow-[0_0_24px_rgba(255,215,0,0.4)]" />
            <p className="font-pixel text-[9px] text-[#FFD700] tracking-[3px] animate-pulse">
              {connected ? 'LOADING TABLE...' : 'CONNECTING TO CASINO...'}
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
      <AssetPreloader />
      {/* Table room background */}
      <img
        src="/images/table-room-bg.png"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 min-h-screen min-h-[100dvh] py-2 sm:py-6">
        <div className={`max-w-7xl mx-auto px-2 sm:px-4 lg:px-8`}>
          {/* Top bar — Golden-Flop style */}
          <div className="relative mb-2 sm:mb-5 overflow-hidden rounded-lg sm:rounded-xl border border-[#FFD700]/20 sm:border-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <img src="/images/topbar-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 flex items-center justify-between px-2.5 sm:px-5 py-1.5 sm:py-3">
              {/* Left: Room ID + status */}
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.7)]' : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]'}`} />
                <span className="font-pixel text-[5px] sm:text-[7px] text-white/40 tracking-wide">{gameId.slice(0, 6)}</span>
              </div>

              {/* Center: Title */}
              <h1 className="font-pixel font-bold text-[9px] sm:text-[16px] text-[#FFD700] tracking-[2px] sm:tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                POKER LLM
              </h1>

              {/* Right: Avatar + Leave */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/profile"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center shrink-0 hover:border-[#FFD700]/60 transition-colors touch-manipulation overflow-hidden"
                  title="Profile"
                >
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="font-pixel text-[7px] sm:text-[8px] text-[#FFD700]">
                      {(session?.user?.name ?? session?.user?.email)?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => {
                    leaveGame(gameId)
                    // Use window.location for reliable navigation (router.push can be flaky)
                    setTimeout(() => { window.location.href = '/' }, 150)
                  }}
                  className="font-pixel text-[6px] sm:text-[8px] text-white bg-[rgba(180,30,30,0.92)] border border-[#FF4444] rounded-lg px-2 sm:px-4 py-1.5 sm:py-2.5 transition-all active:scale-95 hover:brightness-110 tracking-wide shadow-[0_0_10px_rgba(255,0,0,0.2)] touch-manipulation min-h-[32px] sm:min-h-0"
                >
                  LEAVE
                </button>
              </div>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-red-500/10 border-2 border-red-500/35 rounded-xl px-4 py-2.5 text-center animate-fade-up shadow-md">
              <p className="font-pixel text-[8px] text-red-400 uppercase tracking-wide">{error}</p>
            </div>
          )}

          {/* Main content: table + optional thinking panel */}
          <div>
            <div className="w-full">
              <PokerTable
                gameState={gameState}
                playerId={playerId}
                thinkingId={thinkingId}
                winners={winners}
                aiReflections={aiReflections}
                chatBubbles={chatBubbles}
                turnTimer={turnTimer}
                onAction={handleAction}
                onNextRound={() => nextRound(gameId)}
              />
            </div>

            {/* ThinkingPanel rendered as fixed overlay below */}
          </div>

          {/* Fold wins now render the standard ResultModal */}
        </div>
      </div>

      {/* AI Status Toasts — top-right corner */}
      {aiStatusMessages.length > 0 && (
        <div className="fixed top-14 right-2 sm:top-16 sm:right-4 z-50 flex flex-col gap-2 max-w-[320px] sm:max-w-[380px]">
          {aiStatusMessages.map((msg) => {
            const isRateLimit = msg.type === 'rate_limit'
            const isTimeout = msg.type === 'timeout'
            const isCircuit = msg.type === 'circuit_open'
            const borderColor = isRateLimit ? 'border-amber-500/40' : isTimeout ? 'border-orange-500/40' : isCircuit ? 'border-red-500/40' : 'border-red-500/30'
            const iconColor = isRateLimit ? 'text-amber-400' : isTimeout ? 'text-orange-400' : 'text-red-400'
            const bgColor = isRateLimit ? 'bg-amber-500/10' : isTimeout ? 'bg-orange-500/10' : 'bg-red-500/10'

            return (
              <div
                key={msg.ts}
                className={`${bgColor} border ${borderColor} backdrop-blur-md rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-slide-in-right`}
              >
                <div className="flex items-start gap-2">
                  {/* Icon */}
                  <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor} shrink-0 mt-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isRateLimit ? (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </>
                    ) : isTimeout ? (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </>
                    ) : (
                      <>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </>
                    )}
                  </svg>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-pixel text-[5px] sm:text-[6px] ${iconColor} tracking-[1.5px] uppercase mb-0.5`}>
                      {isRateLimit ? 'RATE LIMIT' : isTimeout ? 'TIMEOUT' : isCircuit ? 'AI UNAVAILABLE' : 'AI ERROR'}
                    </p>
                    <p className="font-game text-[10px] sm:text-[11px] text-white/70 leading-tight">
                      {msg.message}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Live chat panel — bottom-left */}
      <ChatPanel chatLog={chatLog} onSend={handleSendChat} />

      {/* AI Thinking Panel — fixed overlay, right side, watch mode only */}
      {gameState?.watchOnly && (
        <ThinkingPanel
          entries={aiThinkingLog}
          thinkingId={thinkingId}
          players={gameState.players}
        />
      )}
    </main>
  )
}
