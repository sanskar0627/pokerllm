'use client'

interface BlindPreset {
  label:   string
  sb:      number
  bb:      number
  stack:   number
  bbDepth: number
  tag?:    string
}

const BLIND_PRESETS: BlindPreset[] = [
  { label: 'MICRO',       sb: 25,  bb: 50,   stack: 5_000,  bbDepth: 100 },
  { label: 'STANDARD',    sb: 100, bb: 200,  stack: 10_000, bbDepth: 50, tag: 'default' },
  { label: 'DEEP STACK',  sb: 100, bb: 200,  stack: 20_000, bbDepth: 100 },
  { label: 'HIGH',        sb: 250, bb: 500,  stack: 25_000, bbDepth: 50  },
  { label: 'HIGH ROLLER', sb: 500, bb: 1000, stack: 50_000, bbDepth: 50  },
]

interface Props {
  startingStack: number
  smallBlind:    number
  bigBlind:      number
  onStackChange: (stack: number, sb: number, bb: number) => void
}

export function PlayerSetup({
  startingStack, smallBlind, bigBlind, onStackChange,
}: Props) {
  const activePreset = BLIND_PRESETS.find(
    p => p.stack === startingStack && p.sb === smallBlind && p.bb === bigBlind
  )

  return (
    <div className="space-y-5">
      {/* Stack + Blind presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="font-pixel text-[10px] text-[#FFD700] uppercase tracking-[2px]">
            Chips & Blinds
          </label>
          <span className="font-pixel text-[8px] text-white/40">
            {startingStack.toLocaleString()} &middot; {smallBlind}/{bigBlind} &middot;{' '}
            <span className="text-[#FFD700]">{Math.floor(startingStack / bigBlind)} BB</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {BLIND_PRESETS.map(preset => {
            const isActive = activePreset?.label === preset.label
            return (
              <button
                key={preset.label}
                onClick={() => onStackChange(preset.stack, preset.sb, preset.bb)}
                className={`relative flex flex-col items-center gap-1.5 px-4 py-3.5 rounded-xl border transition-all duration-200 overflow-hidden active:scale-[0.98]
                  ${isActive
                    ? 'bg-[#FFD700]/10 border-[#FFD700]/70 text-white shadow-[0_0_20px_rgba(255,215,0,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'panel-inset text-white/40 hover:border-[#FFD700]/35 hover:text-white/60 hover:-translate-y-px'
                  }`}
              >
                {/* Shimmer on active */}
                {isActive && (
                  <div className="absolute inset-0 animate-shimmer pointer-events-none">
                    <div className="w-[200px] h-full bg-gradient-to-r from-transparent via-[#FFD700]/15 to-transparent" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[9px] tracking-wide font-bold">{preset.label}</span>
                  {preset.tag === 'default' && (
                    <span className="text-[6px] bg-[#FFD700]/20 text-[#FFD700] px-2 py-0.5 rounded border border-[#FFD700]/40 font-pixel">
                      REC
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[8px] font-pixel">
                  <span className="text-[#00FFFF]">{preset.sb}/{preset.bb}</span>
                  <span className={isActive ? 'text-white' : 'text-white/50'}>
                    {preset.stack.toLocaleString()}
                  </span>
                  <span className="text-white/20">{preset.bbDepth}BB</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { BLIND_PRESETS }
export type { BlindPreset }
