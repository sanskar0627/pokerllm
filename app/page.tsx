'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import { LLMSelector } from '@/components/lobby/LLMSelector'
import { GameModeToggle } from '@/components/lobby/GameModeToggle'
import { PlayerSetup } from '@/components/lobby/PlayerSetup'
import type { AIModel, CreateGameOptions } from '@/types/poker'

type Screen = 'home' | 'lobby'

function FallingCards() {
  const cards = [
    '/images/cards/A_spades.png',
    '/images/cards/K_hearts.png',
    '/images/cards/Q_diamonds.png',
    '/images/cards/J_clubs.png',
    '/images/cards/10_spades.png',
    '/images/cards/A_hearts.png',
    '/images/card-back.png',
    '/images/cards/A_clubs.png',
    '/images/cards/K_spades.png',
  ]

  const items = [
    { left: '4%', delay: '0s', duration: '14s', scale: 0.7, card: cards[0], blur: 'blur-[1px]' },
    { left: '12%', delay: '3s', duration: '18s', scale: 0.5, card: cards[6], blur: 'blur-[2px]' },
    { left: '22%', delay: '1s', duration: '13s', scale: 0.85, card: cards[1], blur: '' },
    { left: '32%', delay: '5s', duration: '20s', scale: 0.45, card: cards[2], blur: 'blur-[2px]' },
    { left: '45%', delay: '2s', duration: '15s', scale: 0.8, card: cards[7], blur: '' },
    { left: '55%', delay: '7s', duration: '22s', scale: 0.55, card: cards[6], blur: 'blur-[1px]' },
    { left: '68%', delay: '0.5s', duration: '16s', scale: 0.9, card: cards[3], blur: '' },
    { left: '78%', delay: '4s', duration: '12s', scale: 0.75, card: cards[4], blur: 'blur-[0.5px]' },
    { left: '88%', delay: '6s', duration: '19s', scale: 0.5, card: cards[8], blur: 'blur-[2px]' },
    { left: '96%', delay: '2.5s', duration: '14s', scale: 0.65, card: cards[5], blur: 'blur-[1px]' },
    { left: '18%', delay: '8s', duration: '15s', scale: 0.75, card: cards[0], blur: '' },
    { left: '60%', delay: '10s', duration: '17s', scale: 0.6, card: cards[1], blur: 'blur-[1px]' },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {items.map((item, idx) => (
        <img
          key={idx}
          src={item.card}
          alt=""
          className={`absolute animate-fall ${item.blur} opacity-50`}
          style={{
            left: item.left,
            animationDelay: item.delay,
            animationDuration: item.duration,
            width: `${Math.round(80 * item.scale)}px`,
            height: `${Math.round(110 * item.scale)}px`,
            transform: 'translateY(-150px)',
          }}
          draggable={false}
        />
      ))}
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { socket, gameId } = useSocket()

  const [screen, setScreen] = useState<Screen>('home')
  const [transitioning, setTransitioning] = useState(false)
  const [transitionVisible, setTransitionVisible] = useState(false)

  // Lobby state
  const [selectedAIs, setSelectedAIs] = useState<AIModel[]>(['claude', 'chatgpt'])
  const [watchOnly, setWatchOnly] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [startingStack, setStartingStack] = useState(10_000)
  const [smallBlind, setSmallBlind] = useState(100)
  const [bigBlind, setBigBlind] = useState(200)
  const [creating, setCreating] = useState(false)

  // Navigate to game when created
  if (gameId) {
    router.push(`/game/${gameId}`)
  }

  function handlePlayClick() {
    setTransitioning(true)
    setTransitionVisible(true)
    setTimeout(() => {
      setScreen('lobby')
      setTransitionVisible(false)
      setTimeout(() => {
        setTransitioning(false)
      }, 300)
    }, 1800)
  }

  function handleCreate() {
    if (!socket || selectedAIs.length === 0) return
    setCreating(true)

    const opts: CreateGameOptions = {
      humanPlayerName: watchOnly ? undefined : (playerName.trim() || 'Player'),
      selectedAIs,
      startingStack,
      smallBlind,
      bigBlind,
      watchOnly,
    }
    socket.emit('create_game', opts)
  }

  function handleStackChange(stack: number, sb: number, bb: number) {
    setStartingStack(stack)
    setSmallBlind(sb)
    setBigBlind(bb)
  }

  // ─── Home Screen ────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
        {/* Background */}
        <img
          src="/images/casino-bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />

        {/* Slow Falling Cards Background */}
        <FallingCards />

        <div className="relative z-10 flex flex-col items-center justify-center gap-10 px-4">
          {/* Big designed POKER LLM logo (same line) */}
          <div className="flex flex-col items-center space-y-3 animate-float select-none">
            <h1 className="font-pixel text-[28px] sm:text-[42px] md:text-[48px] text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] via-[#F4B400] to-[#B8860B] tracking-[2px] sm:tracking-[4px] filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] text-center font-bold flex items-baseline justify-center gap-2.5 sm:gap-4 select-none">
              POKER
              <span className="text-[20px] sm:text-[32px] md:text-[38px] tracking-[4px] sm:tracking-[6px] text-transparent bg-clip-text bg-gradient-to-b from-[#00FFFF] to-[#00BFFF] drop-shadow-[0_0_24px_rgba(0,255,255,0.45)]">
                LLM
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="font-game text-[14px] sm:text-[16px] text-white/95 text-center tracking-wide bg-[rgba(81,46,123,0.85)] border-2 border-[#FFD700]/30 rounded-2xl px-6 py-3 max-w-md shadow-lg animate-fade-up animate-float" style={{ animationDelay: '0.1s' }}>
            Where Neural Networks Bluff and Human Intuition Battles in the Ultimate AI Poker Arena.
          </p>

          {/* Play button */}
          <button
            onClick={handlePlayClick}
            className="relative group w-[240px] h-[66px] sm:w-[280px] sm:h-[77px] active:scale-95 hover:scale-103 transition-all duration-200 animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            <img
              src="/images/buttons/play-btn.png"
              alt="PLAY"
              className="w-full h-full object-contain drop-shadow-[0_0_24px_rgba(0,255,255,0.4)]"
              draggable={false}
            />
          </button>

          {/* Supported models */}
          <p className="font-game text-[13px] text-white/40 tracking-wider animate-fade-up" style={{ animationDelay: '0.3s' }}>
            Claude &middot; ChatGPT &middot; Gemini &middot; Grok &middot; DeepSeek
          </p>
        </div>

        {/* Transition Overlay */}
        {transitioning && (
          <div
            className={`fixed inset-0 top-0 left-0 w-screen h-screen z-50 transition-opacity duration-300 pointer-events-none flex items-center justify-center overflow-hidden
              ${transitionVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{
              background: 'radial-gradient(circle, #7d4fc8 0%, #3a1974 100%)',
            }}
          >
            <video
              src="/videos/logo_loading_small.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain max-w-full max-h-full"
            />
          </div>
        )}
      </main>
    )
  }


  // ─── Lobby Screen ───────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <img
        src="/images/lobby-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 animate-fade-up">
            <button
              onClick={() => setScreen('home')}
              className="font-pixel text-[10px] text-[#FFD700] hover:text-[#FFD700]/80 bg-black/40 border border-[#FFD700]/30 rounded-lg px-4 py-2 transition-all active:scale-95 tracking-wide shadow-md"
            >
              &larr; BACK
            </button>
            <h2 className="font-pixel text-[11px] text-[#FFD700] tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">GAME SETUP</h2>
            <div className="w-16" />
          </div>

          {/* Panel */}
          <div className="bg-[rgba(81,46,123,0.94)] border-[3px] border-[#FFD700]/30 rounded-2xl p-6 sm:p-8 space-y-8
                          shadow-[0_0_40px_rgba(0,0,0,0.5),_0_0_24px_rgba(81,46,123,0.4)] animate-fade-up backdrop-blur-md">

            {/* Game mode toggle */}
            <GameModeToggle watchOnly={watchOnly} onChange={setWatchOnly} />

            {/* Player setup and game configuration presets */}
            <PlayerSetup
              name={playerName}
              startingStack={startingStack}
              smallBlind={smallBlind}
              bigBlind={bigBlind}
              onNameChange={setPlayerName}
              onStackChange={handleStackChange}
              watchOnly={watchOnly}
            />

            {/* AI selector */}
            <LLMSelector selected={selectedAIs} onChange={setSelectedAIs} />

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={creating || selectedAIs.length === 0}
              className={`w-full py-4.5 rounded-xl font-pixel text-[12px] tracking-[2px] transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-95
                ${creating || selectedAIs.length === 0
                  ? 'bg-white/10 text-white/30 cursor-not-allowed border border-white/10'
                  : 'bg-gradient-to-b from-[#FFD700] to-[#B8860B] text-[#1a0a2e] border-2 border-[#FFD700] hover:shadow-[0_0_24px_rgba(255,215,0,0.45)] hover:brightness-105 active:brightness-95'
                }`}
            >
              {creating ? 'CREATING...' : watchOnly ? 'START WATCHING' : 'START GAME'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
