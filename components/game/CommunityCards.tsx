'use client'

import { memo, useRef, useEffect } from 'react'
import type { Card } from '@/types/poker'

function getCardImagePath(card: Card): string {
  return `/images/cards/${card.rank}_${card.suit}.png`
}

function cardKey(card: Card): string {
  return `${card.rank}_${card.suit}`
}

interface Props {
  cards: Card[]
}

export const CommunityCards = memo(function CommunityCards({ cards }: Props) {
  const slots = Array(5).fill(null).map((_, i) => cards[i] ?? null)

  // Track which cards have already animated
  const animatedRef = useRef<Set<string>>(new Set())

  const animationState = slots.map((card) => {
    if (!card) return false
    const key = cardKey(card)
    return animatedRef.current.has(key) // true = skip animation
  })

  useEffect(() => {
    cards.forEach((card) => {
      animatedRef.current.add(cardKey(card))
    })
  }, [cards])

  // Reset when cards are cleared (new round)
  useEffect(() => {
    if (cards.length === 0) {
      animatedRef.current.clear()
    }
  }, [cards.length])

  return (
    <div className="flex gap-1.5 sm:gap-3.5 justify-center">
      {slots.map((card, i) => {
        if (card) {
          const skip = animationState[i]
          return (
            <div
              key={`${card.rank}_${card.suit}`}
              className={skip ? '' : 'animate-deal'}
              style={skip ? undefined : { animationDelay: `${i * 80}ms` }}
            >
              <img
                src={getCardImagePath(card)}
                alt={`${card.rank} of ${card.suit}`}
                className="w-[46px] h-[64px] sm:w-[72px] sm:h-[101px] lg:w-[80px] lg:h-[112px] rounded-lg sm:rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.65),_0_0_12px_rgba(255,215,0,0.15)] border sm:border-2 border-white/10 will-change-transform"
                draggable={false}
              />
            </div>
          )
        }
        return (
          <div
            key={`empty-${i}`}
            className="w-[46px] h-[64px] sm:w-[72px] sm:h-[101px] lg:w-[80px] lg:h-[112px] rounded-lg sm:rounded-xl border-2 border-dashed border-[#FFD700]/25 bg-black/35 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]"
          />
        )
      })}
    </div>
  )
})
