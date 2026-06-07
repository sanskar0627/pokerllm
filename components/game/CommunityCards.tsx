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
                className="rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.65),_0_0_12px_rgba(255,215,0,0.15)] border-2 border-white/10"
                style={{ width: 72, height: 100 }}
                draggable={false}
              />
            </div>
          )
        }
        return (
          <div
            key={i}
            className="rounded-xl border-2 border-dashed border-[#FFD700]/25 bg-black/35 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]"
            style={{ width: 72, height: 100 }}
          />
        )
      })}
    </div>
  )
}
