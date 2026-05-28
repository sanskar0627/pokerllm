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
    <div className="bg-black/60 backdrop-blur-sm border border-[#FFD700]/20 rounded-xl p-3 w-64 max-h-60 overflow-y-auto flex flex-col gap-1">
      <p className="font-game font-semibold text-[11px] text-[#FFD700]/70 uppercase tracking-[2px] mb-1">Action Log</p>
      {visible.length === 0 && (
        <p className="font-game text-[10px] text-white/20">Waiting for actions...</p>
      )}
      {visible.map((entry, i) => (
        <div
          key={log.indexOf(entry)}
          className="font-game text-[11px] flex items-center gap-1.5 animate-fade-up"
          style={{ animationDelay: `${i * 20}ms` }}
        >
          <span className="text-white/20 text-[9px] w-7 shrink-0">{entry.phase.slice(0, 3).toUpperCase()}</span>
          <span className="text-white/60 truncate max-w-[70px]">{playerName(entry.playerId)}</span>
          <span className={ACTION_COLOR[entry.action] ?? 'text-white/40'}>
            {ACTION_ICON[entry.action]} {ACTION_LABEL[entry.action] ?? entry.action.toUpperCase()}
          </span>
          {entry.amount > 0 && (
            <span className="text-[#FFD700]/60">{entry.amount.toLocaleString()}</span>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
