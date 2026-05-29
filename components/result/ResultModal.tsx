'use client'

import type { WinnerInfo, ClientPlayer, Card } from '@/types/poker'

function getCardImagePath(card: Card): string {
  return `/images/cards/${card.rank}_${card.suit}.png`
}

interface Props {
  winners: WinnerInfo[]
  players: ClientPlayer[]
  onClose: () => void
}

export function ResultModal({ winners, players, onClose }: Props) {
  function playerName(id: string) {
    return players.find(p => p.id === id)?.name ?? id
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a0a2e] border-2 border-[#FFD700] rounded-2xl overflow-hidden max-w-md w-full
                      shadow-[0_0_48px_rgba(255,215,0,0.3)]">
        {/* Gold top bar */}
        <div className="w-full h-1 bg-[#FFD700]" />

        <div className="p-6 space-y-5">
          {/* Title */}
          <h2 className="font-pixel text-[14px] text-center text-[#FFD700] tracking-[2px] drop-shadow-[0_0_16px_rgba(255,215,0,0.5)]">
            {winners.length > 1 ? 'SPLIT POT' : 'WINNER'}
          </h2>

          {/* Divider */}
          <div className="w-3/4 h-px bg-[#FFD700]/25 mx-auto" />

          {/* Winner cards */}
          <div className="space-y-3">
            {winners.map((w, i) => (
              <div key={i} className="bg-[#FFD700]/5 border border-[#FFD700]/20 rounded-xl p-4 text-center space-y-2 animate-winner">
                <p className="font-pixel text-[11px] text-white tracking-[1px]">
                  {playerName(w.playerId).toUpperCase()}
                </p>
                <p className="font-pixel text-[8px] text-[#00FFFF]">{w.handName}</p>
                <div className="flex items-center justify-center gap-1">
                  <img src="/images/coin.png" alt="" className="w-5 h-5" draggable={false} />
                  <p className="font-pixel text-[12px] text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
                    +{w.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* All revealed hands (real card images) */}
          <div className="space-y-2">
            {players
              .filter(p => !p.folded && Array.isArray(p.cards) && p.cards.length > 0 && p.cards[0] !== '??')
              .map(p => (
                <div key={p.id} className="flex items-center justify-between font-pixel text-[7px]">
                  <span className="text-white/60">{p.name.toUpperCase()}</span>
                  <div className="flex gap-1">
                    {(p.cards as Card[]).map((c, i) => (
                      <img
                        key={i}
                        src={getCardImagePath(c)}
                        alt={`${c.rank} of ${c.suit}`}
                        className="rounded-sm"
                        style={{ width: 28, height: 40 }}
                        draggable={false}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Continue button (real button image) */}
          <button
            onClick={onClose}
            className="relative w-full overflow-hidden rounded-xl active:scale-[0.98] transition-all hover:brightness-110"
          >
            <img
              src="/images/buttons/play-btn.png"
              alt=""
              className="w-full h-12 object-cover rounded-xl"
              draggable={false}
            />
            <span className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] text-[#FFD700] tracking-[2px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              CONTINUE
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
