'use client'

import type { ClientPlayer, Card, AIModel } from '@/types/poker'
import { AI_META } from '@/lib/aiMeta'

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

function Avatar({ player, meta, isSelf }: {
  player: ClientPlayer
  meta:   (typeof AI_META)[AIModel] | null
  isSelf: boolean
}) {
  const initial = player.name.charAt(0).toUpperCase()

  if (isSelf) {
    return (
      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#FFD700]/60 shadow-[0_0_12px_rgba(255,215,0,0.4)]">
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
      <div className={`w-11 h-11 rounded-full ${meta.bg} border-2 border-white/20 flex items-center justify-center text-white font-pixel text-[10px] shadow-lg ${meta.shadow}`}>
        {initial}
      </div>
    )
  }

  return (
    <div className="w-11 h-11 rounded-full bg-white/10 border-2 border-white/15 flex items-center justify-center text-white/60 font-pixel text-[10px]">
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
      className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${isWinner ? 'animate-winner border-[#FFD700] bg-[#FFD700]/10' : ''}
        ${isActive && !isWinner
          ? meta
            ? `${meta.activeBorder} animate-pulse-glow bg-[rgba(81,46,123,0.95)]`
            : 'border-[#FFD700] animate-pulse-glow bg-[rgba(81,46,123,0.95)]'
          : !isWinner
            ? isSelf
              ? 'border-[#FFD700]/30 bg-[rgba(81,46,123,0.85)]'
              : 'border-white/10 bg-[rgba(81,46,123,0.7)]'
            : ''
        }
        ${player.folded ? 'opacity-40 scale-95' : ''}
        ${isActive && !player.folded ? 'scale-105 z-10' : ''}`}
      style={{ minWidth: 152, padding: '16px 14px' }}
    >
      {/* Model colour top bar */}
      {meta && (
        <div className={`absolute top-0 left-0 right-0 h-1 ${meta.bg}`} />
      )}
      {isSelf && !meta && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFD700] to-[#B8860B]" />
      )}

      {/* Dealer badge */}
      {isDealer && (
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#FFD700] border-2 border-[#1a0a2e] flex items-center justify-center font-pixel text-[8px] text-[#1a0a2e] shadow-[0_0_12px_rgba(255,215,0,0.6)] z-20">
          D
        </div>
      )}

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-1.5">
        <Avatar player={player} meta={meta} isSelf={isSelf} />
        <div className="text-center">
          <div className={`font-pixel text-[8px] leading-tight ${isSelf ? 'text-[#FFD700]' : meta ? meta.text : 'text-white/80'}`}>
            {player.name.toUpperCase()}
          </div>
          {meta && (
            <div className="font-pixel text-[5px] text-white/30 mt-0.5">{meta.company}</div>
          )}
          {isSelf && (
            <div className="font-pixel text-[5px] text-[#FFD700]/60 mt-0.5">YOU</div>
          )}
        </div>
      </div>

      {/* Cards (real images) */}
      <div className="flex gap-1.5">
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
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="flex items-center gap-1.5">
          <img src="/images/coin.png" alt="" className="w-4 h-4" draggable={false} />
          <span className="font-pixel text-[8px] text-white/80 tabular-nums">
            {player.stack.toLocaleString()}
          </span>
        </div>
        {player.bet > 0 && (
          <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-full px-2.5 py-0.5 flex items-center gap-1">
            <img src="/images/coin.png" alt="" className="w-3 h-3" draggable={false} />
            <span className="font-pixel text-[7px] text-[#FFD700] tabular-nums">
              +{player.bet.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Status badges */}
      {player.folded && (
        <div className="font-pixel text-[7px] text-red-400/60 tracking-[2px]">FOLDED</div>
      )}

      {isThinking && !player.folded && (
        <div className="flex flex-col items-center gap-1.5">
          <ThinkingDots dotClass={meta?.dot ?? 'bg-[#FFD700]'} />
          <span className={`font-pixel text-[6px] ${meta?.text ?? 'text-[#FFD700]'}`}>THINKING</span>
        </div>
      )}

      {isActive && !isThinking && !player.folded && (
        <div className={`font-pixel text-[7px] tracking-[1px] ${meta ? meta.text : 'text-[#FFD700]'} animate-pulse`}>
          TURN
        </div>
      )}
    </div>
  )
}
