'use client'

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useSocket } from '@/hooks/useSocket'
import { LLMSelector } from '@/components/lobby/LLMSelector'
import { AssetPreloader } from '@/components/game/AssetPreloader'
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

  // Fewer cards, no blur filters — blur on animating layers is expensive to composite.
  // Lower opacity on the "far" cards gives the same depth cue for free.
  const items = [
    { left: '2%', delay: '0s', duration: '18s', scale: 0.45, card: cards[0], opacity: 'opacity-20' },
    { left: '10%', delay: '4s', duration: '22s', scale: 0.35, card: cards[6], opacity: 'opacity-10' },
    { left: '88%', delay: '1s', duration: '20s', scale: 0.5, card: cards[1], opacity: 'opacity-20' },
    { left: '5%', delay: '8s', duration: '19s', scale: 0.4, card: cards[3], opacity: 'opacity-15' },
    { left: '92%', delay: '3s', duration: '21s', scale: 0.45, card: cards[4], opacity: 'opacity-20' },
    { left: '82%', delay: '7s', duration: '17s', scale: 0.4, card: cards[5], opacity: 'opacity-10' },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {items.map((item, idx) => (
        <img
          key={idx}
          src={item.card}
          alt=""
          decoding="async"
          loading="lazy"
          className={`absolute animate-fall ${item.opacity} will-change-transform`}
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

// Stable no-op subscription — lets useSyncExternalStore report "mounted"
// without a setState-in-effect (server snapshot: false, client: true).
const emptySubscribe = () => () => {}

function GoldDust() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  const particles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const seed = (i * 7 + 13) % 100
      return {
        left: `${(seed * 37) % 100}%`,
        top: `${(seed * 53) % 100}%`,
        size: 2 + (seed % 3),
        duration: `${4 + (seed % 6)}s`,
        delay: `${(seed % 5)}s`,
      }
    }), []
  )

  if (!mounted) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-dust"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: 'radial-gradient(circle, rgba(255,215,0,0.8), rgba(255,215,0,0))',
            '--dust-duration': p.duration,
            '--dust-delay': p.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

const AI_NAMES = ['Claude', 'ChatGPT', 'Gemini', 'Grok', 'DeepSeek'] as const
const AI_COLORS: Record<string, string> = {
  Claude: '#F4B400',
  ChatGPT: '#10A37F',
  Gemini: '#8B6CFF',
  Grok: '#FF6B35',
  DeepSeek: '#00B4D8',
}

function CyclingAIText() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % AI_NAMES.length)
        setVisible(true)
      }, 400)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const name = AI_NAMES[index]
  const color = AI_COLORS[name]

  return (
    <div className="opacity-0 animate-fade-up" style={{ animationDelay: '0.45s', animationFillMode: 'forwards' }}>
      <p className="font-game text-[13px] sm:text-[15px] text-white/40 tracking-[1px] text-center flex items-center justify-center gap-1.5">
        <span>Play with</span>
        <span
          className="inline-block w-[90px] sm:w-[100px] text-left font-semibold transition-all duration-300"
          style={{
            color,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(6px)',
            filter: `drop-shadow(0 0 8px ${color}50)`,
          }}
        >
          {name}
        </span>
      </p>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { socket, gameId, error: socketError } = useSocket()

  const [screen, setScreen] = useState<Screen>('home')
  const [transitioning, setTransitioning] = useState(false)
  const [transitionVisible, setTransitionVisible] = useState(false)

  // Lobby state
  const [selectedAIs, setSelectedAIs] = useState<AIModel[]>([])  // BYOK-only: seats unlock once a key is saved
  const [watchOnly, setWatchOnly] = useState(false)
  const [startingStack, setStartingStack] = useState(10_000)
  const [smallBlind, setSmallBlind] = useState(100)
  const [bigBlind, setBigBlind] = useState(200)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)

  // Navigate to game when created — hard redirect for reliability with socket.io
  useEffect(() => {
    if (gameId) {
      window.location.href = `/game/${gameId}`
    }
  }, [gameId])

  // Reset creating state on socket error (so button becomes clickable again)
  useEffect(() => {
    if (socketError && creating) {
      creatingRef.current = false
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: re-enable the button after a socket error
      setCreating(false)
    }
  }, [socketError, creating])

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

  // Watch mode needs 2+ AIs (they play each other). Play mode needs 1+.
  const minAIs = watchOnly ? 2 : 1
  const canStart = socket && selectedAIs.length >= minAIs && !creating

  function handleCreate() {
    if (!canStart || creatingRef.current) return
    creatingRef.current = true  // synchronous guard — state update is async
    setCreating(true)

    // Use the authenticated user's name from session
    const sessionName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Player'
    const opts: CreateGameOptions = {
      humanPlayerName: watchOnly ? undefined : sessionName,
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
        {/* Background — responsive: mobile image for small screens, desktop for wide */}
        <img
          src="/images/home-bg-mobile.png"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover lg:hidden"
        />
        <img
          src="/images/home-bg-desktop.png"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover hidden lg:block"
        />
        <div className="absolute inset-0 bg-black/30" />

        {/* Social links — top right */}
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6 z-20 flex items-center gap-3">
          <a
            href="https://github.com/sanskar0627/pokerllm"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 hover:border-[#FFD700]/40 flex items-center justify-center transition-all duration-300 hover:bg-black/50 hover:scale-110"
            title="GitHub"
          >
            <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-white/50 group-hover:text-[#FFD700] transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <a
            href="https://x.com/sanskar0627"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 hover:border-[#FFD700]/40 flex items-center justify-center transition-all duration-300 hover:bg-black/50 hover:scale-110"
            title="X (Twitter)"
          >
            <svg className="w-[15px] h-[15px] sm:w-[17px] sm:h-[17px] text-white/50 group-hover:text-[#FFD700] transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>

        {/* Ambient effects */}
        <FallingCards />
        <GoldDust />

        {/* Radial spotlight behind logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(255,215,0,0.06)_0%,transparent_70%)] pointer-events-none z-[1]" />

        <div className="relative z-10 flex flex-col items-center justify-center gap-6 sm:gap-8 px-4">

          {/* Logo area — no floating */}
          <div className="flex flex-col items-center select-none">
            {/* Decorative line */}
            <div className="flex items-center gap-3 mb-4 mt-2 lg:mt-16 opacity-0 animate-fade-up" style={{ animationDelay: '0.05s', animationFillMode: 'forwards' }}>
              <div className="w-8 sm:w-12 h-px bg-gradient-to-r from-transparent to-[#FFD700]/60" />
              <span className="font-game text-[9px] sm:text-[10px] tracking-[6px] text-[#FFD700]/50 uppercase">Texas Hold&apos;em</span>
              <div className="w-8 sm:w-12 h-px bg-gradient-to-l from-transparent to-[#FFD700]/60" />
            </div>

            {/* Main title */}
            <h1 className="flex items-baseline justify-center gap-2 sm:gap-3 select-none">
              <span className="font-pixel text-[36px] sm:text-[52px] md:text-[60px] text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] via-[#F4B400] to-[#B8860B] tracking-[3px] sm:tracking-[5px] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                POKER
              </span>
              <span className="font-pixel text-[36px] sm:text-[52px] md:text-[60px] tracking-[3px] sm:tracking-[5px] text-transparent bg-clip-text bg-gradient-to-b from-[#00FFFF] to-[#0088CC] drop-shadow-[0_0_30px_rgba(0,255,255,0.5)]">
                LLM
              </span>
            </h1>

            {/* Tagline */}
            <p className="font-game text-[13px] sm:text-[15px] text-white/60 tracking-[1px] mt-3 opacity-0 animate-fade-up" style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}>
              Play. Bluff. Outsmart the machines.
            </p>
          </div>

          {/* Auth-aware buttons — default to login/signup, switch to PLAY only when session confirmed */}
          {session ? (
            <>
              {/* Authenticated — Play button */}
              <div className="opacity-0 animate-fade-up" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                <button
                  onClick={handlePlayClick}
                  className="relative group w-[220px] h-[62px] sm:w-[270px] sm:h-[75px] active:scale-95 hover:scale-[1.04] transition-all duration-200"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#FFD700]/20 blur-xl group-hover:bg-[#FFD700]/30 transition-all duration-300 scale-110" />
                  <img
                    src="/images/buttons/play-btn.png"
                    alt="PLAY"
                    className="relative w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                    draggable={false}
                  />
                </button>
              </div>

              {/* User info bar */}
              <div className="opacity-0 animate-fade-up flex items-center gap-3 z-20" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                <a
                  href="/profile"
                  className="flex items-center gap-2 group touch-manipulation relative z-20"
                >
                  <div className="w-7 h-7 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center shrink-0 group-hover:border-[#FFD700]/60 transition-colors overflow-hidden">
                    {session.user?.image ? (
                      <img src={session.user.image} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="font-pixel text-[8px] text-[#FFD700]">
                        {(session.user?.name ?? session.user?.email)?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}
                  </div>
                  <span className="font-game text-[12px] text-white/50 group-hover:text-white/70 transition-colors">
                    {session.user?.name || session.user?.email}
                  </span>
                </a>
                <button
                  onClick={() => signOut()}
                  className="font-game text-[11px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Not authenticated (or still loading) — Login/Signup buttons */}
              <div className="opacity-0 animate-fade-up flex flex-col items-center gap-4" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                {/* LOG IN — primary gold button */}
                <a
                  href="/login"
                  className="relative group w-[220px] sm:w-[270px] active:scale-95 hover:scale-[1.04] transition-all duration-200 block cursor-pointer z-20"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#FFD700]/20 blur-xl group-hover:bg-[#FFD700]/40 transition-all duration-300 scale-110 pointer-events-none" />
                  <div className="relative w-full py-3.5 sm:py-4 rounded-2xl text-center font-pixel text-[11px] sm:text-[12px] tracking-[3px]
                                  bg-gradient-to-b from-[#FFD700] via-[#F4B400] to-[#B8860B] text-[#1a0a2e]
                                  border-2 border-[#FFD700]/80 shadow-[0_4px_20px_rgba(255,215,0,0.25)]
                                  group-hover:shadow-[0_4px_30px_rgba(255,215,0,0.5)]
                                  drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]">
                    LOG IN
                  </div>
                </a>

                {/* SIGN UP — outline gold button */}
                <a
                  href="/signup"
                  className="relative group w-[220px] sm:w-[270px] active:scale-95 hover:scale-[1.04] transition-all duration-200 block cursor-pointer z-20"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#FFD700]/0 blur-xl group-hover:bg-[#FFD700]/15 transition-all duration-300 scale-110 pointer-events-none" />
                  <div className="relative w-full py-3.5 sm:py-4 rounded-2xl text-center font-pixel text-[11px] sm:text-[12px] tracking-[3px]
                                  bg-[#1a0a2e]/60 text-[#FFD700] backdrop-blur-sm
                                  border-2 border-[#FFD700]/30 shadow-[0_4px_20px_rgba(0,0,0,0.3)]
                                  group-hover:border-[#FFD700]/60 group-hover:shadow-[0_4px_24px_rgba(255,215,0,0.2)]
                                  group-hover:text-[#FFD700]">
                    SIGN UP
                  </div>
                </a>
              </div>
            </>
          )}

          {/* Cycling "Play with X" */}
          <CyclingAIText />
        </div>

        {/* Transition Overlay — card flash */}
        {transitioning && (
          <div
            className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-300
              ${transitionVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: 'radial-gradient(ellipse at center, rgba(26,10,46,0.97) 0%, rgba(8,5,16,0.99) 100%)' }}
          >
            {/* Logo text — positioned above the cards */}
            <div
              className="absolute left-0 right-0 top-[15%] sm:top-[20%] flex flex-col items-center z-20"
              style={{ animation: 'logoFadeIn 0.6s 0.3s ease-out forwards', opacity: 0 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 sm:w-12 h-px bg-gradient-to-r from-transparent to-[#FFD700]/60" />
                <span className="font-game text-[8px] sm:text-[10px] tracking-[5px] text-[#FFD700]/50 uppercase">Loading</span>
                <div className="w-8 sm:w-12 h-px bg-gradient-to-l from-transparent to-[#FFD700]/60" />
              </div>
              <h1 className="font-pixel text-[28px] sm:text-[44px] tracking-[6px] sm:tracking-[8px] text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] via-[#F4B400] to-[#B8860B]"
                  style={{ filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.4))' }}>
                POKER LLM
              </h1>
            </div>

            {/* Card fan — centered in the middle of the screen */}
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ paddingTop: '6%' }}>
              <div className="relative" style={{ width: 'clamp(280px, 60vw, 560px)', height: 'clamp(120px, 25vw, 200px)' }}>
                {[
                  { src: '/images/cards/A_spades.png',  xPct: -42, y: 12,  rot: -20, delay: '0s' },
                  { src: '/images/cards/K_hearts.png',   xPct: -21, y: -4,  rot: -10, delay: '0.08s' },
                  { src: '/images/cards/Q_diamonds.png', xPct: 0,   y: -10, rot: 0,   delay: '0.16s' },
                  { src: '/images/cards/J_clubs.png',    xPct: 21,  y: -4,  rot: 10,  delay: '0.24s' },
                  { src: '/images/cards/A_hearts.png',   xPct: 42,  y: 12,  rot: 20,  delay: '0.32s' },
                ].map((card, i) => (
                  <img
                    key={i}
                    src={card.src}
                    alt=""
                    className="absolute w-[56px] h-[78px] sm:w-[80px] sm:h-[112px] md:w-[100px] md:h-[140px] lg:w-[110px] lg:h-[154px] rounded-md sm:rounded-lg"
                    style={{
                      left: `calc(50% + ${card.xPct}%)`,
                      top: '50%',
                      animation: `cardFanIn 0.5s ${card.delay} ease-out forwards`,
                      opacity: 0,
                      filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.7))',
                      '--card-y': `${card.y}px`,
                      '--card-rot': `${card.rot}deg`,
                    } as React.CSSProperties}
                    draggable={false}
                  />
                ))}
              </div>
            </div>

            {/* Scattered background cards (ambient, subtle) */}
            <div className="absolute inset-0 z-[5] pointer-events-none">
              {[
                { src: '/images/card-back.png', left: '8%',  top: '30%', rot: -35, delay: '0.1s', scale: 0.5 },
                { src: '/images/card-back.png', left: '85%', top: '25%', rot: 25,  delay: '0.2s', scale: 0.45 },
                { src: '/images/card-back.png', left: '12%', top: '70%', rot: 15,  delay: '0.3s', scale: 0.4 },
                { src: '/images/card-back.png', left: '78%', top: '72%', rot: -20, delay: '0.15s', scale: 0.5 },
                { src: '/images/card-back.png', left: '50%', top: '82%', rot: 5,   delay: '0.25s', scale: 0.35 },
                { src: '/images/card-back.png', left: '30%', top: '18%', rot: -10, delay: '0.35s', scale: 0.4 },
                { src: '/images/card-back.png', left: '65%', top: '15%', rot: 30,  delay: '0.05s', scale: 0.45 },
              ].map((card, i) => (
                <img
                  key={`bg-${i}`}
                  src={card.src}
                  alt=""
                  className="absolute w-[50px] h-[70px] sm:w-[65px] sm:h-[91px]"
                  style={{
                    left: card.left,
                    top: card.top,
                    opacity: 0,
                    transform: `rotate(${card.rot}deg) scale(${card.scale})`,
                    animation: `bgCardFloat 0.6s ${card.delay} ease-out forwards`,
                  }}
                  draggable={false}
                />
              ))}
            </div>

            {/* Gold flash overlay */}
            <div
              className="absolute inset-0 z-30"
              style={{
                animation: 'goldFlash 0.3s 1.2s ease-in-out forwards',
                opacity: 0,
                background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.08) 40%, transparent 70%)',
              }}
            />

            {/* Gold shimmer line under title */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-20"
              style={{
                top: 'calc(15% + 80px)',
                width: 'clamp(120px, 30vw, 250px)',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5), transparent)',
                animation: 'logoFadeIn 0.5s 0.6s ease-out forwards',
                opacity: 0,
              }}
            />
          </div>
        )}
      </main>
    )
  }


  // ─── Lobby Screen ───────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Warm the game-table asset cache while the player configures the
          game — by the time they hit START, /game/:id paints instantly. */}
      <AssetPreloader />
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
          <div className="flex items-center justify-between mb-6 sm:mb-8 animate-fade-up">
            <button
              onClick={() => setScreen('home')}
              className="font-pixel text-[8px] sm:text-[10px] text-[#FFD700] hover:text-[#FFD700]/80 bg-black/40 border border-[#FFD700]/30 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 transition-all active:scale-95 tracking-wide shadow-md"
            >
              &larr; BACK
            </button>
            <h2 className="font-pixel text-[9px] sm:text-[11px] text-[#FFD700] tracking-[2px] sm:tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">GAME SETUP</h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <a
                href="/settings/ai"
                title="AI Provider settings"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center shrink-0 hover:border-[#FFD700]/60 transition-colors touch-manipulation"
              >
                <svg className="w-3.5 h-3.5 text-[#FFD700]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </a>
              <a
                href="/profile"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center shrink-0 hover:border-[#FFD700]/60 transition-colors touch-manipulation overflow-hidden"
                title="Profile"
              >
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="font-pixel text-[7px] sm:text-[8px] text-[#FFD700]">
                    {(session?.user?.name ?? session?.user?.email)?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </a>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="font-pixel text-[8px] sm:text-[10px] text-red-400/80 hover:text-white bg-black/40 hover:bg-red-600 border border-red-500/30 hover:border-red-500 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 transition-all duration-200 active:scale-95 tracking-wide shadow-md hover:shadow-[0_0_16px_rgba(239,68,68,0.35)]"
              >
                LOGOUT
              </button>
            </div>
          </div>

          {/* Panel — shared dark-glass surface (matches auth cards) */}
          <div className="relative panel-glass rounded-2xl p-4 sm:p-8 animate-fade-up">
            {/* Gold hairline frame (inset) */}
            <div
              className="absolute inset-[5px] rounded-[12px] pointer-events-none"
              style={{ boxShadow: 'inset 0 0 0 1px rgba(255,215,0,0.10)' }}
            />

            <div className="relative space-y-6 sm:space-y-8">
              {/* Game mode toggle */}
              <GameModeToggle watchOnly={watchOnly} onChange={setWatchOnly} />

              {/* Player setup and game configuration presets */}
              <PlayerSetup
                startingStack={startingStack}
                smallBlind={smallBlind}
                bigBlind={bigBlind}
                onStackChange={handleStackChange}
              />

              {/* AI selector */}
              <LLMSelector selected={selectedAIs} onChange={setSelectedAIs} watchOnly={watchOnly} />

              {/* Create button — matches auth primary button */}
              <button
                onClick={handleCreate}
                disabled={!canStart}
                className={`group relative w-full py-4.5 rounded-xl font-pixel text-[12px] tracking-[2px] transition-all duration-200 active:scale-[0.98] overflow-hidden
                  ${!canStart
                    ? 'bg-white/5 text-white/25 cursor-not-allowed border border-white/10'
                    : 'text-[#1a0a2e] hover:-translate-y-0.5'
                  }`}
                style={canStart ? {
                  background: 'linear-gradient(135deg, #FFE27A 0%, #FFD700 45%, #C49630 100%)',
                  boxShadow: '0 6px 20px rgba(255,215,0,0.26), inset 0 1px 0 rgba(255,255,255,0.32)',
                } : undefined}
              >
                {canStart && (
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out
                                   bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
                )}
                <span className="relative">
                  {creating ? 'CREATING...' : watchOnly ? 'START WATCHING' : 'START GAME'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
