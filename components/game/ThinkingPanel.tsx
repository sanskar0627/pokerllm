'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { AIThinkingEntry, AIModel } from '@/types/poker'
import { AI_META } from '@/lib/aiMeta'
import { ModelLogo } from '@/components/lobby/LLMSelector'

// ─── Model name colors (matches ChatPanel convention) ───────────────────────

const MODEL_COLOR: Record<string, string> = {
  claude:   '#E8A0BF',
  chatgpt:  '#74AA9C',
  gemini:   '#8B9FEF',
  grok:     '#FF6B35',
  deepseek: '#4A90D9',
  groq:     '#F55036',
}

function getModelColor(model: string): string {
  return MODEL_COLOR[model] ?? '#FFD700'
}

// ─── Action formatting ──────────────────────────────────────────────────────

function actionText(action: string, amount: number): { label: string; color: string } {
  switch (action) {
    case 'fold':  return { label: 'folded', color: '#FF4757' }
    case 'raise': return { label: `raised ${amount.toLocaleString()}`, color: '#2ED573' }
    case 'call':  return { label: 'called', color: '#00FFFF' }
    case 'check': return { label: 'checked', color: '#FFD700' }
    default:      return { label: action, color: '#FFFFFF' }
  }
}

function phaseTag(phase: string): string {
  switch (phase) {
    case 'preflop': return 'PRE'
    case 'flop':    return 'FLOP'
    case 'turn':    return 'TURN'
    case 'river':   return 'RVR'
    default:        return phase.toUpperCase().slice(0, 4)
  }
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  entries:    AIThinkingEntry[]
  thinkingId: string | null
  players:    { id: string; name: string; model?: AIModel }[]
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ThinkingPanel({ entries, thinkingId, players }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const lastEntryCount = useRef(entries.length)

  // Detect if user has scrolled up manually
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    // If user scrolled more than 60px from bottom, they're browsing history
    setUserScrolled(distanceFromBottom > 60)
  }, [])

  // Auto-scroll to bottom on new entries (only if user hasn't scrolled up)
  useEffect(() => {
    if (entries.length !== lastEntryCount.current) {
      lastEntryCount.current = entries.length
      if (!userScrolled && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }
  }, [entries.length, userScrolled])

  const thinkingPlayer = thinkingId ? players.find(p => p.id === thinkingId) : null

  // Keep more history available for scrolling
  const visible = entries.slice(-30)

  return (
    <div className="fixed z-30 pointer-events-none top-1/2 -translate-y-1/2 right-4 sm:right-6 lg:right-8 w-[320px] sm:w-[360px]">

      {/* ── Scrollable feed ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto pointer-events-auto thinking-scroll"
        style={{
          maxHeight: '70vh',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 100%)',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Spacer pushes content to bottom when few entries */}
        <div style={{ minHeight: '1px' }} />

        {/* Empty state */}
        {visible.length === 0 && !thinkingId && (
          <div
            className="px-4 py-3 backdrop-blur-md rounded-lg"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <p className="font-game text-[11px] text-white/25 text-center">
              AI reasoning will appear here...
            </p>
          </div>
        )}

        {/* Entries — newest at bottom, flow upward */}
        {visible.map((entry, i) => {
          const age = visible.length - i
          const opacity = age <= 2 ? 1 : age <= 4 ? 0.7 : age <= 7 ? 0.45 : 0.25
          const modelColor = getModelColor(entry.model)
          const action = actionText(entry.action, entry.amount)
          const meta = AI_META[entry.model]

          return (
            <div
              key={`${entry.playerId}-${entry.ts}-${i}`}
              className="transition-opacity duration-500 animate-thinking-slide-up"
              style={{ opacity }}
            >
              <div
                className="px-4 py-3 backdrop-blur-md"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              >
                {/* Name row: logo + name + action + phase */}
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      boxShadow: `0 0 8px ${modelColor}30`,
                    }}
                  >
                    <ModelLogo id={meta?.id ?? entry.model} className="w-3 h-3" />
                  </div>

                  <span
                    className="font-game text-[13px] font-bold shrink-0"
                    style={{ color: modelColor }}
                  >
                    {entry.playerName}
                  </span>

                  <span
                    className="font-game text-[11px]"
                    style={{ color: action.color }}
                  >
                    {action.label}
                  </span>

                  <span className="ml-auto font-pixel text-[5px] text-white/20 tracking-wider shrink-0">
                    {phaseTag(entry.phase)}
                  </span>
                </div>

                {/* Thinking text */}
                <p className="font-game text-[12px] text-white/70 leading-relaxed pl-7 break-words">
                  {entry.thinking}
                </p>
              </div>

              {/* Thin separator */}
              {i < visible.length - 1 && (
                <div className="h-px mx-4" style={{ background: 'rgba(255,255,255,0.04)' }} />
              )}
            </div>
          )
        })}

        {/* ── Currently thinking ── */}
        {thinkingPlayer && (
          <div className="animate-thinking-slide-up">
            <div
              className="px-4 py-3 backdrop-blur-md"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    boxShadow: `0 0 8px ${getModelColor(thinkingPlayer.model ?? 'claude')}30`,
                  }}
                >
                  {thinkingPlayer.model && (
                    <ModelLogo id={AI_META[thinkingPlayer.model]?.id ?? thinkingPlayer.model} className="w-3 h-3" />
                  )}
                </div>

                <span
                  className="font-game text-[13px] font-bold shrink-0"
                  style={{ color: getModelColor(thinkingPlayer.model ?? 'claude') }}
                >
                  {thinkingPlayer.name}
                </span>

                <span className="font-game text-[11px] text-white/30">
                  thinking
                </span>

                <div className="flex items-center gap-[3px] ml-1">
                  {[0, 1, 2].map(j => (
                    <div
                      key={j}
                      className="w-[4px] h-[4px] rounded-full"
                      style={{
                        background: getModelColor(thinkingPlayer.model ?? 'claude'),
                        animation: 'bounce-dot 0.8s ease-in-out infinite',
                        animationDelay: `${j * 200}ms`,
                        opacity: 0.7,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll-to-bottom indicator when user has scrolled up */}
        {userScrolled && entries.length > 0 && (
          <div
            className="sticky bottom-1 flex justify-center pointer-events-auto py-1"
            onClick={() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                setUserScrolled(false)
              }
            }}
          >
            <button
              className="font-pixel text-[5px] text-white/40 hover:text-white/70 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 transition-colors cursor-pointer"
            >
              NEW ENTRIES ↓
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
