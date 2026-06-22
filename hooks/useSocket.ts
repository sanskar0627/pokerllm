'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type {
  ClientGameState,
  WinnerInfo,
  ServerToClientEvents,
  ClientToServerEvents,
  AIReflectionPayload,
  AIChatMessage,
  TurnTimerPayload,
  AIStatusPayload,
  AIThinkingEntry,
} from '@/types/poker'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface ChatLogEntry {
  playerId:   string
  playerName: string
  message:    string
  ts:         number
}

interface UseSocketReturn {
  socket:          AppSocket | null
  connected:       boolean
  gameState:       ClientGameState | null
  winners:         WinnerInfo[] | null
  thinkingId:      string | null
  error:           string | null
  gameId:          string | null
  aiReflections:   AIReflectionPayload['reflections']
  chatBubbles:     Record<string, string>  // playerId → current chat message
  chatLog:         ChatLogEntry[]           // full chat history for panel
  turnTimer:       TurnTimerPayload | null  // current turn timer state
  aiStatusMessages: AIStatusPayload[]       // AI error/limit notifications
  aiThinkingLog:   AIThinkingEntry[]        // AI thinking entries (watch mode)
  clearWinners:    () => void
  clearError:      () => void
  nextRound:       (gameId: string) => void
  sendChat:        (gameId: string, message: string) => void
  leaveGame:       (gameId: string) => void
}

export function useSocket(): UseSocketReturn {
  const socketRef             = useRef<AppSocket | null>(null)
  const [connected,  setConnected]  = useState(false)
  const [gameState,  setGameState]  = useState<ClientGameState | null>(null)
  const [winners,    setWinners]    = useState<WinnerInfo[] | null>(null)
  const [thinkingId, setThinkingId] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [gameId,     setGameId]     = useState<string | null>(null)
  const [aiReflections, setAiReflections] = useState<AIReflectionPayload['reflections']>([])
  const [chatBubbles, setChatBubbles] = useState<Record<string, string>>({})
  const [chatLog, setChatLog] = useState<ChatLogEntry[]>([])
  const [turnTimer, setTurnTimer] = useState<TurnTimerPayload | null>(null)
  const [aiStatusMessages, setAiStatusMessages] = useState<AIStatusPayload[]>([])
  const [aiThinkingLog, setAiThinkingLog] = useState<AIThinkingEntry[]>([])
  const chatTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const socket: AppSocket = io({ path: '/socket.io' })
    socketRef.current = socket

    socket.on('connect',      ()     => setConnected(true))
    socket.on('disconnect',   ()     => setConnected(false))
    socket.on('connect_error', (err) => {
      setConnected(false)
      // The server rejects unauthenticated handshakes with 'unauthorized'.
      if (err.message === 'unauthorized') {
        setError('Please sign in to play.')
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      } else {
        setError('Connection error. Retrying…')
      }
    })
    socket.on('game_state',   state  => {
      setGameState(state)
      // Only clear winners when we're past the showdown (new round started)
      if (state.phase !== 'showdown') setWinners(null)
    })
    socket.on('game_created', id     => setGameId(id))
    socket.on('game_over',    w      => setWinners(w))
    socket.on('game_error',   msg    => { setError(msg); setTimeout(() => setError(null), 5000) })
    socket.on('ai_reflections', (payload) => {
      // Accumulate reflections across rounds
      setAiReflections(prev => [...prev, ...payload.reflections])
    })
    socket.on('llm_thinking', id     => {
      setThinkingId(id)
      setTimeout(() => setThinkingId(prev => prev === id ? null : prev), 15_000)
    })
    socket.on('ai_chat', (msg: AIChatMessage) => {
      // Show chat bubble for this player
      setChatBubbles(prev => ({ ...prev, [msg.playerId]: msg.message }))
      // Add to persistent chat log (keep last 50 messages)
      setChatLog(prev => [...prev.slice(-49), {
        playerId: msg.playerId,
        playerName: msg.playerName,
        message: msg.message,
        ts: msg.ts,
      }])
      // Clear any existing timer for this player
      if (chatTimersRef.current[msg.playerId]) {
        clearTimeout(chatTimersRef.current[msg.playerId])
      }
      // Auto-dismiss after 4 seconds
      chatTimersRef.current[msg.playerId] = setTimeout(() => {
        setChatBubbles(prev => {
          const next = { ...prev }
          delete next[msg.playerId]
          return next
        })
        delete chatTimersRef.current[msg.playerId]
      }, 4000)
    })
    socket.on('turn_timer', (payload: TurnTimerPayload) => {
      if (payload.phase === 'expired') {
        // Clear timer after a brief delay so UI can show "0"
        setTurnTimer(payload)
        setTimeout(() => setTurnTimer(null), 1500)
      } else {
        setTurnTimer(payload)
      }
    })
    socket.on('ai_status', (payload: AIStatusPayload) => {
      setAiStatusMessages(prev => [...prev, payload])
      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        setAiStatusMessages(prev => prev.filter(m => m.ts !== payload.ts))
      }, 6000)
    })
    socket.on('ai_thinking_log', (entry: AIThinkingEntry) => {
      // Keep last 30 entries to prevent unbounded growth
      setAiThinkingLog(prev => [...prev.slice(-29), entry])
    })

    return () => {
      socket.disconnect()
      // Clean up chat timers
      for (const timer of Object.values(chatTimersRef.current)) clearTimeout(timer)
    }
  }, [])

  // Clear thinkingId when game state updates
  useEffect(() => {
    if (gameState) setThinkingId(null)
  }, [gameState])

  const clearWinners = useCallback(() => setWinners(null), [])
  const clearError   = useCallback(() => setError(null), [])
  const nextRoundRef = useRef(false)
  const nextRound    = useCallback((gid: string) => {
    if (nextRoundRef.current) return          // prevent double-clicks
    nextRoundRef.current = true
    setWinners(null)                          // clear modal immediately — no stale overlap
    socketRef.current?.emit('next_round', gid)
    // Reset guard after server has had time to respond
    setTimeout(() => { nextRoundRef.current = false }, 2000)
  }, [])

  const sendChat = useCallback((gid: string, message: string) => {
    if (!message.trim()) return
    socketRef.current?.emit('send_chat', { gameId: gid, message })
  }, [])

  const leaveGame = useCallback((gid: string) => {
    socketRef.current?.emit('leave_game', gid)
  }, [])

  return {
    socket:     socketRef.current,
    connected,
    gameState,
    winners,
    thinkingId,
    error,
    gameId,
    aiReflections,
    chatBubbles,
    chatLog,
    turnTimer,
    aiStatusMessages,
    aiThinkingLog,
    clearWinners,
    clearError,
    nextRound,
    sendChat,
    leaveGame,
  }
}
