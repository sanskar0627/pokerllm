'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientPlayer, AIReflectionPayload } from '@/types/poker'

// ─── AI model colors for visual distinction ─────────────────────────────────
const MODEL_COLORS: Record<string, { border: string; text: string; bg: string; glow: string }> = {
  claude:   { border: 'border-orange-400/50', text: 'text-orange-300', bg: 'bg-orange-500/10', glow: 'shadow-[0_0_8px_rgba(251,146,60,0.2)]' },
  chatgpt:  { border: 'border-green-400/50',  text: 'text-green-300',  bg: 'bg-green-500/10',  glow: 'shadow-[0_0_8px_rgba(74,222,128,0.2)]' },
  gemini:   { border: 'border-blue-400/50',   text: 'text-blue-300',   bg: 'bg-blue-500/10',   glow: 'shadow-[0_0_8px_rgba(96,165,250,0.2)]' },
  grok:     { border: 'border-red-400/50',    text: 'text-red-300',    bg: 'bg-red-500/10',    glow: 'shadow-[0_0_8px_rgba(248,113,113,0.2)]' },
  deepseek: { border: 'border-cyan-400/50',   text: 'text-cyan-300',   bg: 'bg-cyan-500/10',   glow: 'shadow-[0_0_8px_rgba(34,211,238,0.2)]' },
  groq:     { border: 'border-purple-400/50', text: 'text-purple-300', bg: 'bg-purple-500/10', glow: 'shadow-[0_0_8px_rgba(192,132,252,0.2)]' },
}
const DEFAULT_COLORS = { border: 'border-white/20', text: 'text-white/70', bg: 'bg-white/5', glow: '' }

// ─── Collapsible section for a single AI player ─────────────────────────────
interface AIPlayerReflection {
  playerId: string
  playerName: string
  rounds: {
    roundNumber: number
    insights: string[]
    selfCritique: string
    opponentReads: Record<string, string>
  }[]
}

function AIInsightCard({ data }: { data: AIPlayerReflection }) {
  const [open, setOpen] = useState(false)

  // Detect model from playerId (e.g. "claude", "chatgpt", "groq")
  const modelKey = data.playerId.toLowerCase()
  const colors = MODEL_COLORS[modelKey] ?? DEFAULT_COLORS

  // Aggregate top insights across all rounds (deduplicated)
  const allInsights = [...new Set(data.rounds.flatMap(r => r.insights))]
  // Latest opponent reads (last round wins)
  const latestReads: Record<string, string> = {}
  data.rounds.forEach(r => {
    Object.entries(r.opponentReads).forEach(([k, v]) => { latestReads[k] = v })
  })
  // Latest self critique
  const latestCritique = data.rounds[data.rounds.length - 1]?.selfCritique ?? ''

  return (
    <div className={`w-full border rounded-xl overflow-hidden transition-all duration-200 ${colors.border} ${colors.glow}`}>
      {/* Header — clickable toggle */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 ${colors.bg} hover:brightness-125 transition-all`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
          <span className={`font-pixel text-[9px] tracking-[1.5px] ${colors.text}`}>
            {data.playerName.toUpperCase()}
          </span>
          <span className="font-pixel text-[6px] text-white/30">
            {data.rounds.length} {data.rounds.length === 1 ? 'round' : 'rounds'} analyzed
          </span>
        </div>
        <span className={`font-pixel text-[10px] transition-transform duration-200 ${colors.text} ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 py-3.5 space-y-3.5 bg-black/30 border-t border-white/5">
          {/* Key Insights */}
          {allInsights.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-pixel text-[7px] text-[#FFD700]/80 uppercase tracking-[1.5px]">Key Learnings</p>
              {allInsights.map((insight, i) => (
                <p key={i} className="font-game text-[11px] text-white/65 leading-relaxed pl-3 border-l-2 border-white/10">
                  {insight}
                </p>
              ))}
            </div>
          )}

          {/* Opponent Reads */}
          {Object.keys(latestReads).length > 0 && (
            <div className="space-y-1.5">
              <p className="font-pixel text-[7px] text-[#00FFFF]/70 uppercase tracking-[1.5px]">Opponent Reads</p>
              {Object.entries(latestReads).map(([name, read]) => (
                <div key={name} className="flex gap-2 pl-3 border-l-2 border-[#00FFFF]/15">
                  <span className="font-pixel text-[7px] text-white/50 shrink-0">{name}:</span>
                  <span className="font-game text-[11px] text-white/55 leading-relaxed">{read}</span>
                </div>
              ))}
            </div>
          )}

          {/* Self Critique */}
          {latestCritique && (
            <div className="space-y-1.5">
              <p className="font-pixel text-[7px] text-red-400/70 uppercase tracking-[1.5px]">Self Critique</p>
              <p className="font-game text-[11px] text-white/55 leading-relaxed pl-3 border-l-2 border-red-400/15 italic">
                {latestCritique}
              </p>
            </div>
          )}

          {/* Round-by-round breakdown */}
          {data.rounds.length > 1 && (
            <details className="group">
              <summary className="font-pixel text-[7px] text-white/30 uppercase tracking-[1.5px] cursor-pointer hover:text-white/50 transition-colors">
                Round-by-round breakdown
              </summary>
              <div className="mt-2 space-y-2 pl-2">
                {data.rounds.map(r => (
                  <div key={r.roundNumber} className="border-l border-white/10 pl-3 space-y-1">
                    <p className="font-pixel text-[6px] text-white/35">ROUND {r.roundNumber}</p>
                    {r.insights.map((ins, i) => (
                      <p key={i} className="font-game text-[10px] text-white/45 leading-relaxed">{ins}</p>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main GameOverModal ─────────────────────────────────────────────────────

interface Props {
  players: ClientPlayer[]
  playerId: string
  aiReflections: AIReflectionPayload['reflections']
}

export function GameOverModal({ players, playerId, aiReflections }: Props) {
  const router = useRouter()
  const [showInsights, setShowInsights] = useState(false)

  // Sort players by final stack to show final rankings
  const standings = [...players].sort((a, b) => b.stack - a.stack)
  const winner = standings[0]
  const isSelfWinner = winner?.id === playerId
  const isWatchMode = !players.some(p => p.id === playerId)

  let title = "TOURNAMENT COMPLETE"
  let subtitle = `${winner?.name} has won all the chips!`
  let headingColor = "text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.5)]"

  if (!isWatchMode) {
    if (isSelfWinner) {
      title = "VICTORY!"
      subtitle = "You defeated the neural networks and took all the chips!"
      headingColor = "text-green-400 drop-shadow-[0_0_16px_rgba(34,197,94,0.6)]"
    } else {
      title = "DEFEATED"
      subtitle = "The machines outsmarted you. Better luck next time!"
      headingColor = "text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]"
    }
  }

  // Group reflections by playerId
  const groupedReflections: AIPlayerReflection[] = []
  const playerMap = new Map<string, AIPlayerReflection>()

  for (const r of aiReflections) {
    let entry = playerMap.get(r.playerId)
    if (!entry) {
      entry = { playerId: r.playerId, playerName: r.playerName, rounds: [] }
      playerMap.set(r.playerId, entry)
      groupedReflections.push(entry)
    }
    entry.rounds.push({
      roundNumber: r.roundNumber,
      insights: r.insights,
      selfCritique: r.selfCritique,
      opponentReads: r.opponentReads,
    })
  }

  const hasReflections = groupedReflections.length > 0

  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="bg-[rgba(26,10,46,0.96)] border-t-[3px] sm:border-[3px] border-[#FFD700] rounded-t-2xl sm:rounded-2xl overflow-hidden max-w-lg w-full sm:my-4 max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto
                      shadow-[0_0_48px_rgba(255,215,0,0.4)] animate-fade-up">
        {/* Decorative gold line */}
        <div className="w-full h-1 bg-[#FFD700]" />

        <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-5">
          {/* Trophy Icon */}
          <div className="relative w-20 h-20 flex items-center justify-center bg-[#FFD700]/10 rounded-full border border-[#FFD700]/30 shadow-inner">
            <span className="text-[40px] animate-float select-none">🏆</span>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className={`font-pixel text-[16px] sm:text-[20px] tracking-[4px] font-bold ${headingColor}`}>
              {title}
            </h2>
            <p className="font-game text-[13px] text-white/70 px-4 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Standings list */}
          <div className="w-full bg-black/45 border border-white/10 rounded-xl p-4.5 space-y-3">
            <p className="font-pixel text-[8px] text-[#FFD700] uppercase tracking-[2px] border-b border-white/10 pb-2 text-left">
              Final Standings
            </p>
            {standings.map((p, idx) => {
              const isSelf = p.id === playerId
              return (
                <div key={p.id} className="flex items-center justify-between font-pixel text-[8px] tracking-wide py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white/35">#{idx + 1}</span>
                    <span className={isSelf ? "text-[#FFD700] font-bold" : "text-white/80"}>
                      {p.name.toUpperCase()} {isSelf && "(YOU)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <img src="/images/coin.png" alt="" className="w-4 h-4 object-contain" />
                    <span className="text-white/95 font-bold tabular-nums">
                      {p.stack.toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* AI Insights toggle + panel */}
          {hasReflections && (
            <div className="w-full space-y-3">
              <button
                onClick={() => setShowInsights(!showInsights)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#00FFFF]/25 bg-[#00FFFF]/5 hover:bg-[#00FFFF]/10 transition-all"
              >
                <span className="font-pixel text-[8px] text-[#00FFFF]/80 tracking-[2px]">
                  {showInsights ? 'HIDE' : 'VIEW'} AI BRAIN DUMP
                </span>
                <span className={`font-pixel text-[9px] text-[#00FFFF]/60 transition-transform duration-200 ${showInsights ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {showInsights && (
                <div className="w-full space-y-2.5 animate-fade-up">
                  <p className="font-pixel text-[6px] text-white/25 tracking-[1px] text-left px-1">
                    What each AI learned during the game
                  </p>
                  {groupedReflections.map(data => (
                    <AIInsightCard key={data.playerId} data={data} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Return to Lobby button */}
          <button
            onClick={() => router.push('/')}
            className="relative w-full h-12 sm:h-13 overflow-hidden rounded-xl active:scale-[0.97] hover:scale-[1.01] hover:brightness-105 duration-200 transition-all shadow-lg touch-manipulation"
          >
            <img
              src="/images/buttons/play-btn.png"
              alt="Lobby"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <span className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] text-[#FFD700] tracking-[2px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              RETURN TO LOBBY
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
