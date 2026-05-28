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
        <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg px-4 py-1.5">
          <span className="font-pixel text-[9px] text-[#FFD700] tracking-[2px]">{phaseLabel}</span>
        </div>
        {roundNumber && (
          <span className="font-pixel text-[8px] text-white/30">ROUND {roundNumber}</span>
        )}
      </div>

      {/* Pot amount */}
      <div className="bg-black/40 border-2 border-[#FFD700]/40 rounded-full px-8 py-3 flex items-center gap-3
                      shadow-[0_0_24px_rgba(255,215,0,0.2)]">
        <img src="/images/coin.png" alt="" className="w-7 h-7" draggable={false} />
        <span className="font-pixel text-[18px] text-[#FFD700] tabular-nums drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
          {pot.toLocaleString()}
        </span>
      </div>

      {/* Current bet */}
      {currentBet > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[8px] text-[#00FFFF]/60">TO CALL</span>
          <span className="font-pixel text-[10px] text-[#00FFFF]">{currentBet.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
