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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-[rgba(26,10,46,0.96)] border-[3px] border-[#FFD700] rounded-2xl overflow-hidden max-w-md w-full
                      shadow-[0_0_48px_rgba(255,215,0,0.45)] animate-fade-up">
        {/* Gold top bar */}
        <div className="w-full h-1 bg-[#FFD700]" />

        <div className="p-6 space-y-5">
          {/* Title */}
          <h2 className="font-pixel text-[12px] sm:text-[14px] text-center text-[#FFD700] tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {winners.length > 1 ? 'SPLIT POT' : 'WINNER'}
          </h2>

          {/* Divider */}
          <div className="w-3/4 h-px bg-[#FFD700]/25 mx-auto" />

          {/* Winner cards */}
          <div className="space-y-3">
            {winners.map((w, i) => (
              <div key={i} className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-xl p-4 text-center space-y-2 animate-winner shadow-md">
                <p className="font-pixel text-[10px] text-white tracking-[1.5px] font-bold">
                  {playerName(w.playerId).toUpperCase()}
                </p>
                <p className="font-pixel text-[7px] text-[#00FFFF]">{w.handName}</p>
                <div className="flex items-center justify-center gap-1.5">
                  <img src="/images/coin.png" alt="" className="w-5 h-5 object-contain" draggable={false} />
                  <p className="font-pixel text-[11px] text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.4)] font-bold">
                    +{w.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* All revealed hands (real card images) */}
          <div className="space-y-3.5 border-t border-[#FFD700]/20 pt-4">
            {players
              .filter(p => !p.folded && Array.isArray(p.cards) && p.cards.length > 0 && p.cards[0] !== '??')
              .map(p => (
                <div key={p.id} className="flex items-center justify-between font-pixel text-[7px] tracking-wide">
                  <span className="text-white/60 font-semibold">{p.name.toUpperCase()}</span>
                  <div className="flex gap-1">
                    {(p.cards as Card[]).map((c, i) => (
                      <img
                        key={i}
                        src={getCardImagePath(c)}
                        alt={`${c.rank} of ${c.suit}`}
                        className="rounded-md border border-white/10"
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
            className="relative w-full h-12 overflow-hidden rounded-xl active:scale-[0.97] hover:scale-[1.01] hover:brightness-105 duration-200 transition-all shadow-md"
          >
            <img
              src="/images/buttons/play-btn.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <span className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] text-[#FFD700] tracking-[2px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              CONTINUE
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
