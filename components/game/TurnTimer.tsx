'use client'

import { useState, useEffect, useRef } from 'react'
import type { TurnTimerPayload } from '@/types/poker'

interface Props {
  timer:       TurnTimerPayload
  isSelf:      boolean   // true if this timer is for the local player
  playerName?: string    // shown for AI timers
}

export function TurnTimer({ timer, isSelf, playerName }: Props) {
  const { totalMs, phase: serverPhase } = timer

  // Local countdown: the server sends the initial event, we count down locally
  // to avoid needing per-second server ticks for AI turns.
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  // Reset start time when a new timer begins (different player or fresh timer)
  useEffect(() => {
    startRef.current = Date.now() - (totalMs - timer.remainingMs)
    setElapsed(totalMs - timer.remainingMs)
  }, [timer.playerId, totalMs])

  // Tick every second for local countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startRef.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [timer.playerId])

  const remainingMs = Math.max(0, totalMs - elapsed)
  const fraction = remainingMs / totalMs
  const seconds  = Math.ceil(remainingMs / 1000)

  // Use server phase if available (human turns get server ticks), else compute
  const isWarning = serverPhase === 'warning' || serverPhase === 'expired' || remainingMs <= 10_000
  const isExpired = serverPhase === 'expired' || remainingMs <= 0

  // Gradient: green → yellow → red as time runs out
  const barColor = fraction > 0.5
    ? '#22C55E'
    : fraction > 0.15
      ? '#EAB308'
      : '#EF4444'

  const glowColor = fraction > 0.5
    ? 'rgba(34,197,94,0.4)'
    : fraction > 0.15
      ? 'rgba(234,179,8,0.4)'
      : 'rgba(239,68,68,0.6)'

  return (
    <div className="flex flex-col items-center gap-1 w-full max-w-md mx-auto">
      {/* Label for AI timer */}
      {!isSelf && playerName && (
        <span className="font-pixel text-[6px] text-white/50 tracking-widest">
          {playerName.toUpperCase()} THINKING
        </span>
      )}

      {/* Timer bar */}
      <div className="relative w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${fraction * 100}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${glowColor}`,
          }}
        />
      </div>

      {/* Warning countdown (last 10s) — shown for both human and AI */}
      {isWarning && (
        <div className="flex items-center gap-1.5">
          <span
            key={seconds}
            className={`font-pixel text-[14px] tabular-nums animate-pulse
              ${seconds <= 3 ? 'text-red-400' : seconds <= 5 ? 'text-yellow-400' : 'text-white/80'}`}
            style={{
              textShadow: seconds <= 3
                ? '0 0 12px rgba(239,68,68,0.8)'
                : seconds <= 5
                  ? '0 0 8px rgba(234,179,8,0.6)'
                  : 'none',
            }}
          >
            {seconds}
          </span>
          <span className="font-pixel text-[7px] text-white/40 tracking-widest">
            {isExpired ? 'TIME UP' : 'SECONDS LEFT'}
          </span>
        </div>
      )}
    </div>
  )
}
