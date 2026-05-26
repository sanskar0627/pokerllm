'use client'

interface Props {
  watchOnly: boolean
  onChange:  (watchOnly: boolean) => void
}

export function GameModeToggle({ watchOnly, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="font-game font-semibold text-[14px] text-[#FFD700] uppercase tracking-[2px]">Game Mode</p>
      <div className="flex rounded-xl overflow-hidden border-2 border-[#FFD700]/40">
        <button
          onClick={() => onChange(false)}
          className={`flex-1 px-5 py-3 font-game font-bold text-[15px] tracking-wider transition-all duration-200
            ${!watchOnly
              ? 'bg-[#FFD700] text-[#1a0a2e] shadow-[0_0_16px_rgba(255,215,0,0.4)]'
              : 'bg-transparent text-white/50 hover:text-white/80'}`}
        >
          PLAY
        </button>
        <button
          onClick={() => onChange(true)}
          className={`flex-1 px-5 py-3 font-game font-bold text-[15px] tracking-wider transition-all duration-200
            ${watchOnly
              ? 'bg-[#FFD700] text-[#1a0a2e] shadow-[0_0_16px_rgba(255,215,0,0.4)]'
              : 'bg-transparent text-white/50 hover:text-white/80'}`}
        >
          WATCH
        </button>
      </div>
    </div>
  )
}
