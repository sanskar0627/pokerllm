'use client'

import { useEffect, useRef, useState, memo } from 'react'
import type { ActionLog as ActionLogType, ClientGameState } from '@/types/poker'

interface Props {
  log:     ActionLogType[]
  players: ClientGameState['players']
}

const ACTION_COLOR: Record<string, string> = {
  fold:    'text-red-400',
  call:    'text-[#00FFFF]',
  raise:   'text-[#FFD700]',
  check:   'text-white/60',
  post_sb: 'text-purple-300',
  post_bb: 'text-purple-400',
}

const ACTION_ICON: Record<string, string> = {
  fold:    '✕',
  call:    '→',
  raise:   '↑',
  check:   '✓',
  post_sb: '◐',
  post_bb: '●',
}

const ACTION_LABEL: Record<string, string> = {
  fold:    'FOLD',
  call:    'CALL',
  raise:   'RAISE TO',
  check:   'CHECK',
  post_sb: 'SM BLIND',
  post_bb: 'BIG BLIND',
}

function formatAmount(action: string, amount: number): string | null {
  if (amount <= 0) return null
  if (action === 'call')  return `+${amount.toLocaleString()}`
  return amount.toLocaleString()
}

export const ActionLog = memo(function ActionLog({ log, players }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  function playerName(id: string) {
    return players.find(p => p.id === id)?.name ?? id
  }

  const visible = log.slice(-20)

  // On mobile, show collapsed by default with toggle
  return (
    <div className="bg-[rgba(26,10,46,0.88)] backdrop-blur-md border sm:border-2 border-[#FFD700]/30 rounded-lg sm:rounded-xl p-2 sm:p-4 w-36 sm:w-68 max-h-32 sm:max-h-64 overflow-y-auto flex flex-col gap-0.5 sm:gap-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
      {/* Header with collapse toggle on mobile */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full sm:pointer-events-none"
      >
        <p className="font-pixel text-[6px] sm:text-[8px] text-[#FFD700] uppercase tracking-[2px] border-b border-[#FFD700]/15 pb-1 flex-1 text-left">Action Log</p>
        <span className={`font-pixel text-[8px] text-[#FFD700]/50 sm:hidden transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}>
          ▼
        </span>
      </button>

      {!collapsed && (
        <>
          {visible.length === 0 && (
            <p className="font-pixel text-[6px] sm:text-[7px] text-white/20">Waiting for actions...</p>
          )}
          {visible.map((entry) => (
            <div
              key={`${entry.ts}-${entry.playerId}-${entry.action}`}
              className="font-pixel text-[6px] sm:text-[8px] flex items-center gap-1 sm:gap-1.5 leading-relaxed"
            >
              <span className="text-white/25 text-[5px] sm:text-[7px] w-5 sm:w-8 shrink-0">{entry.phase.slice(0, 3).toUpperCase()}</span>
              <span className="text-white/75 truncate max-w-[36px] sm:max-w-[80px]">{playerName(entry.playerId)}</span>
              <span className={ACTION_COLOR[entry.action] ?? 'text-white/40'}>
                {ACTION_ICON[entry.action]} {ACTION_LABEL[entry.action] ?? entry.action.toUpperCase()}
              </span>
              {(() => {
                const display = formatAmount(entry.action, entry.amount)
                return display ? <span className="text-[#FFD700] ml-auto tabular-nums">{display}</span> : null
              })()}
            </div>
          ))}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  )
})
