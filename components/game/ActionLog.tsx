'use client'

import { useEffect, useRef } from 'react'
import type { ActionLog as ActionLogType, ClientGameState } from '@/types/poker'

interface Props {
  log:     ActionLogType[]
  players: ClientGameState['players']
}

const ACTION_COLOR: Record<string, string> = {
  fold:  'text-red-400',
  call:  'text-[#00FFFF]',
  raise: 'text-[#FFD700]',
  check: 'text-white/60',
  post:  'text-purple-400',
}

const ACTION_ICON: Record<string, string> = {
  fold:  '✕',
  call:  '→',
  raise: '↑',
  check: '✓',
  post:  '●',
}

const ACTION_LABEL: Record<string, string> = {
  fold:  'FOLD',
  call:  'CALL',
  raise: 'RAISE',
  check: 'CHECK',
  post:  'BLIND',
}

export function ActionLog({ log, players }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  function playerName(id: string) {
    return players.find(p => p.id === id)?.name ?? id
  }

  // Show only last 20 entries
  const visible = log.slice(-20)

  return (
    <div className="bg-[rgba(26,10,46,0.88)] backdrop-blur-md border-2 border-[#FFD700]/30 rounded-xl p-4 w-68 max-h-64 overflow-y-auto flex flex-col gap-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
      <p className="font-pixel text-[8px] text-[#FFD700] uppercase tracking-[2px] mb-1.5 border-b border-[#FFD700]/15 pb-1">Action Log</p>
      {visible.length === 0 && (
        <p className="font-pixel text-[7px] text-white/20">Waiting for actions...</p>
      )}
      {visible.map((entry, i) => (
        <div
          key={log.indexOf(entry)}
          className="font-pixel text-[8px] flex items-center gap-1.5 animate-fade-up leading-relaxed"
          style={{ animationDelay: `${i * 20}ms` }}
        >
          <span className="text-white/25 text-[7px] w-8 shrink-0">{entry.phase.slice(0, 3).toUpperCase()}</span>
          <span className="text-white/75 truncate max-w-[80px]">{playerName(entry.playerId)}</span>
          <span className={ACTION_COLOR[entry.action] ?? 'text-white/40'}>
            {ACTION_ICON[entry.action]} {ACTION_LABEL[entry.action] ?? entry.action.toUpperCase()}
          </span>
          {entry.amount > 0 && (
            <span className="text-[#FFD700] ml-auto tabular-nums">{entry.amount.toLocaleString()}</span>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
