'use client'

import { useState, useMemo } from 'react'
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
      className={`relative group flex-1 min-h-[56px] overflow-hidden rounded-xl transition-all
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
        <span className="relative z-10 flex items-center justify-center w-full h-full min-h-[56px] font-pixel text-[9px] tracking-[1px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          {children}
        </span>
      )}
    </button>
  )
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

  // Pre-computed raise presets
  const presets = useMemo(() => {
    const pot = gameState.pot
    return [
      { label: '1/2 POT', amount: Math.max(minRaise, Math.round(pot / 2)) },
      { label: '3/4 POT', amount: Math.max(minRaise, Math.round(pot * 3 / 4)) },
      { label: 'POT',     amount: Math.max(minRaise, pot) },
    ].filter(p => p.amount <= maxRaise)
  }, [gameState.pot, minRaise, maxRaise])

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
    const amount = raiseAmount || minRaise
    onAction('raise', Math.min(amount, maxRaise))
    setShowRaise(false)
    setRaiseAmount(0)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main action buttons row */}
      <div className="flex gap-4 w-full max-w-2xl">
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
        <div className="relative w-full max-w-lg overflow-hidden rounded-xl animate-fade-up">
          {/* Raise input background */}
          <img
            src="/images/raise-input-bg.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            draggable={false}
          />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 p-4 space-y-3">
            {/* Presets */}
            <div className="flex gap-2 justify-center">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => setRaiseAmount(p.amount)}
                  className={`px-4 py-2 rounded-lg border-2 font-game font-semibold text-[12px] transition-all
                    ${raiseAmount === p.amount
                      ? 'bg-[#FFD700]/20 border-[#FFD700] text-[#FFD700] shadow-[0_0_8px_rgba(255,215,0,0.3)]'
                      : 'bg-black/40 border-white/20 text-white/60 hover:border-[#FFD700]/50 hover:text-white/80'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Slider + input */}
            <div className="flex items-center gap-3">
              {/* Minus button */}
              <button
                onClick={() => setRaiseAmount(a => Math.max(minRaise, (a || minRaise) - gameState.bigBlind))}
                className="w-9 h-9 active:scale-90 transition-transform"
              >
                <img src="/images/btn-minus.png" alt="-" className="w-full h-full object-contain" draggable={false} />
              </button>

              <input
                type="range"
                min={minRaise}
                max={maxRaise}
                step={gameState.bigBlind}
                value={raiseAmount || minRaise}
                onChange={e => setRaiseAmount(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none bg-white/10
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FFD700] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,215,0,0.5)]
                           [&::-webkit-slider-thumb]:cursor-pointer"
              />

              {/* Plus button */}
              <button
                onClick={() => setRaiseAmount(a => Math.min(maxRaise, (a || minRaise) + gameState.bigBlind))}
                className="w-9 h-9 active:scale-90 transition-transform"
              >
                <img src="/images/btn-plus.png" alt="+" className="w-full h-full object-contain" draggable={false} />
              </button>

              <input
                type="number"
                min={minRaise}
                max={maxRaise}
                value={raiseAmount || minRaise}
                onChange={e => {
                  const val = Number(e.target.value)
                  setRaiseAmount(isNaN(val) || val < 0 ? minRaise : val)
                }}
                onBlur={() => {
                  // Clamp on blur: if empty/NaN/too low, reset to minRaise
                  setRaiseAmount(a => {
                    if (isNaN(a) || a < minRaise) return minRaise
                    if (a > maxRaise) return maxRaise
                    return a
                  })
                }}
                className="w-28 bg-black/50 border-2 border-[#FFD700]/40 rounded-lg px-2 py-2 text-white font-game font-semibold text-[14px] text-center
                           focus:outline-none focus:border-[#FFD700]/80"
              />
            </div>

            {/* Confirm / Cancel */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRaise}
                className="relative overflow-hidden rounded-xl active:scale-95 transition-all"
              >
                <img src="/images/buttons/raise-btn.png" alt="" className="w-44 h-11 object-cover" draggable={false} />
                <span className="absolute inset-0 flex items-center justify-center font-game font-bold text-[13px] text-[#FFD700] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  RAISE TO {(raiseAmount || minRaise).toLocaleString()}
                </span>
              </button>
              <button
                onClick={() => setShowRaise(false)}
                className="px-5 py-2.5 rounded-xl bg-black/40 border-2 border-white/20 font-game font-semibold text-[13px] text-white/60
                           hover:text-white/90 hover:border-white/40 transition-all"
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
