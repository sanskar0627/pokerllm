'use client'

import { useState } from 'react'
import type { AIModel } from '@/types/poker'
import { AI_META_LIST } from '@/lib/aiMeta'

interface Props {
  selected: AIModel[]
  onChange: (models: AIModel[]) => void
}

export function LLMSelector({ selected, onChange }: Props) {
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())

  function toggle(id: AIModel) {
    onChange(
      selected.includes(id)
        ? selected.filter(m => m !== id)
        : [...selected, id]
    )
  }

  function handleImgError(id: string) {
    setImgErrors(prev => new Set(prev).add(id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-game font-semibold text-[14px] text-[#FFD700] uppercase tracking-[2px]">
          AI Players
        </p>
        <span className="font-game text-[13px] text-white/40">{selected.length} selected</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AI_META_LIST.map(m => {
          const active = selected.includes(m.id)
          const logoFailed = imgErrors.has(m.id)
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`relative flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-200 overflow-hidden
                ${active
                  ? 'bg-[#FFD700]/10 border-[#FFD700]/60 shadow-[0_0_16px_rgba(255,215,0,0.2)]'
                  : 'bg-black/20 border-white/10 hover:border-[#FFD700]/30'
                }`}
            >
              {/* Gold accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-[#FFD700] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />

              {/* Avatar — real logo or fallback initial */}
              <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden transition-all
                ${active
                  ? 'bg-white/10 ring-2 ring-[#FFD700]/50 shadow-[0_0_12px_rgba(255,215,0,0.3)]'
                  : 'bg-white/5'}`}
              >
                {!logoFailed ? (
                  <img
                    src={m.logoUrl}
                    alt={m.label}
                    className="w-7 h-7 object-contain"
                    onError={() => handleImgError(m.id)}
                    draggable={false}
                  />
                ) : (
                  <span className={`font-game font-bold text-[18px] ${active ? 'text-[#FFD700]' : 'text-white/30'}`}>
                    {m.label.charAt(0)}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-game font-semibold text-[15px] ${active ? 'text-white' : 'text-white/40'}`}>
                    {m.label}
                  </span>
                  <span className={`font-game text-[11px] px-2 py-0.5 rounded-full border transition-all
                    ${active ? 'bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/40' : 'bg-white/5 text-white/30 border-white/10'}`}>
                    {m.company}
                  </span>
                </div>
                <p className={`font-game text-[12px] mt-1 truncate transition-colors ${active ? 'text-white/50' : 'text-white/20'}`}>
                  {m.tagline}
                </p>
              </div>

              {/* Checkbox */}
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all
                ${active ? 'bg-[#FFD700] border-transparent shadow-[0_0_8px_rgba(255,215,0,0.4)]' : 'border-white/20 bg-transparent'}`}>
                {active && (
                  <svg className="w-3.5 h-3.5 text-[#1a0a2e]" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected.length === 0 && (
        <p className="font-game text-[13px] text-red-400 text-center mt-2">Select at least one AI</p>
      )}
    </div>
  )
}
