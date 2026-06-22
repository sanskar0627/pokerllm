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
// Desktop: overlay in bottom-left. Mobile: collapsed toggle button.

interface Props {
  chatLog:  ChatLogEntry[]
  onSend:   (message: string) => void
}

export function ChatPanel({ chatLog, onSend }: Props) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
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
      setMobileOpen(true)
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

  // ── Mobile: show a small toggle button, expand into a bottom sheet ──
  return (
    <>
      {/* Mobile toggle button — only visible on small screens when chat is closed */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="sm:hidden fixed bottom-3 left-3 z-30 w-10 h-10 rounded-full bg-[rgba(26,10,46,0.9)] border border-[#FFD700]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        aria-label="Toggle chat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {chatLog.length > 0 && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FFD700] flex items-center justify-center">
            <span className="font-pixel text-[5px] text-[#1a0a2e]">{Math.min(chatLog.length, 9)}</span>
          </div>
        )}
      </button>

      {/* Desktop: always-visible overlay. Mobile: slide-up panel */}
      <div className={`
        fixed z-30 pointer-events-none
        sm:bottom-8 sm:left-10 sm:w-[380px]
        bottom-0 left-0 right-0 w-full
        transition-transform duration-200 ease-out
        ${mobileOpen ? 'translate-y-0' : 'translate-y-full sm:translate-y-0'}
      `}>

        {/* Mobile close bar */}
        <div className="sm:hidden flex justify-between items-center px-3 py-2 pointer-events-auto"
             style={{ background: 'rgba(0,0,0,0.5)' }}>
          <span className="font-pixel text-[7px] text-[#FFD700]/60 tracking-wider">CHAT</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="font-pixel text-[8px] text-white/40 px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="border-l-0 sm:border-l-2 border-[#FFD700]/50 overflow-y-auto px-3 py-2 pointer-events-auto"
          style={{
            background: 'rgba(0,0,0,0.5)',
            maxHeight: isFocused ? 220 : 160,
          }}
        >
          {visible.length === 0 && (
            <p className="font-game text-[11px] text-white/25 py-2">
              {typeof window !== 'undefined' && window.innerWidth >= 640 ? 'Press ENTER to chat with the AIs' : 'Send a message to the AIs'}
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

        {/* Input bar */}
        <div
          className="pointer-events-auto border-l-0 sm:border-l-2 border-[#FFD700]/50 px-3 py-2 transition-all duration-200"
          style={{
            background: isFocused ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)',
            // Safe area padding for mobile with home indicator
            paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
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
              placeholder={isFocused ? 'Type a message...' : 'Tap to chat'}
              maxLength={120}
              className="flex-1 bg-transparent text-white/90 font-game text-[13px]
                placeholder:text-white/25 focus:outline-none caret-[#FFD700]"
            />
            {input.trim() && (
              <button
                onClick={handleSend}
                className="font-game text-[11px] text-[#FFD700] font-bold hover:text-white transition-colors shrink-0 px-2 py-1 min-h-[36px]"
              >
                SEND
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
