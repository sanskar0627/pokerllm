'use client'

import type { ClientPlayer, Card, AIModel } from '@/types/poker'
import { AI_META } from '@/lib/aiMeta'
import { ModelLogo } from '@/components/lobby/LLMSelector'

// ─── Card rendering with real images ─────────────────────────────────────────

function getCardImagePath(card: Card): string {
  return `/images/cards/${card.rank}_${card.suit}.png`
}

function CardFace({ card, delay }: { card: Card | '??'; delay?: number }) {
  if (card === '??') {
    return (
      <div className="animate-deal" style={{ animationDelay: `${delay ?? 0}ms` }}>
        <img
          src="/images/card-back.png"
          alt="Card back"
          className="rounded-md shadow-lg"
          style={{ width: 52, height: 72 }}
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div className="animate-deal" style={{ animationDelay: `${delay ?? 0}ms` }}>
      <img
        src={getCardImagePath(card)}
        alt={`${card.rank} of ${card.suit}`}
        className="rounded-md shadow-lg"
        style={{ width: 52, height: 72 }}
        draggable={false}
      />
    </div>
  )
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots({ dotClass }: { dotClass: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${dotClass}`}
          style={{
            animation: 'bounce-dot 0.6s ease-in-out infinite',
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Player avatar ────────────────────────────────────────────────────────────

// ─── Player avatar ────────────────────────────────────────────────────────────

function Avatar({ player, meta, isSelf, isActive }: {
  player: ClientPlayer
  meta:   (typeof AI_META)[AIModel] | null
  isSelf: boolean
  isActive: boolean
}) {
  const initial = player.name.charAt(0).toUpperCase()

  if (isSelf) {
    return (
      <div className={`w-12 h-12 rounded-full overflow-hidden border-2 border-[#FFD700] transition-all duration-300
        ${isActive ? 'animate-active-avatar-glow ring-4 ring-green-400/35' : 'shadow-[0_0_12px_rgba(255,215,0,0.3)]'}`}>
        <img
          src="/images/avatar-placeholder.png"
          alt={player.name}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  if (meta) {
    return (
      <div className={`w-12 h-12 rounded-full border-2 border-[#FFD700] flex items-center justify-center transition-all duration-300 bg-[#1a0a2e] overflow-hidden
        ${isActive ? 'animate-active-avatar-glow ring-4 ring-green-400/35' : 'shadow-[0_0_12px_rgba(255,215,0,0.2)]'}`}>
        <ModelLogo id={meta.id} />
      </div>
    )
  }

  return (
    <div className={`w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center text-white/60 font-pixel text-[11px] transition-all duration-300 bg-white/5
      ${isActive ? 'animate-active-avatar-glow ring-4 ring-green-400/35' : ''}`}>
      {initial}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  player:     ClientPlayer
  isActive:   boolean
  isDealer:   boolean
  isThinking: boolean
  isSelf:     boolean
  isWinner?:  boolean
}

export function PlayerSeat({ player, isActive, isDealer, isThinking, isSelf, isWinner }: Props) {
  const meta = player.isAI && player.model ? AI_META[player.model] : null

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 transition-all duration-300 overflow-visible
        ${isWinner
          ? 'border-[#FFD700] bg-[rgba(255,215,0,0.12)] shadow-[0_0_24px_rgba(255,215,0,0.25)] animate-winner-glow'
          : isActive
            ? 'border-green-400/60 bg-[rgba(81,46,123,0.95)] shadow-[0_0_16px_rgba(0,255,136,0.15)] scale-103 z-10'
            : isSelf
              ? 'border-[#FFD700]/30 bg-[rgba(81,46,123,0.85)] shadow-md'
              : 'border-white/10 bg-[rgba(81,46,123,0.7)]'
        }
        ${player.folded ? 'opacity-35 scale-95' : ''}`}
      style={{ minWidth: 152, padding: '16px 14px' }}
    >
      {/* Model color top bar */}
      {meta && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FFD700]" />
      )}
      {isSelf && !meta && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFD700] to-[#B8860B]" />
      )}

      {/* Dealer badge */}
      {isDealer && (
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#1a0a2e] border-2 border-[#FFD700] flex items-center justify-center font-pixel text-[8px] text-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.5)] z-20">
          D
        </div>
      )}

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2">
        <Avatar player={player} meta={meta} isSelf={isSelf} isActive={isActive} />
        <div className="text-center">
          <div className={`font-pixel text-[8px] leading-tight ${isSelf ? 'text-[#FFD700]' : meta ? 'text-[#FFD700]' : 'text-white/80'}`}>
            {player.name.toUpperCase()}
          </div>
          {meta && (
            <div className="font-pixel text-[5px] text-[#FFD700]/50 mt-0.5">{meta.company}</div>
          )}
          {isSelf && (
            <div className="font-pixel text-[5px] text-[#FFD700]/60 mt-0.5">YOU</div>
          )}
        </div>
      </div>

      {/* Cards (real images) */}
      <div className="flex gap-1.5 mt-1">
        {player.cards.length > 0
          ? player.cards.map((card, i) => (
              <CardFace key={i} card={card} delay={i * 100} />
            ))
          : (
            <>
              <div className="rounded-md bg-white/5 border border-white/10" style={{ width: 52, height: 72 }} />
              <div className="rounded-md bg-white/5 border border-white/10" style={{ width: 52, height: 72 }} />
            </>
          )
        }
      </div>

      {/* Chips + bet (with coin image) */}
      <div className="flex flex-col items-center gap-1.5 w-full mt-1">
        <div className="flex items-center gap-1.5">
          <img src="/images/coin.png" alt="" className="w-4 h-4 object-contain" draggable={false} />
          <span className="font-pixel text-[8px] text-white/90 tabular-nums">
            {player.stack.toLocaleString()}
          </span>
        </div>
        {player.bet > 0 && (
          <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-full px-2.5 py-0.5 flex items-center gap-1">
            <img src="/images/coin.png" alt="" className="w-3 h-3 object-contain" draggable={false} />
            <span className="font-pixel text-[7px] text-[#FFD700] tabular-nums">
              +{player.bet.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Status badges */}
      {player.folded && (
        <div className="font-pixel text-[7px] text-red-400/60 tracking-[2px] mt-1">FOLDED</div>
      )}

      {isThinking && !player.folded && (
        <div className="flex flex-col items-center gap-1.5 mt-1">
          <ThinkingDots dotClass="bg-[#FFD700]" />
          <span className="font-pixel text-[6px] text-[#FFD700] tracking-wide animate-pulse">THINKING</span>
        </div>
      )}

      {isActive && !isThinking && !player.folded && (
        <div className="font-pixel text-[7px] tracking-[1.5px] text-green-400 animate-pulse mt-1">
          TURN
        </div>
      )}
    </div>
  )
}
