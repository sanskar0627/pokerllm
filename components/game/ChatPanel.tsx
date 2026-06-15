'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatLogEntry } from '@/hooks/useSocket'

// ─── Player color map ──────────────────────────────────────────────────────

const NAME_COLORS: Record<string, string> = {
  claude:   '#E8A0BF',
  chatgpt:  '#74AA9C',
  gemini:   '#8B9FEF',
  grok:     '#FF6B35',
  deepseek: '#4A90D9',
  groq:     '#F55036',
}

function getNameColor(playerId: string): string {
  for (const [key, color] of Object.entries(NAME_COLORS)) {
    if (playerId.toLowerCase().includes(key)) return color
  }
  return '#FFD700'
}

// ─── Valorant-style overlay chat ───────────────────────────────────────────
// No box. Messages sit on a semi-transparent dark wash with a gold left edge.
// Input bar appears at the bottom on Enter key.

interface Props {
  chatLog:  ChatLogEntry[]
  onSend:   (message: string) => void
}

export function ChatPanel({ chatLog, onSend }: Props) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatLog])

  const handleGlobalKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    if (e.key === 'Enter' && !isFocused) {
      e.preventDefault()
      setIsFocused(true)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    if (e.key === 'Escape' && isFocused) {
      setIsFocused(false)
      inputRef.current?.blur()
      setInput('')
    }
  }, [isFocused])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [handleGlobalKey])

  function handleSend() {
    const msg = input.trim()
    if (!msg) return
    onSend(msg)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setIsFocused(false)
      inputRef.current?.blur()
      setInput('')
    }
  }

  const visibleCount = isFocused ? 14 : 7
  const visible = chatLog.slice(-visibleCount)

  return (
    <div className="fixed bottom-8 left-8 sm:left-10 z-30 w-[320px] sm:w-[380px] pointer-events-none">

      {/* Messages area — semi-transparent dark wash + gold left border */}
      <div
        ref={scrollRef}
        className="border-l-2 border-[#FFD700]/50 overflow-y-auto px-3 py-2"
        style={{
          background: 'rgba(0,0,0,0.4)',
          maxHeight: isFocused ? 220 : 160,
        }}
      >
        {visible.length === 0 && (
          <p className="font-game text-[11px] text-white/25 py-2">
            Press ENTER to chat with the AIs
          </p>
        )}
        {visible.map((entry, i) => {
          const age = visible.length - i
          const opacity = isFocused ? 1 : age <= 3 ? 1 : age <= 5 ? 0.6 : 0.35
          return (
            <div
              key={`${entry.ts}-${i}`}
              className="flex items-baseline gap-1.5 py-[2px] transition-opacity duration-500"
              style={{ opacity }}
            >
              <span
                className="font-game text-[12px] sm:text-[13px] font-bold shrink-0"
                style={{ color: getNameColor(entry.playerId) }}
              >
                {entry.playerName}:
              </span>
              <span className="font-game text-[12px] sm:text-[13px] text-white/90 leading-snug break-words">
                {entry.message}
              </span>
            </div>
          )
        })}
      </div>

      {/* Input bar — same dark wash, gold left border continues */}
      <div
        className="pointer-events-auto border-l-2 border-[#FFD700]/50 px-3 py-2 transition-all duration-200"
        style={{
          background: isFocused ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-game text-[11px] font-bold shrink-0"
            style={{ color: isFocused ? '#FFD700' : 'rgba(255,215,0,0.4)' }}
          >
            {isFocused ? 'Say:' : ''}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder={isFocused ? 'Type a message...' : 'Press ENTER to chat'}
            maxLength={120}
            className="flex-1 bg-transparent text-white/90 font-game text-[12px] sm:text-[13px]
              placeholder:text-white/25 focus:outline-none caret-[#FFD700]"
          />
          {isFocused && input.trim() && (
            <button
              onClick={handleSend}
              className="font-game text-[11px] text-[#FFD700] font-bold hover:text-white transition-colors shrink-0"
            >
              SEND
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
