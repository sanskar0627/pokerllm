'use client'

interface Props {
  pot:        number
  currentBet: number
  phase:      string
  roundNumber?: number
  bigBlind?:    number
}

// Golden-Flop style: stack 1-5 coins based on pot/BB ratio
function CoinStack({ pot, bigBlind }: { pot: number; bigBlind: number }) {
  const ratio = bigBlind > 0 ? pot / bigBlind : 0
  let coinCount = 1
  if (ratio >= 20) coinCount = 5
  else if (ratio >= 10) coinCount = 4
  else if (ratio >= 5) coinCount = 3
  else if (ratio >= 2) coinCount = 2

  return (
    <div className="relative flex items-end justify-center" style={{ width: 40, height: 48 }}>
      {Array.from({ length: coinCount }).map((_, i) => (
        <img
          key={i}
          src="/images/coin.png"
          alt=""
          className="absolute w-8 h-8 object-contain animate-coin-bounce"
          style={{
            bottom: i * 6,
            animationDelay: `${i * 60}ms`,
            zIndex: coinCount - i,
          }}
          draggable={false}
        />
      ))}
    </div>
  )
}

export function PotDisplay({ pot, currentBet, phase, roundNumber, bigBlind = 200 }: Props) {
  const phaseLabel = phase.toUpperCase()

  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* Phase badge — gold on purple panel like Golden-Flop */}
      <div className="flex items-center gap-3">
        <div className="bg-[rgba(81,46,123,0.92)] border-2 border-[#FFD700]/50 rounded-xl px-3 sm:px-5 py-1.5 sm:py-2 shadow-[0_0_16px_rgba(255,215,0,0.2)]">
          <span className="font-pixel text-[7px] sm:text-[9px] text-[#FFD700] tracking-[2px] sm:tracking-[3px] font-bold">{phaseLabel}</span>
        </div>
        {roundNumber && (
          <span className="font-pixel text-[6px] sm:text-[7px] text-white/30">RD {roundNumber}</span>
        )}
      </div>

      {/* Pot + To Call — side by side */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Pot display */}
        <div className="flex items-center gap-2 sm:gap-3 bg-black/55 border-2 border-[#FFD700]/50 rounded-full px-4 sm:px-6 py-2 sm:py-3
                        shadow-[0_0_28px_rgba(255,215,0,0.25),_inset_0_2px_8px_rgba(0,0,0,0.5)]">
          <CoinStack pot={pot} bigBlind={bigBlind} />
          <div className="flex flex-col items-start">
            <span className="font-pixel text-[5px] sm:text-[6px] text-[#FFD700]/60 tracking-wider">POT</span>
            <span className="font-pixel text-[12px] sm:text-[16px] text-[#FFD700] tabular-nums drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
              {pot.toLocaleString()}
            </span>
          </div>
        </div>

        {/* To Call — beside pot */}
        {currentBet > 0 && (
          <div className="flex items-center gap-2 bg-black/55 border-2 border-[#00FFFF]/40 rounded-full px-4 sm:px-5 py-2 sm:py-3
                          shadow-[0_0_16px_rgba(0,255,255,0.15),_inset_0_2px_8px_rgba(0,0,0,0.5)] animate-fade-up">
            <div className="flex flex-col items-start">
              <span className="font-pixel text-[5px] sm:text-[6px] text-[#00FFFF]/60 tracking-wider">TO CALL</span>
              <span className="font-pixel text-[12px] sm:text-[16px] text-[#00FFFF] tabular-nums font-bold drop-shadow-[0_0_10px_rgba(0,255,255,0.4)]">
                {currentBet.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
