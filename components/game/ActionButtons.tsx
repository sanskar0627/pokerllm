'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { PlayerAction, ClientGameState } from '@/types/poker'

interface Props {
  gameState:  ClientGameState
  playerId:   string
  onAction:   (action: PlayerAction, amount?: number) => void
}

// Image-based button with pressed state
function ImageButton({ src, pressedSrc, alt, onClick, disabled, children, className }: {
  src: string
  pressedSrc?: string
  alt: string
  onClick: () => void
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative group flex-1 min-h-[48px] sm:min-h-[56px] overflow-hidden rounded-lg sm:rounded-xl transition-all touch-manipulation
        ${disabled ? 'opacity-35 cursor-not-allowed' : 'active:scale-95 hover:brightness-110'}
        ${className ?? ''}`}
    >
      {/* Normal state */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover group-active:hidden"
        draggable={false}
      />
      {/* Pressed state */}
      {pressedSrc && (
        <img
          src={pressedSrc}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover hidden group-active:block"
          draggable={false}
        />
      )}
      {/* Text overlay */}
      {children && (
        <span className="relative z-10 flex items-center justify-center w-full h-full min-h-[48px] sm:min-h-[56px] font-pixel text-[8px] sm:text-[9px] tracking-[1px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          {children}
        </span>
      )}
    </button>
  )
}

// Hook for press-and-hold: fires callback on press, then repeatedly while held
function useHoldRepeat(callback: () => void, initialDelay = 400, repeatInterval = 80) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const start = useCallback(() => {
    callback() // fire immediately on press
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(callback, repeatInterval)
    }, initialDelay)
  }, [callback, initialDelay, repeatInterval])

  // Cleanup on unmount
  useEffect(() => stop, [stop])

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); start() },
    onTouchEnd: stop,
  }
}

export function ActionButtons({ gameState, playerId, onAction }: Props) {
  const [raiseAmount, setRaiseAmount] = useState<number>(0)
  const [showRaise,   setShowRaise]   = useState(false)

  const player = gameState.players.find(p => p.id === playerId)
  if (!player) return null

  const isMyTurn   = gameState.players[gameState.currentTurnIdx]?.id === playerId
  const callAmount = Math.max(0, gameState.currentBet - player.bet)
  const canCheck   = callAmount === 0
  const minRaise   = gameState.currentBet * 2 || gameState.bigBlind * 2
  const maxRaise   = player.stack + player.bet
  const zeroStack  = player.stack <= 0
  const bb         = gameState.bigBlind

  // Snap a value to the nearest big-blind increment, clamped to [minRaise, maxRaise]
  const snap = (v: number): number => {
    const rounded = Math.round(v / bb) * bb
    return Math.max(minRaise, Math.min(maxRaise, rounded))
  }

  // Pre-computed raise presets using standard pot-relative sizing:
  // "X pot" = call the current bet, then raise by X * (pot after calling)
  const presets = useMemo(() => {
    const potAfterCall = gameState.pot + callAmount
    const raw = [
      { label: '1/2 POT', amount: snap(gameState.currentBet + Math.round(potAfterCall * 0.5)) },
      { label: '3/4 POT', amount: snap(gameState.currentBet + Math.round(potAfterCall * 0.75)) },
      { label: 'POT',     amount: snap(gameState.currentBet + potAfterCall) },
    ]
    // Only show presets that produce distinct values and fit within max
    const seen = new Set<number>()
    return raw.filter(p => {
      if (p.amount > maxRaise || seen.has(p.amount)) return false
      seen.add(p.amount)
      return true
    })
  }, [gameState.pot, gameState.currentBet, callAmount, minRaise, maxRaise, bb])

  // Press-and-hold handlers for raise +/- buttons
  const decrementBind = useHoldRepeat(
    useCallback(() => setRaiseAmount(a => snap((a || minRaise) - bb)), [minRaise, bb])
  )
  const incrementBind = useHoldRepeat(
    useCallback(() => setRaiseAmount(a => snap((a || minRaise) + bb)), [minRaise, bb])
  )

  if (!isMyTurn || player.folded || gameState.phase === 'showdown' || gameState.phase === 'ended') {
    return (
      <div className="text-center py-4">
        <span className="font-pixel text-[8px] text-white/30 tracking-[2px]">
          {gameState.phase === 'showdown' ? 'SHOWDOWN' : gameState.phase === 'ended' ? 'GAME OVER' : 'WAITING FOR YOUR TURN...'}
        </span>
      </div>
    )
  }

  function handleRaise() {
    const amount = snap(raiseAmount || minRaise)
    onAction('raise', amount)
    setShowRaise(false)
    setRaiseAmount(0)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main action buttons row */}
      <div className="flex gap-2 sm:gap-4 w-full max-w-2xl">
        {/* FOLD */}
        <ImageButton
          src="/images/buttons/fold-btn.png"
          pressedSrc="/images/buttons/fold-btn-pressed.png"
          alt="Fold"
          onClick={() => onAction('fold')}
        >
          <span className="text-white">FOLD</span>
        </ImageButton>

        {/* CHECK / CALL */}
        <ImageButton
          src="/images/buttons/call-btn.png"
          pressedSrc="/images/buttons/call-btn-pressed.png"
          alt={canCheck ? 'Check' : 'Call'}
          onClick={() => canCheck ? onAction('check') : onAction('call', callAmount)}
          disabled={zeroStack && !canCheck}
        >
          <span className="text-white">
            {canCheck ? 'CHECK' : `CALL ${callAmount.toLocaleString()}`}
          </span>
        </ImageButton>

        {/* RAISE */}
        <ImageButton
          src="/images/buttons/raise-btn.png"
          pressedSrc="/images/buttons/raise-btn-pressed.png"
          alt="Raise"
          onClick={() => { setShowRaise(v => !v); setRaiseAmount(minRaise) }}
          disabled={zeroStack}
        >
          <span className="text-[#FFD700]">RAISE</span>
        </ImageButton>

        {/* ALL-IN */}
        <ImageButton
          src="/images/buttons/allin-btn.png"
          alt="All In"
          onClick={() => onAction('raise', maxRaise)}
          disabled={zeroStack}
        />
      </div>

      {/* Raise slider panel */}
      {showRaise && (
        <div className="relative w-full max-w-sm sm:max-w-lg overflow-hidden rounded-xl border-2 border-[#FFD700]/30 shadow-lg animate-fade-up">
          {/* Raise input background */}
          <img
            src="/images/raise-input-bg.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
            draggable={false}
          />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />
          <div className="relative z-10 p-4 space-y-4">
            {/* Presets */}
            <div className="flex gap-2 justify-center">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => setRaiseAmount(p.amount)}
                  className={`px-3 py-2 rounded-lg border-2 font-pixel text-[8px] tracking-wide transition-all
                    ${raiseAmount === p.amount
                      ? 'bg-[#FFD700]/25 border-[#FFD700] text-[#FFD700] shadow-[0_0_8px_rgba(255,215,0,0.3)] font-bold'
                      : 'bg-black/50 border-white/10 text-white/40 hover:border-[#FFD700]/40 hover:text-white/60'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Slider + input */}
            <div className="flex items-center gap-3">
              {/* Minus button — press-and-hold supported */}
              <button
                {...decrementBind}
                className="w-9 h-9 active:scale-90 transition-transform select-none touch-none"
              >
                <img src="/images/btn-minus.png" alt="-" className="w-full h-full object-contain pointer-events-none" draggable={false} />
              </button>

              <input
                type="range"
                min={minRaise}
                max={maxRaise}
                step={bb}
                value={raiseAmount || minRaise}
                onChange={e => setRaiseAmount(snap(Number(e.target.value)))}
                className="flex-1 h-2 rounded-full appearance-none bg-black/45 border border-white/10
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FFD700] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,215,0,0.5)]
                           [&::-webkit-slider-thumb]:cursor-pointer"
              />

              {/* Plus button — press-and-hold supported */}
              <button
                {...incrementBind}
                className="w-9 h-9 active:scale-90 transition-transform select-none touch-none"
              >
                <img src="/images/btn-plus.png" alt="+" className="w-full h-full object-contain pointer-events-none" draggable={false} />
              </button>

              <input
                type="number"
                min={minRaise}
                max={maxRaise}
                value={raiseAmount || minRaise}
                onChange={e => {
                  const val = Number(e.target.value)
                  if (!isNaN(val) && val >= 0) setRaiseAmount(val)
                }}
                onBlur={() => setRaiseAmount(a => snap(isNaN(a) ? minRaise : a))}
                className="w-20 sm:w-28 bg-black/70 border-2 border-[#FFD700]/30 rounded-lg px-2 py-2 text-white font-pixel text-[9px] sm:text-[11px] text-center
                           focus:outline-none focus:border-[#FFD700]/80"
              />
            </div>

            {/* Confirm / Cancel */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRaise}
                className="relative overflow-hidden rounded-xl active:scale-95 transition-all hover:brightness-105"
              >
                <img src="/images/buttons/raise-btn.png" alt="" className="w-48 h-12 object-cover" draggable={false} />
                <span className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] text-[#FFD700] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  RAISE TO {(raiseAmount || minRaise).toLocaleString()}
                </span>
              </button>
              <button
                onClick={() => setShowRaise(false)}
                className="px-6 py-3 rounded-xl bg-black/60 border border-white/15 font-pixel text-[9px] text-white/45 hover:text-white/80 hover:border-white/30 transition-all active:scale-95"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
