'use client'

import { useRouter } from 'next/navigation'
import type { ClientPlayer } from '@/types/poker'

interface Props {
  players: ClientPlayer[]
  playerId: string
}

export function GameOverModal({ players, playerId }: Props) {
  const router = useRouter()

  // Sort players by final stack to show final rankings
  const standings = [...players].sort((a, b) => b.stack - a.stack)
  const winner = standings[0]
  const isSelfWinner = winner?.id === playerId
  const isWatchMode = !players.some(p => p.id === playerId)

  let title = "TOURNAMENT COMPLETE"
  let subtitle = `${winner?.name} has won all the chips!`
  let headingColor = "text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.5)]"

  if (!isWatchMode) {
    if (isSelfWinner) {
      title = "VICTORY!"
      subtitle = "You defeated the neural networks and took all the chips!"
      headingColor = "text-green-400 drop-shadow-[0_0_16px_rgba(34,197,94,0.6)]"
    } else {
      title = "DEFEATED"
      subtitle = "The machines outsmarted you. Better luck next time!"
      headingColor = "text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]"
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="bg-[rgba(26,10,46,0.96)] border-[3px] border-[#FFD700] rounded-2xl overflow-hidden max-w-md w-full
                      shadow-[0_0_48px_rgba(255,215,0,0.4)] animate-fade-up">
        {/* Decorative gold line */}
        <div className="w-full h-1 bg-[#FFD700]" />

        <div className="p-8 flex flex-col items-center text-center space-y-6">
          {/* Trophy Icon */}
          <div className="relative w-20 h-20 flex items-center justify-center bg-[#FFD700]/10 rounded-full border border-[#FFD700]/30 shadow-inner">
            <span className="text-[40px] animate-float select-none">🏆</span>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className={`font-pixel text-[16px] sm:text-[20px] tracking-[4px] font-bold ${headingColor}`}>
              {title}
            </h2>
            <p className="font-game text-[13px] text-white/70 px-4 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Standings list */}
          <div className="w-full bg-black/45 border border-white/10 rounded-xl p-4.5 space-y-3">
            <p className="font-pixel text-[8px] text-[#FFD700] uppercase tracking-[2px] border-b border-white/10 pb-2 text-left">
              Final Standings
            </p>
            {standings.map((p, idx) => {
              const isSelf = p.id === playerId
              return (
                <div key={p.id} className="flex items-center justify-between font-pixel text-[8px] tracking-wide py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white/35">#{idx + 1}</span>
                    <span className={isSelf ? "text-[#FFD700] font-bold" : "text-white/80"}>
                      {p.name.toUpperCase()} {isSelf && "(YOU)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <img src="/images/coin.png" alt="" className="w-4 h-4 object-contain" />
                    <span className="text-white/95 font-bold tabular-nums">
                      {p.stack.toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Return to Lobby button */}
          <button
            onClick={() => router.push('/')}
            className="relative w-full h-13 overflow-hidden rounded-xl active:scale-[0.97] hover:scale-[1.01] hover:brightness-105 duration-200 transition-all shadow-lg"
          >
            <img
              src="/images/buttons/play-btn.png"
              alt="Lobby"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <span className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] text-[#FFD700] tracking-[2px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              RETURN TO LOBBY
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
