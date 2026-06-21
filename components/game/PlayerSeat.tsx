'use client'

import { memo, useRef, useEffect } from 'react'
import type { ClientPlayer, Card, AIModel } from '@/types/poker'
import { AI_META } from '@/lib/aiMeta'
import { ModelLogo } from '@/components/lobby/LLMSelector'

// ─── Card rendering with real images ─────────────────────────────────────────

function getCardImagePath(card: Card): string {
  return `/images/cards/${card.rank}_${card.suit}.png`
}

// Generate a stable key for a card to detect new vs existing cards
function cardKey(card: Card | '??'): string {
  return card === '??' ? 'back' : `${card.rank}_${card.suit}`
}

function CardFace({ card, delay, large, skipAnimation }: { card: Card | '??'; delay?: number; large?: boolean; skipAnimation?: boolean }) {
  const sizeClass = large
    ? 'w-[52px] h-[73px] sm:w-[68px] sm:h-[95px] lg:w-[76px] lg:h-[106px]'
    : 'w-[38px] h-[53px] sm:w-[50px] sm:h-[70px]'

  if (card === '??') {
    return (
      <div className={skipAnimation ? '' : 'animate-deal'} style={skipAnimation ? undefined : { animationDelay: `${delay ?? 0}ms` }}>
        <img
          src="/images/card-back.png"
          alt="Card back"
          className={`rounded-md shadow-lg ${sizeClass} will-change-transform`}
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div className={skipAnimation ? '' : 'animate-deal'} style={skipAnimation ? undefined : { animationDelay: `${delay ?? 0}ms` }}>
      <img
        src={getCardImagePath(card)}
        alt={`${card.rank} of ${card.suit}`}
        className={`rounded-md shadow-lg ${sizeClass} will-change-transform ${large ? 'shadow-[0_2px_12px_rgba(255,215,0,0.25)]' : ''}`}
        draggable={false}
      />
    </div>
  )
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"
          style={{
            animation: 'bounce-dot 0.6s ease-in-out infinite',
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Avatar (circular, 64x64 like Golden-Flop) ──────────────────────────────

function Avatar({ player, meta, isSelf, isActive }: {
  player: ClientPlayer
  meta:   (typeof AI_META)[AIModel] | null
  isSelf: boolean
  isActive: boolean
}) {
  const glowClass = isActive
    ? 'animate-glow-green'
    : ''

  const borderColor = isActive
    ? 'border-green-400'
    : isSelf
      ? 'border-[#FFD700]'
      : meta
        ? 'border-[#FFD700]/70'
        : 'border-white/20'

  if (isSelf) {
    return (
      <div className={`w-11 h-11 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 sm:border-[3px] ${borderColor} transition-all duration-300 ${glowClass}
        shadow-[0_0_16px_rgba(255,215,0,0.3)]`}>
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
      <div className={`w-11 h-11 sm:w-16 sm:h-16 rounded-full border-2 sm:border-[3px] ${borderColor} flex items-center justify-center transition-all duration-300 bg-[#1a0a2e] overflow-hidden ${glowClass}
        shadow-[0_0_12px_rgba(255,215,0,0.2)]`}>
        <ModelLogo id={meta.id} className="w-5 h-5 sm:w-7 sm:h-7" />
      </div>
    )
  }

  return (
    <div className={`w-11 h-11 sm:w-16 sm:h-16 rounded-full border-2 sm:border-[3px] ${borderColor} flex items-center justify-center text-white/60 font-pixel text-[10px] sm:text-[12px] transition-all duration-300 bg-white/5 ${glowClass}`}>
      {player.name.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Chat Bubble — speech bubble above player seat ──────────────────────────

function ChatBubble({ message }: { message: string }) {
  return (
    <div className="absolute -top-14 sm:-top-16 left-1/2 -translate-x-1/2 z-30 animate-chat-bubble-in pointer-events-none">
      <div className="relative bg-[rgba(255,255,255,0.95)] text-[#1a0a2e] rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3)] max-w-[160px] sm:max-w-[200px]">
        <p className="font-pixel text-[5px] sm:text-[6px] leading-snug text-center break-words">
          {message}
        </p>
        {/* Speech bubble tail */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0
          border-l-[6px] border-l-transparent
          border-r-[6px] border-r-transparent
          border-t-[6px] border-t-[rgba(255,255,255,0.95)]" />
      </div>
    </div>
  )
}

// ─── Main component (Golden-Flop SeatSlot style) ────────────────────────────

interface Props {
  player:       ClientPlayer
  isActive:     boolean
  isDealer:     boolean
  isThinking:   boolean
  isSelf:       boolean
  isWinner?:    boolean
  chatMessage?: string
  watchOnly?:   boolean
}

export const PlayerSeat = memo(function PlayerSeat({ player, isActive, isDealer, isThinking, isSelf, isWinner, chatMessage, watchOnly }: Props) {
  const meta = player.isAI && player.model ? AI_META[player.model] : null

  // Track which cards have already been animated to avoid re-triggering on re-render
  const animatedCardsRef = useRef<Set<string>>(new Set())

  // Determine which cards need animation (only new ones)
  const cardAnimationState = player.cards.map((card) => {
    const key = cardKey(card)
    if (animatedCardsRef.current.has(key)) {
      return true // skip animation — already shown
    }
    return false // needs animation
  })

  // Mark cards as animated after first render
  useEffect(() => {
    player.cards.forEach((card) => {
      animatedCardsRef.current.add(cardKey(card))
    })
  }, [player.cards])

  // Reset animated cards when player folds or new round starts (no cards)
  useEffect(() => {
    if (player.cards.length === 0) {
      animatedCardsRef.current.clear()
    }
  }, [player.cards.length])

  return (
    <div
      className={`relative flex flex-col items-center gap-1 transition-all duration-200
        ${player.folded ? 'opacity-30 scale-90' : ''}
        ${isWinner ? 'scale-105' : ''}`}
    >
      {/* Chat bubble — shows above the seat when AI says something */}
      {chatMessage && <ChatBubble message={chatMessage} />}

      {/* Avatar with dealer badge */}
      <div className="relative">
        <Avatar player={player} meta={meta} isSelf={isSelf} isActive={isActive} />

        {/* Dealer badge — small "D" chip on top-right */}
        {isDealer && (
          <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#1a0a2e] border-[1.5px] sm:border-2 border-[#FFD700] flex items-center justify-center font-pixel text-[6px] sm:text-[7px] text-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.5)] z-20">
            D
          </div>
        )}

        {/* Winner glow ring */}
        {isWinner && (
          <div className="absolute inset-[-4px] rounded-full border-2 border-[#FFD700] animate-winner-glow pointer-events-none" />
        )}
      </div>

      {/* Cards — shown overlapping slightly under avatar */}
      {player.cards.length > 0 && (
        <div className={`flex -mt-1 ${(isSelf || watchOnly) ? 'gap-1.5 sm:gap-2' : 'gap-1'}`}>
          {player.cards.map((card, i) => (
            <CardFace key={i} card={card} delay={i * 100} large={isSelf || !!watchOnly} skipAnimation={cardAnimationState[i]} />
          ))}
        </div>
      )}

      {/* Info pill — name, chips, bet (compact panel below) */}
      <div className={`flex flex-col items-center gap-0.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition-colors
        ${isWinner
          ? 'bg-[rgba(255,215,0,0.15)] border-[#FFD700]/50 shadow-[0_0_16px_rgba(255,215,0,0.3)]'
          : isActive
            ? 'bg-[rgba(0,255,136,0.08)] border-green-400/40'
            : isSelf
              ? 'bg-[rgba(81,46,123,0.9)] border-[#FFD700]/30'
              : 'bg-[rgba(81,46,123,0.85)] border-white/10'
        }`}
      >
        {/* Name */}
        <span className={`font-pixel text-[7px] leading-tight tracking-wide
          ${isSelf ? 'text-[#FFD700]' : meta ? 'text-[#FFD700]/90' : 'text-white/80'}`}>
          {player.name.toUpperCase()}
          {isSelf && <span className="text-[#FFD700]/50 ml-1">(YOU)</span>}
        </span>

        {/* Chips */}
        <div className="flex items-center gap-1">
          <img src="/images/coin.png" alt="" className="w-3.5 h-3.5 object-contain" draggable={false} />
          <span className="font-pixel text-[7px] text-white/90 tabular-nums">
            {player.stack.toLocaleString()}
          </span>
        </div>

        {/* Current bet */}
        {player.bet > 0 && (
          <div className="flex items-center gap-1 bg-[#FFD700]/10 rounded-full px-2 py-0.5">
            <img src="/images/coin.png" alt="" className="w-2.5 h-2.5 object-contain" draggable={false} />
            <span className="font-pixel text-[6px] text-[#FFD700] tabular-nums">
              +{player.bet.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Status badges */}
      {player.folded && (
        <span className="font-pixel text-[6px] text-red-400/70 tracking-[2px]">FOLDED</span>
      )}

      {isThinking && !player.folded && (
        <div className="flex flex-col items-center gap-1">
          <ThinkingDots />
          <span className="font-pixel text-[5px] text-[#FFD700] tracking-wide animate-pulse">THINKING</span>
        </div>
      )}

      {isActive && !isThinking && !player.folded && (
        <span className="font-pixel text-[6px] tracking-[1.5px] text-green-400 animate-pulse">
          TURN
        </span>
      )}
    </div>
  )
})
