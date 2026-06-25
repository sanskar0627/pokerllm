'use client'

import { useState, useEffect } from 'react'
import type { WinnerInfo, ClientPlayer, Card } from '@/types/poker'

function getCardImagePath(card: Card): string {
  return `/images/cards/${card.rank}_${card.suit}.png`
}

// ─── Animated counter — counts up from 0 to target ────────────────────────

function AnimatedChips({ amount }: { amount: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 1200
    const steps = 30
    const increment = amount / steps
    let current = 0
    let step = 0
    const interval = setInterval(() => {
      step++
      current = Math.min(Math.round(increment * step), amount)
      setDisplay(current)
      if (step >= steps) clearInterval(interval)
    }, duration / steps)
    return () => clearInterval(interval)
  }, [amount])

  return <span>+{display.toLocaleString()}</span>
}

// ─── Radial light rays behind trophy ───────────────────────────────────────

function LightRays() {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] pointer-events-none opacity-30">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 origin-bottom-left"
          style={{
            width: 2,
            height: 150,
            background: 'linear-gradient(to top, rgba(255,215,0,0.4), transparent)',
            transform: `rotate(${i * 30}deg)`,
            transformOrigin: '0 0',
          }}
        />
      ))}
    </div>
  )
}

// ─── Floating particles ────────────────────────────────────────────────────

function Sparkles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-dust"
          style={{
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FFA500' : '#FFFFFF',
            opacity: 0.3 + Math.random() * 0.5,
            '--dust-duration': `${3 + Math.random() * 4}s`,
            '--dust-delay': `${Math.random() * 3}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

interface Props {
  winners: WinnerInfo[]
  players: ClientPlayer[]
  onClose: () => void
}

export function ResultModal({ winners, players, onClose }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Stagger entrance
    const t = setTimeout(() => setShow(true), 50)
    return () => clearTimeout(t)
  }, [])

  function playerName(id: string) {
    return players.find(p => p.id === id)?.name ?? id
  }

  const isSplit = winners.length > 1
  const totalWon = winners.reduce((s, w) => s + w.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/75" />

      {/* Modal — full width bottom sheet on mobile, centered on desktop */}
      <div
        className="relative w-full sm:max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl transition-all duration-500 max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
        }}
      >
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(165deg, #1a0f2e 0%, #0d0a1a 40%, #0a0810 100%)',
          }}
        />

        {/* Subtle border glow */}
        <div className="absolute inset-0 rounded-2xl border border-[#FFD700]/25 shadow-[0_0_60px_rgba(255,215,0,0.12),_inset_0_1px_0_rgba(255,215,0,0.1)]" />

        <Sparkles />

        <div className="relative z-10">
          {/* ── Top section: Trophy + Title ── */}
          <div className="relative pt-8 pb-5 flex flex-col items-center overflow-hidden">
            <LightRays />

            {/* Trophy icon */}
            <div className="relative mb-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center animate-float"
                style={{
                  background: 'radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)',
                }}
              >
                <span className="text-[36px] select-none drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]">🏆</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="font-pixel text-[14px] sm:text-[16px] text-[#FFD700] tracking-[4px] sm:tracking-[6px]"
              style={{ textShadow: '0 0 20px rgba(255,215,0,0.4)' }}
            >
              {isSplit ? 'SPLIT POT' : 'WINNER'}
            </h2>

            {/* Subtle underline */}
            <div className="mt-3 w-24 h-[1px] bg-gradient-to-r from-transparent via-[#FFD700]/40 to-transparent" />
          </div>

          {/* ── Winner card(s) ── */}
          <div className="px-6 space-y-3">
            {winners.map((w, i) => {
              const name = playerName(w.playerId)
              const winnerPlayer = players.find(p => p.id === w.playerId)
              const winnerCards = winnerPlayer && !winnerPlayer.folded && Array.isArray(winnerPlayer.cards) && winnerPlayer.cards[0] !== '??'
                ? (winnerPlayer.cards as Card[])
                : null

              return (
                <div
                  key={i}
                  className="relative rounded-xl overflow-hidden transition-all duration-700"
                  style={{
                    opacity: show ? 1 : 0,
                    transform: show ? 'translateY(0)' : 'translateY(12px)',
                    transitionDelay: `${300 + i * 150}ms`,
                  }}
                >
                  {/* Card background */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,165,0,0.04) 100%)' }}
                  />
                  <div className="absolute inset-0 border border-[#FFD700]/15 rounded-xl" />

                  <div className="relative z-10 p-5 flex items-center justify-between">
                    {/* Left: Name + hand + chips */}
                    <div className="flex flex-col gap-1.5">
                      <p className="font-pixel text-[11px] sm:text-[13px] text-white tracking-[2px] font-bold">
                        {name.toUpperCase()}
                      </p>
                      <p className="font-pixel text-[7px] sm:text-[8px] text-[#00FFFF]/80 tracking-wider">
                        {w.handName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <img src="/images/coin.png" alt="" className="w-5 h-5 object-contain" draggable={false} />
                        <p className="font-pixel text-[13px] sm:text-[15px] text-[#FFD700] font-bold tabular-nums"
                          style={{ textShadow: '0 0 12px rgba(255,215,0,0.5)' }}
                        >
                          <AnimatedChips amount={w.amount} />
                        </p>
                      </div>
                    </div>

                    {/* Right: Winner's cards */}
                    {winnerCards && (
                      <div className="flex gap-2">
                        {winnerCards.map((c, ci) => (
                          <div key={ci} className="relative animate-deal" style={{ animationDelay: `${600 + ci * 150}ms` }}>
                            <img
                              src={getCardImagePath(c)}
                              alt={`${c.rank} of ${c.suit}`}
                              className="rounded-lg border border-[#FFD700]/20 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                              style={{ width: 56, height: 78 }}
                              draggable={false}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Other players' hands (non-folded, non-winner) ── */}
          {(() => {
            const winnerIds = new Set(winners.map(w => w.playerId))
            const otherPlayers = players.filter(
              p => !winnerIds.has(p.id) && !p.folded && Array.isArray(p.cards) && p.cards.length > 0 && p.cards[0] !== '??'
            )
            if (otherPlayers.length === 0) return null

            return (
              <div className="px-6 mt-4 pt-4 border-t border-white/5 space-y-2">
                <p className="font-pixel text-[6px] text-white/25 tracking-[2px] mb-2">REVEALED HANDS</p>
                {otherPlayers.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1">
                    <span className="font-pixel text-[8px] text-white/50 tracking-wider">{p.name.toUpperCase()}</span>
                    <div className="flex gap-1.5">
                      {(p.cards as Card[]).map((c, i) => (
                        <img
                          key={i}
                          src={getCardImagePath(c)}
                          alt={`${c.rank} of ${c.suit}`}
                          className="rounded-md border border-white/10 shadow-md"
                          style={{ width: 40, height: 56 }}
                          draggable={false}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── Continue button ── */}
          <div className="p-4 sm:p-6 pt-5" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
            <button
              onClick={onClose}
              className="group relative w-full py-3.5 rounded-xl overflow-hidden font-pixel text-[10px] sm:text-[11px] tracking-[3px]
                transition-all duration-200 active:scale-[0.97] hover:scale-[1.01]"
            >
              {/* Button gradient bg */}
              <div className="absolute inset-0 transition-all duration-300"
                style={{
                  background: 'linear-gradient(180deg, #FFD700 0%, #F0A500 50%, #E08900 100%)',
                }}
              />
              {/* Hover shine */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(180deg, #FFE44D 0%, #FFB700 50%, #F09800 100%)',
                }}
              />
              {/* Subtle inner shadow */}
              <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),_inset_0_-1px_0_rgba(0,0,0,0.15)] rounded-xl" />

              <span className="relative z-10 text-[#1a0a2e] font-bold">
                CONTINUE
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
