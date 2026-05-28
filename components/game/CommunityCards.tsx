'use client'

import type { Card } from '@/types/poker'

function getCardImagePath(card: Card): string {
  return `/images/cards/${card.rank}_${card.suit}.png`
}

interface Props {
  cards: Card[]
}

export function CommunityCards({ cards }: Props) {
  const slots = Array(5).fill(null).map((_, i) => cards[i] ?? null)

  return (
    <div className="flex gap-3 justify-center">
      {slots.map((card, i) => {
        if (card) {
          return (
            <div
              key={i}
              className="animate-deal"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <img
                src={getCardImagePath(card)}
                alt={`${card.rank} of ${card.suit}`}
                className="rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
                style={{ width: 72, height: 100 }}
                draggable={false}
              />
            </div>
          )
        }
        return (
          <div
            key={i}
            className="rounded-lg border-2 border-dashed border-[#FFD700]/15 bg-white/5"
            style={{ width: 72, height: 100 }}
          />
        )
      })}
    </div>
  )
}
