'use client'

interface Props {
  watchOnly: boolean
  onChange:  (watchOnly: boolean) => void
}

export function GameModeToggle({ watchOnly, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="font-pixel text-[10px] text-[#FFD700] uppercase tracking-[2px]">Game Mode</p>
      <div className="flex rounded-xl overflow-hidden border-[3px] border-[#FFD700]/30 bg-black/40">
        <button
          onClick={() => onChange(false)}
          className={`flex-1 px-5 py-3.5 font-pixel text-[11px] tracking-wider transition-all duration-200
            ${!watchOnly
              ? 'bg-[#FFD700] text-[#1a0a2e] shadow-[0_0_16px_rgba(255,215,0,0.35)] font-bold'
              : 'bg-transparent text-white/40 hover:text-white/70'}`}
        >
          PLAY Mode
        </button>
        <button
          onClick={() => onChange(true)}
          className={`flex-1 px-5 py-3.5 font-pixel text-[11px] tracking-wider transition-all duration-200
            ${watchOnly
              ? 'bg-[#FFD700] text-[#1a0a2e] shadow-[0_0_16px_rgba(255,215,0,0.35)] font-bold'
              : 'bg-transparent text-white/40 hover:text-white/70'}`}
        >
          WATCH Mode
        </button>
      </div>
    </div>
  )
}
