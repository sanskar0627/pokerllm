'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type {
  ClientGameState,
  WinnerInfo,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/types/poker'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface UseSocketReturn {
  socket:       AppSocket | null
  connected:    boolean
  gameState:    ClientGameState | null
  winners:      WinnerInfo[] | null
  thinkingId:   string | null
  error:        string | null
  gameId:       string | null
  clearWinners: () => void
  clearError:   () => void
  nextRound:    (gameId: string) => void
}

export function useSocket(): UseSocketReturn {
  const socketRef             = useRef<AppSocket | null>(null)
  const [connected,  setConnected]  = useState(false)
  const [gameState,  setGameState]  = useState<ClientGameState | null>(null)
  const [winners,    setWinners]    = useState<WinnerInfo[] | null>(null)
  const [thinkingId, setThinkingId] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [gameId,     setGameId]     = useState<string | null>(null)

  useEffect(() => {
    const socket: AppSocket = io({ path: '/socket.io' })
    socketRef.current = socket

    socket.on('connect',      ()     => setConnected(true))
    socket.on('disconnect',   ()     => setConnected(false))
    socket.on('game_state',   state  => {
      setGameState(state)
      // Only clear winners when we're past the showdown (new round started)
      if (state.phase !== 'showdown') setWinners(null)
    })
    socket.on('game_created', id     => setGameId(id))
    socket.on('game_over',    w      => setWinners(w))
    socket.on('game_error',   msg    => { setError(msg); setTimeout(() => setError(null), 5000) })
    socket.on('llm_thinking', id     => {
      setThinkingId(id)
      setTimeout(() => setThinkingId(prev => prev === id ? null : prev), 15_000)
    })

    return () => { socket.disconnect() }
  }, [])

  // Clear thinkingId when game state updates
  useEffect(() => {
    if (gameState) setThinkingId(null)
  }, [gameState])

  const clearWinners = useCallback(() => setWinners(null), [])
  const clearError   = useCallback(() => setError(null), [])
  const nextRound    = useCallback((gid: string) => {
    socketRef.current?.emit('next_round', gid)
  }, [])

  return {
    socket:     socketRef.current,
    connected,
    gameState,
    winners,
    thinkingId,
    error,
    gameId,
    clearWinners,
    clearError,
    nextRound,
  }
}
