'use client'

interface Props {
  pot:        number
  currentBet: number
  phase:      string
  roundNumber?: number
}

export function PotDisplay({ pot, currentBet, phase, roundNumber }: Props) {
  const phaseLabel = phase.toUpperCase()

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phase badge */}
      <div className="flex items-center gap-4">
        <div className="bg-[#FFD700]/15 border-2 border-[#FFD700]/50 rounded-xl px-5 py-2 shadow-[0_0_12px_rgba(255,215,0,0.25)]">
          <span className="font-pixel text-[9px] text-[#FFD700] tracking-[2px] font-bold">{phaseLabel}</span>
        </div>
        {roundNumber && (
          <span className="font-pixel text-[8px] text-white/35">ROUND {roundNumber}</span>
        )}
      </div>

      {/* Pot amount */}
      <div className="bg-black/60 border-2 border-[#FFD700]/55 rounded-full px-8 py-3.5 flex items-center gap-3
                      shadow-[0_0_32px_rgba(255,215,0,0.3),_inset_0_2px_8px_rgba(0,0,0,0.5)]">
        <img src="/images/coin.png" alt="" className="w-8 h-8 object-contain" draggable={false} />
        <span className="font-pixel text-[18px] text-[#FFD700] tabular-nums drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]">
          {pot.toLocaleString()}
        </span>
      </div>

      {/* Current bet */}
      {currentBet > 0 && (
        <div className="flex items-center gap-2.5 bg-black/45 border border-[#00FFFF]/35 px-4.5 py-1 rounded-full shadow-md animate-fade-up">
          <span className="font-pixel text-[7px] text-[#00FFFF]/70 tracking-wider">TO CALL</span>
          <span className="font-pixel text-[9px] text-[#00FFFF] tabular-nums font-bold">{currentBet.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
