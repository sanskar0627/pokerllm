'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileStats {
  totalGames: number
  wins: number
  losses: number
  abandoned: number
  winRate: number
  totalRounds: number
  currentStreak: number
  longestStreak: number
  favoriteAI: string | null
  aiModelCounts: Record<string, number>
}

interface GameRecordItem {
  id: string
  gameId: string
  models: string[]
  rounds: number
  result: string | null
  createdAt: string
}

interface AiProfileItem {
  id: string
  aiModel: string
  gamesPlayed: number
  wins: number
  losses: number
  overallStyle: string
}

interface LeaderboardEntry {
  userId: string
  name: string
  image: string | null
  totalGames: number
  wins: number
  winRate: number
  totalRounds: number
}

interface ProfileData {
  user: { id: string; name: string | null; email: string; image: string | null; createdAt: string }
  stats: ProfileStats
  aiProfiles: AiProfileItem[]
  gameRecords: GameRecordItem[]
}

// ─── SVG Icons (no emojis) ──────────────────────────────────────────────────

function IconController({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
    </svg>
  )
}

function IconTrophy({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function IconFlame({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}

function IconCpu({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" /><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </svg>
  )
}

function IconCards({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="12" height="16" rx="2" transform="rotate(-6 3 3)" />
      <rect x="9" y="5" width="12" height="16" rx="2" transform="rotate(6 15 13)" />
    </svg>
  )
}

function IconMedal({ place }: { place: 1 | 2 | 3 }) {
  const colors = place === 1
    ? { fill: '#FFD700', stroke: '#B8860B' }
    : place === 2
    ? { fill: '#C0C0C0', stroke: '#808080' }
    : { fill: '#CD7F32', stroke: '#8B4513' }

  return (
    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="14" r="7" fill={colors.fill} stroke={colors.stroke} strokeWidth="1.5" />
      <text x="12" y="17" textAnchor="middle" fill={colors.stroke} fontSize="8" fontWeight="bold">{place}</text>
      <path d="M8 2l4 8M16 2l-4 8" stroke={colors.fill} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconEye({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconArrowLeft({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  claude:   { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-400/30', bar: 'bg-orange-400/60' },
  chatgpt:  { text: 'text-green-300',  bg: 'bg-green-500/15',  border: 'border-green-400/30',  bar: 'bg-green-400/60' },
  gemini:   { text: 'text-blue-300',   bg: 'bg-blue-500/15',   border: 'border-blue-400/30',   bar: 'bg-blue-400/60' },
  grok:     { text: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-400/30',    bar: 'bg-red-400/60' },
  deepseek: { text: 'text-cyan-300',   bg: 'bg-cyan-500/15',   border: 'border-cyan-400/30',   bar: 'bg-cyan-400/60' },
  groq:     { text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-400/30', bar: 'bg-purple-400/60' },
}
const DEFAULT_COLORS = { text: 'text-white/70', bg: 'bg-white/10', border: 'border-white/20', bar: 'bg-white/30' }

function getModelColors(model: string) {
  return MODEL_COLORS[model.toLowerCase()] ?? DEFAULT_COLORS
}

const MODEL_DISPLAY: Record<string, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  groq: 'Groq',
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-3 sm:p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {icon}
        <span className="font-pixel text-[5px] sm:text-[7px] text-white/40 tracking-[1.5px] uppercase">{label}</span>
      </div>
      <span className="font-pixel text-[13px] sm:text-[18px] text-[#FFD700] tabular-nums leading-none">{value}</span>
      {sub && <span className="font-game text-[9px] sm:text-[11px] text-white/35">{sub}</span>}
    </div>
  )
}

// ─── Tab Button ─────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'history' | 'leaderboard'

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-pixel text-[6px] sm:text-[8px] tracking-[1.5px] px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-lg transition-all duration-200 touch-manipulation whitespace-nowrap
        ${active
          ? 'bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/40 shadow-[0_0_12px_rgba(255,215,0,0.15)]'
          : 'text-white/40 hover:text-white/60 border border-transparent hover:border-white/10'
        }`}
    >
      {label}
    </button>
  )
}

// ─── Result Badge ───────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: string | null }) {
  if (result === 'win') {
    return <span className="font-pixel text-[5px] sm:text-[7px] text-green-400 bg-green-500/15 border border-green-400/30 px-1.5 sm:px-2 py-0.5 rounded-md tracking-wider shrink-0">WIN</span>
  }
  if (result === 'loss') {
    return <span className="font-pixel text-[5px] sm:text-[7px] text-red-400 bg-red-500/15 border border-red-400/30 px-1.5 sm:px-2 py-0.5 rounded-md tracking-wider shrink-0">LOSS</span>
  }
  return <span className="font-pixel text-[5px] sm:text-[7px] text-yellow-400 bg-yellow-500/15 border border-yellow-400/30 px-1.5 sm:px-2 py-0.5 rounded-md tracking-wider shrink-0">LEFT</span>
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('dashboard')
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [lbLoading, setLbLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Fetch profile data
  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    setError(null)
    fetch('/api/profile')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.error) throw new Error(data.error)
        setProfileData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Profile fetch failed:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [status])

  // Fetch leaderboard when tab switches
  useEffect(() => {
    if (tab !== 'leaderboard' || leaderboard.length > 0) return
    setLbLoading(true)
    fetch('/api/profile/leaderboard')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setLeaderboard(data.leaderboard ?? [])
        setCurrentUserId(data.currentUserId ?? '')
        setLbLoading(false)
      })
      .catch(err => {
        console.error('Leaderboard fetch failed:', err)
        setLbLoading(false)
      })
  }, [tab, leaderboard.length])

  // ── Loading state ───────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <main className="relative min-h-screen min-h-[100dvh] overflow-hidden">
        <img src="/images/table-room-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-center space-y-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_24px_rgba(255,215,0,0.4)]" />
            <p className="font-pixel text-[8px] sm:text-[9px] text-[#FFD700] tracking-[3px] animate-pulse">LOADING PROFILE...</p>
          </div>
        </div>
      </main>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (!profileData || error) {
    return (
      <main className="relative min-h-screen min-h-[100dvh] overflow-hidden">
        <img src="/images/table-room-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <p className="font-pixel text-[8px] sm:text-[9px] text-red-400 tracking-[2px]">FAILED TO LOAD PROFILE</p>
            {error && <p className="font-game text-[11px] text-white/30">{error}</p>}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="font-pixel text-[7px] sm:text-[8px] text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg px-4 py-2 hover:bg-[#FFD700]/20 transition-all touch-manipulation"
              >
                RETRY
              </button>
              <a href="/" className="font-pixel text-[7px] sm:text-[8px] text-white/50 border border-white/15 rounded-lg px-4 py-2 hover:text-white/70 transition-all touch-manipulation">
                LOBBY
              </a>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const { user, stats, aiProfiles, gameRecords } = profileData

  return (
    <main className="relative min-h-screen min-h-[100dvh] overflow-hidden">
      {/* Background */}
      <img src="/images/table-room-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 min-h-screen py-2.5 sm:py-6">
        <div className="max-w-3xl mx-auto px-2.5 sm:px-6">

          {/* ── Top Bar ─────────────────────────────────────────────────── */}
          <div className="relative mb-3 sm:mb-6 overflow-hidden rounded-lg sm:rounded-xl border border-[#FFD700]/20 sm:border-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <img src="/images/topbar-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 flex items-center justify-between px-2.5 sm:px-5 py-1.5 sm:py-3">
              <a
                href="/"
                className="font-pixel text-[6px] sm:text-[9px] text-[#FFD700] hover:text-[#FFD700]/80 bg-black/40 border border-[#FFD700]/30 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 transition-all active:scale-95 tracking-wide shadow-md touch-manipulation min-h-[32px] flex items-center gap-1"
              >
                <IconArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">LOBBY</span>
              </a>
              <h1 className="font-pixel font-bold text-[9px] sm:text-[14px] text-[#FFD700] tracking-[2px] sm:tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                PROFILE
              </h1>
              <div className="w-[40px] sm:w-[80px]" />
            </div>
          </div>

          {/* ── User Identity Card ──────────────────────────────────────── */}
          <div className="bg-[rgba(26,10,46,0.92)] border border-[#FFD700]/20 rounded-xl p-3 sm:p-6 mb-3 sm:mb-6 shadow-[0_0_30px_rgba(0,0,0,0.4)] animate-fade-up">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Avatar */}
              <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-full bg-[#FFD700]/10 border-2 border-[#FFD700]/30 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(255,215,0,0.15)] overflow-hidden">
                {user.image ? (
                  <img src={user.image} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="font-pixel text-[12px] sm:text-[18px] text-[#FFD700]">
                    {(user.name ?? user.email)?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <h2 className="font-pixel text-[9px] sm:text-[13px] text-white tracking-[1px] truncate">
                  {user.name?.toUpperCase() ?? 'PLAYER'}
                </h2>
                <p className="font-game text-[10px] sm:text-[13px] text-white/35 truncate">{user.email}</p>
                <p className="font-game text-[9px] sm:text-[11px] text-white/25">
                  Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* ── Tab Navigation ──────────────────────────────────────────── */}
          <div className="flex gap-1 sm:gap-2 mb-3 sm:mb-6 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <TabButton active={tab === 'dashboard'} label="DASHBOARD" onClick={() => setTab('dashboard')} />
            <TabButton active={tab === 'history'} label="HISTORY" onClick={() => setTab('history')} />
            <TabButton active={tab === 'leaderboard'} label="LEADERBOARD" onClick={() => setTab('leaderboard')} />
          </div>

          {/* ── DASHBOARD TAB ──────────────────────────────────────────── */}
          {tab === 'dashboard' && (
            <div className="space-y-3 sm:space-y-6 animate-fade-up">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <StatCard
                  icon={<IconController className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD700]/60" />}
                  label="Games"
                  value={stats.totalGames}
                  sub={`${stats.totalRounds} rounds`}
                />
                <StatCard
                  icon={<IconTrophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD700]/60" />}
                  label="Win Rate"
                  value={`${stats.winRate}%`}
                  sub={`${stats.wins}W / ${stats.losses}L`}
                />
                <StatCard
                  icon={<IconFlame className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD700]/60" />}
                  label="Streak"
                  value={stats.currentStreak}
                  sub={`Best: ${stats.longestStreak}`}
                />
                <StatCard
                  icon={<IconCpu className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD700]/60" />}
                  label="Fav. AI"
                  value={stats.favoriteAI ? (MODEL_DISPLAY[stats.favoriteAI] ?? stats.favoriteAI) : 'N/A'}
                />
              </div>

              {/* AI Opponents Breakdown */}
              {Object.keys(stats.aiModelCounts).length > 0 && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-3 sm:p-5">
                  <h3 className="font-pixel text-[6px] sm:text-[8px] text-[#FFD700]/70 tracking-[2px] uppercase mb-2.5 sm:mb-3">Games per AI</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.aiModelCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([model, count]) => {
                        const colors = getModelColors(model)
                        const pct = stats.totalGames > 0 ? Math.round((count / stats.totalGames) * 100) : 0
                        return (
                          <div key={model} className="flex items-center gap-2 sm:gap-3">
                            <span className={`font-pixel text-[6px] sm:text-[8px] ${colors.text} w-16 sm:w-24 shrink-0 tracking-wide`}>
                              {(MODEL_DISPLAY[model] ?? model).toUpperCase()}
                            </span>
                            <div className="flex-1 h-2.5 sm:h-4 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.max(pct, 4)}%` }}
                              />
                            </div>
                            <span className="font-pixel text-[5px] sm:text-[7px] text-white/40 tabular-nums w-6 sm:w-8 text-right">{count}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* AI Knowledge of You */}
              {aiProfiles.length > 0 && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-3 sm:p-5">
                  <div className="flex items-center gap-1.5 mb-2.5 sm:mb-3">
                    <IconEye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00FFFF]/60" />
                    <h3 className="font-pixel text-[6px] sm:text-[8px] text-[#00FFFF]/70 tracking-[2px] uppercase">How AIs See You</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {aiProfiles.map(profile => {
                      const colors = getModelColors(profile.aiModel)
                      const profileWinRate = profile.gamesPlayed > 0 ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0
                      return (
                        <div key={profile.id} className={`border ${colors.border} rounded-lg p-2.5 sm:p-3 ${colors.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-pixel text-[6px] sm:text-[7px] ${colors.text} tracking-wider`}>
                              {(MODEL_DISPLAY[profile.aiModel] ?? profile.aiModel).toUpperCase()}
                            </span>
                            <span className="font-pixel text-[5px] sm:text-[6px] text-white/30">{profile.gamesPlayed}G</span>
                          </div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-game text-[10px] sm:text-[11px] text-white/50">Style:</span>
                            <span className="font-game text-[10px] sm:text-[11px] text-[#FFD700]/80 font-semibold">{profile.overallStyle}</span>
                          </div>
                          <span className="font-game text-[9px] sm:text-[10px] text-white/30">
                            {profile.wins}W / {profile.losses}L ({profileWinRate}%)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {stats.totalGames === 0 && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-6 sm:p-12 text-center">
                  <IconCards className="w-10 h-10 sm:w-12 sm:h-12 text-[#FFD700]/30 mx-auto mb-3 sm:mb-4" />
                  <p className="font-pixel text-[7px] sm:text-[10px] text-white/50 tracking-[2px] mb-1.5 sm:mb-2">NO GAMES YET</p>
                  <p className="font-game text-[11px] sm:text-[12px] text-white/30 mb-4 sm:mb-5">Play your first game to start tracking stats</p>
                  <a
                    href="/"
                    className="inline-block font-pixel text-[7px] sm:text-[8px] text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg px-4 sm:px-5 py-2 sm:py-2.5 hover:bg-[#FFD700]/20 transition-all tracking-wider touch-manipulation"
                  >
                    PLAY NOW
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ────────────────────────────────────────────── */}
          {tab === 'history' && (
            <div className="space-y-1.5 sm:space-y-3 animate-fade-up">
              {gameRecords.length === 0 ? (
                <div className="bg-black/30 border border-white/10 rounded-xl p-6 sm:p-8 text-center">
                  <IconCards className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="font-pixel text-[7px] sm:text-[8px] text-white/50 tracking-[2px]">NO GAMES PLAYED YET</p>
                </div>
              ) : (
                gameRecords.map(game => (
                  <div key={game.id} className="bg-black/30 border border-white/10 rounded-xl px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-2">
                    {/* Left: result + models */}
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                      <ResultBadge result={game.result} />
                      <div className="flex flex-wrap gap-0.5 sm:gap-1">
                        {game.models.map(m => {
                          const colors = getModelColors(m)
                          return (
                            <span key={m} className={`font-pixel text-[4px] sm:text-[6px] ${colors.text} ${colors.bg} border ${colors.border} px-1 sm:px-1.5 py-0.5 rounded tracking-wider`}>
                              {(MODEL_DISPLAY[m] ?? m).toUpperCase()}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    {/* Right: rounds + date */}
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="font-pixel text-[5px] sm:text-[7px] text-white/40 tabular-nums">{game.rounds} rnd{game.rounds !== 1 ? 's' : ''}</span>
                      <span className="font-game text-[8px] sm:text-[10px] text-white/25">
                        {new Date(game.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── LEADERBOARD TAB ────────────────────────────────────────── */}
          {tab === 'leaderboard' && (
            <div className="animate-fade-up">
              {lbLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-10 h-10 border-[3px] border-[#FFD700] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="bg-black/30 border border-white/10 rounded-xl p-6 sm:p-8 text-center">
                  <IconTrophy className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="font-pixel text-[7px] sm:text-[8px] text-white/50 tracking-[2px]">NO PLAYERS YET</p>
                </div>
              ) : (
                <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div className="grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem_2.5rem] sm:grid-cols-[2.5rem_1fr_4rem_4rem_5rem] gap-0.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 border-b border-white/10">
                    <span className="font-pixel text-[4px] sm:text-[6px] text-white/30 tracking-wider">#</span>
                    <span className="font-pixel text-[4px] sm:text-[6px] text-white/30 tracking-wider">PLAYER</span>
                    <span className="font-pixel text-[4px] sm:text-[6px] text-white/30 tracking-wider text-right">WINS</span>
                    <span className="font-pixel text-[4px] sm:text-[6px] text-white/30 tracking-wider text-right">RATE</span>
                    <span className="font-pixel text-[4px] sm:text-[6px] text-white/30 tracking-wider text-right">GAMES</span>
                  </div>
                  {/* Rows */}
                  {leaderboard.map((entry, idx) => {
                    const isYou = entry.userId === currentUserId
                    return (
                      <div
                        key={entry.userId}
                        className={`grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem_2.5rem] sm:grid-cols-[2.5rem_1fr_4rem_4rem_5rem] gap-0.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-3 border-b border-white/5 last:border-b-0 transition-colors
                          ${isYou ? 'bg-[#FFD700]/5' : ''}`}
                      >
                        {/* Rank */}
                        <span className="font-pixel text-[7px] sm:text-[8px] text-white/40 flex items-center">
                          {idx < 3
                            ? <IconMedal place={(idx + 1) as 1 | 2 | 3} />
                            : idx + 1
                          }
                        </span>
                        {/* Name */}
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                            {entry.image ? (
                              <img src={entry.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-pixel text-[6px] sm:text-[7px] text-white/40">{entry.name[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <span className={`font-pixel text-[5px] sm:text-[7px] tracking-wide truncate ${isYou ? 'text-[#FFD700]' : 'text-white/70'}`}>
                            {entry.name.toUpperCase()}{isYou ? ' (YOU)' : ''}
                          </span>
                        </div>
                        {/* Wins */}
                        <span className="font-pixel text-[6px] sm:text-[8px] text-[#FFD700] tabular-nums text-right flex items-center justify-end">{entry.wins}</span>
                        {/* Win Rate */}
                        <span className="font-pixel text-[5px] sm:text-[7px] text-white/50 tabular-nums text-right flex items-center justify-end">{entry.winRate}%</span>
                        {/* Total Games */}
                        <span className="font-pixel text-[5px] sm:text-[7px] text-white/35 tabular-nums text-right flex items-center justify-end">{entry.totalGames}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bottom spacer for safe area */}
          <div className="h-4 sm:h-8" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }} />
        </div>
      </div>
    </main>
  )
}
