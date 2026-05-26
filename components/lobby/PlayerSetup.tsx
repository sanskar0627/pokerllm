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
  name:          string
  startingStack: number
  smallBlind:    number
  bigBlind:      number
  onNameChange:  (name: string) => void
  onStackChange: (stack: number, sb: number, bb: number) => void
}

export function PlayerSetup({
  name, startingStack, smallBlind, bigBlind,
  onNameChange, onStackChange,
}: Props) {
  const activePreset = BLIND_PRESETS.find(
    p => p.stack === startingStack && p.sb === smallBlind && p.bb === bigBlind
  )

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-2">
        <label className="font-game font-semibold text-[14px] text-[#FFD700] uppercase tracking-[2px]">
          Your Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Enter your name..."
          maxLength={20}
          className="w-full bg-black/30 border-2 border-[#FFD700]/30 rounded-xl px-4 py-3 text-white font-game font-medium text-[16px]
                     placeholder-white/30 focus:outline-none focus:border-[#FFD700]/70 transition-all
                     shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]"
        />
      </div>

      {/* Stack + Blind presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="font-game font-semibold text-[14px] text-[#FFD700] uppercase tracking-[2px]">
            Chips & Blinds
          </label>
          <span className="font-game text-[13px] text-white/40">
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
                className={`relative flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 font-game transition-all duration-200 overflow-hidden
                  ${isActive
                    ? 'bg-[#FFD700]/10 border-[#FFD700]/60 text-white shadow-[0_0_12px_rgba(255,215,0,0.2)]'
                    : 'bg-black/20 border-white/10 text-white/50 hover:border-[#FFD700]/30 hover:text-white/70'
                  }`}
              >
                {/* Shimmer on active */}
                {isActive && (
                  <div className="absolute inset-0 animate-shimmer pointer-events-none">
                    <div className="w-[200px] h-full bg-gradient-to-r from-transparent via-[#FFD700]/10 to-transparent" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[14px]">{preset.label}</span>
                  {preset.tag === 'default' && (
                    <span className="text-[10px] bg-[#FFD700]/20 text-[#FFD700] px-2 py-0.5 rounded-full border border-[#FFD700]/40">
                      REC
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-[#FFD700]/70">{preset.sb}/{preset.bb}</span>
                  <span className={isActive ? 'text-[#FFD700]' : 'text-white/40'}>
                    {preset.stack.toLocaleString()}
                  </span>
                  <span className="text-white/25">{preset.bbDepth}BB</span>
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
