'use client'

interface Props {
  watchOnly: boolean
  onChange:  (watchOnly: boolean) => void
}

const MODES = [
  { watch: false, label: 'PLAY MODE',  sub: 'Take a seat vs the AIs' },
  { watch: true,  label: 'WATCH MODE', sub: 'Spectate AIs battle' },
] as const

export function GameModeToggle({ watchOnly, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="font-pixel text-[10px] text-[#FFD700] uppercase tracking-[2px]">Game Mode</p>

      {/* Segmented control — sliding gold thumb */}
      <div className="relative flex rounded-xl p-1 panel-inset">
        {/* Sliding thumb */}
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
          style={{
            transform: watchOnly ? 'translateX(calc(100% + 0px))' : 'translateX(0)',
            left: 4,
            background: 'linear-gradient(135deg, #FFE27A 0%, #FFD700 45%, #C49630 100%)',
            boxShadow: '0 2px 12px rgba(255,215,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        />
        {MODES.map(mode => {
          const active = watchOnly === mode.watch
          return (
            <button
              key={mode.label}
              onClick={() => onChange(mode.watch)}
              className="relative flex-1 flex flex-col items-center gap-0.5 px-4 py-3 rounded-lg transition-colors duration-300"
            >
              <span className={`font-pixel text-[10px] sm:text-[11px] tracking-wider transition-colors duration-300
                ${active ? 'text-[#1a0a2e] font-bold' : 'text-white/40'}`}>
                {mode.label}
              </span>
              <span className={`font-game text-[10px] sm:text-[11px] transition-colors duration-300 hidden sm:block
                ${active ? 'text-[#1a0a2e]/70' : 'text-white/25'}`}>
                {mode.sub}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
