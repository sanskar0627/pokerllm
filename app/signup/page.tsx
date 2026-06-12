'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ──────────────────────────────────────────────────────────────────────────
   Motion variants — TRANSFORM ONLY (no opacity / blur in page-level initials,
   they get stuck on Next.js back-navigation).
   ────────────────────────────────────────────────────────────────────────── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
}
const fadeUp = {
  hidden: { y: 18 },
  show: { y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as const } },
}
const scaleFade = {
  hidden: { scale: 0.92 },
  show: { scale: 1, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } },
}

const TEAL = '#5EC4C4'

/* ── Small inline icons ─────────────────────────────────────────────────── */
function UserIcon({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}
function MailIcon({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
    </svg>
  )
}
function LockIcon({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [csrfToken, setCsrfToken] = useState('')
  const [focused, setFocused] = useState<'name' | 'email' | 'password' | null>(null)
  const googleFormRef = useRef<HTMLFormElement>(null)

  // Restore saved form data from sessionStorage (in useEffect to avoid hydration mismatch)
  useEffect(() => {
    const savedName = sessionStorage.getItem('signup_form_name')
    const savedEmail = sessionStorage.getItem('signup_form_email')
    if (savedName) setName(savedName)
    if (savedEmail) setEmail(savedEmail)
  }, [])

  useEffect(() => {
    fetch('/api/auth/csrf')
      .then(r => {
        if (!r.ok) throw new Error(`CSRF fetch failed: ${r.status}`)
        return r.json()
      })
      .then(data => setCsrfToken(data.csrfToken))
      .catch(err => console.warn('[signup] CSRF fetch error:', err.message))
  }, [])

  // Persist form values as user types
  useEffect(() => {
    if (name) sessionStorage.setItem('signup_form_name', name)
  }, [name])
  useEffect(() => {
    if (email) sessionStorage.setItem('signup_form_email', email)
  }, [email])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      sessionStorage.setItem('signup_email', email.toLowerCase().trim())
      sessionStorage.setItem('signup_password', password)
      window.location.href = '/verify?email=' + encodeURIComponent(email.toLowerCase().trim())
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleSignup() {
    setGoogleLoading(true)
    googleFormRef.current?.submit()
  }

  /* Shared input shell styles */
  const fieldShadow = (active: boolean) =>
    active
      ? '0 0 0 1.5px rgba(94,196,196,0.45), 0 0 22px rgba(94,196,196,0.12), inset 0 1px 2px rgba(0,0,0,0.25)'
      : 'inset 0 1px 2px rgba(0,0,0,0.25)'
  const fieldBg = 'linear-gradient(135deg, rgba(255,255,255,0.045) 0%, rgba(94,196,196,0.025) 100%)'
  const inputCls =
    'w-full rounded-xl pl-11 pr-4 py-3.5 font-game text-[13.5px] text-white/90 font-medium ' +
    'placeholder:text-white/20 placeholder:font-normal bg-transparent border border-white/[0.07] ' +
    'focus:outline-none focus:border-[#5EC4C4]/40 transition-colors duration-200'

  return (
    <main className="relative w-full min-h-screen overflow-hidden bg-[#071417]">
      {/* Background */}
      <img src="/images/signuppage.png" alt="" className="absolute inset-0 w-full h-full object-cover" />

      {/* Cinematic grade — deepen edges, lift the marble-right where the form lives */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, rgba(5,14,16,0.55) 0%, rgba(5,14,16,0.12) 32%, rgba(5,14,16,0.0) 55%, rgba(5,14,16,0.35) 100%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, transparent 55%, rgba(4,11,13,0.55) 100%)' }}
      />
      {/* Soft scrim seating the card against the bright marble (right side) */}
      <div
        className="absolute inset-y-0 right-0 w-full lg:w-1/2 pointer-events-none"
        style={{ background: 'radial-gradient(60% 70% at 62% 50%, rgba(6,16,19,0.62) 0%, rgba(6,16,19,0.30) 45%, transparent 78%)' }}
      />
      {/* Fine film grain for texture / cohesion */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      {/* Grid — door / brand on left, form on right */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 min-h-screen">

        {/* ── LEFT — Brand & value over the vault door ── */}
        <div className="hidden lg:flex flex-col justify-center relative">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="relative z-10 flex flex-col items-start pl-[11%] xl:pl-[13%] pr-8 max-w-[480px]"
          >
            {/* Eyebrow rule */}
            <motion.div variants={fadeUp} className="flex items-center gap-2.5 mb-6">
              <div className="w-12 h-[2px]" style={{ background: 'linear-gradient(90deg, #FFD700, rgba(255,215,0,0))' }} />
              <div className="w-1.5 h-1.5 rotate-45" style={{ background: 'rgba(255,215,0,0.8)', boxShadow: '0 0 10px rgba(255,215,0,0.5)' }} />
              <span className="font-game text-[11px] font-semibold tracking-[5px] uppercase" style={{ color: 'rgba(255,215,0,0.7)' }}>
                Members only
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeUp} className="leading-[1.15]">
              <span
                className="font-game text-[17px] xl:text-[19px] font-semibold tracking-[6px] uppercase block"
                style={{ color: 'rgba(255,255,255,0.62)', textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
              >
                Open the vault to
              </span>
              <span
                className="font-pixel text-[40px] xl:text-[52px] tracking-[4px] block mt-4"
                style={{
                  color: '#fff',
                  textShadow: '0 0 48px rgba(255,215,0,0.22), 0 2px 12px rgba(0,0,0,0.7)',
                }}
              >
                POKER
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="font-game text-[14px] xl:text-[15px] leading-[1.85] mt-6 max-w-[330px]"
              style={{ color: 'rgba(255,255,255,0.62)', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
            >
              Take a seat at the table and test your nerve against the
              sharpest AI minds ever built.
            </motion.p>

            {/* Premium value rows */}
            <motion.ul variants={fadeUp} className="mt-9 space-y-4">
              {[
                { t: 'Heads-up vs Claude, GPT & Gemini', s: 'Bluff, read, and outplay frontier models' },
                { t: '100 chips on the house', s: 'Credited the moment your seat is confirmed' },
                { t: 'Tournament-grade engine', s: 'Real-time betting, real poker math' },
              ].map((item) => (
                <li key={item.t} className="flex items-start gap-3.5">
                  <span
                    className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,215,0,0.16), rgba(255,215,0,0.04))',
                      boxShadow: '0 0 0 1px rgba(255,215,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-game text-[13.5px] font-semibold text-white/85 leading-tight">{item.t}</p>
                    <p className="font-game text-[12px] text-white/40 mt-0.5">{item.s}</p>
                  </div>
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </div>

        {/* ── RIGHT — Signup form over the marble ── */}
        <div className="flex items-center justify-center p-6 lg:px-[8%] xl:px-[10%] lg:py-0">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="w-full max-w-[406px]"
          >
            {/* Mobile header */}
            <motion.div variants={fadeUp} className="lg:hidden text-center mb-6">
              <p className="font-game text-[11px] tracking-[5px] uppercase mb-1.5" style={{ color: 'rgba(255,215,0,0.7)' }}>Open the vault to</p>
              <h1 className="font-pixel text-[26px] text-white tracking-[4px]" style={{ textShadow: '0 0 30px rgba(255,215,0,0.18)' }}>POKER</h1>
            </motion.div>

            {/* Spade emblem */}
            <motion.div variants={scaleFade} className="flex justify-center mb-[-26px] relative z-20">
              <motion.div
                className="w-[58px] h-[58px] rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 50% 30%, #143036 0%, #0a1c22 70%, #07161a 100%)',
                  boxShadow: '0 0 26px rgba(94,196,196,0.16), 0 6px 22px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
                animate={{
                  boxShadow: [
                    '0 0 22px rgba(94,196,196,0.12), 0 6px 22px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)',
                    '0 0 32px rgba(94,196,196,0.26), 0 6px 22px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.32), inset 0 1px 0 rgba(255,255,255,0.10)',
                    '0 0 22px rgba(94,196,196,0.12), 0 6px 22px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)',
                  ],
                }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg width="26" height="28" viewBox="0 0 24 26" fill="none">
                  <path d="M12 1C12 1 3 9.5 3 14c0 2.8 2.2 4.5 4.5 4.5 1.4 0 2.6-.7 3.3-1.6-.2 1.3-.8 2.8-1.8 3.8h6c-1-.9-1.6-2.5-1.8-3.8.7.9 1.9 1.6 3.3 1.6C18.8 18.5 21 16.8 21 14 21 9.5 12 1 12 1z"
                        fill="url(#spadeGSignup)" />
                  <defs>
                    <linearGradient id="spadeGSignup" x1="12" y1="1" x2="12" y2="21" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#FFE27A" />
                      <stop offset="0.5" stopColor="#FFD700" />
                      <stop offset="1" stopColor="#B8860B" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            </motion.div>

            {/* ── Card ── */}
            <motion.div
              variants={fadeUp}
              className="relative rounded-[22px]"
              style={{
                background: 'linear-gradient(180deg, rgba(13,31,37,0.93) 0%, rgba(8,21,27,0.96) 100%)',
                boxShadow: '0 40px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(94,196,196,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
                backdropFilter: 'blur(44px)',
                WebkitBackdropFilter: 'blur(44px)',
              }}
            >
              {/* Gold hairline frame (inset) */}
              <div
                className="absolute inset-[5px] rounded-[18px] pointer-events-none"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(255,215,0,0.10)' }}
              />

              {/* Top shimmer */}
              <div className="absolute top-0 left-6 right-6 h-px overflow-hidden rounded-full">
                <motion.div
                  className="h-full w-[55%]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5), rgba(94,196,196,0.5), transparent)' }}
                  animate={{ x: ['-60%', '200%'] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2.5 }}
                />
              </div>

              {/* Corner filigree marks (echo the vault gold) */}
              {[
                'top-3 left-3 border-t border-l',
                'top-3 right-3 border-t border-r',
                'bottom-3 left-3 border-b border-l',
                'bottom-3 right-3 border-b border-r',
              ].map((pos) => (
                <div key={pos} className={`absolute ${pos} w-4 h-4 rounded-[3px] pointer-events-none`} style={{ borderColor: 'rgba(255,215,0,0.22)' }} />
              ))}

              <div className="relative px-8 sm:px-9 pt-14 pb-8">

                {/* Header */}
                <motion.div variants={stagger} initial="hidden" animate="show" className="text-center mb-7">
                  <motion.h2 variants={fadeUp} className="font-game text-[23px] font-bold text-white tracking-wide">
                    Create your account
                  </motion.h2>
                  <motion.p variants={fadeUp} className="font-game text-[12.5px] text-white/40 mt-2 font-medium">
                    Claim your seat in under a minute
                  </motion.p>
                </motion.div>

                {/* Form */}
                <motion.form onSubmit={handleSubmit} variants={stagger} initial="hidden" animate="show" className="space-y-[18px]">

                  {/* Name */}
                  <motion.div variants={fadeUp}>
                    <label className="font-game text-[11px] text-white/45 block mb-2 font-semibold tracking-[1.5px] uppercase">Name</label>
                    <motion.div
                      animate={{ boxShadow: fieldShadow(focused === 'name') }}
                      transition={{ duration: 0.25 }}
                      className="relative rounded-xl"
                    >
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200" style={{ color: focused === 'name' ? TEAL : 'rgba(255,255,255,0.3)' }}>
                        <UserIcon />
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused(null)}
                        required minLength={2} maxLength={50}
                        spellCheck={false} autoComplete="name" autoCapitalize="words"
                        className={inputCls}
                        style={{ background: fieldBg }}
                        placeholder="Your display name"
                      />
                    </motion.div>
                  </motion.div>

                  {/* Email */}
                  <motion.div variants={fadeUp}>
                    <label className="font-game text-[11px] text-white/45 block mb-2 font-semibold tracking-[1.5px] uppercase">Email</label>
                    <motion.div
                      animate={{ boxShadow: fieldShadow(focused === 'email') }}
                      transition={{ duration: 0.25 }}
                      className="relative rounded-xl"
                    >
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200" style={{ color: focused === 'email' ? TEAL : 'rgba(255,255,255,0.3)' }}>
                        <MailIcon />
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                        required spellCheck={false} autoComplete="email" autoCapitalize="off"
                        className={inputCls}
                        style={{ background: fieldBg }}
                        placeholder="you@example.com"
                      />
                    </motion.div>
                  </motion.div>

                  {/* Password */}
                  <motion.div variants={fadeUp}>
                    <label className="font-game text-[11px] text-white/45 block mb-2 font-semibold tracking-[1.5px] uppercase">Password</label>
                    <motion.div
                      animate={{ boxShadow: fieldShadow(focused === 'password') }}
                      transition={{ duration: 0.25 }}
                      className="relative rounded-xl"
                    >
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200" style={{ color: focused === 'password' ? TEAL : 'rgba(255,255,255,0.3)' }}>
                        <LockIcon />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                        required minLength={8}
                        className={inputCls.replace('pr-4', 'pr-11')}
                        style={{ background: fieldBg }}
                        placeholder="Min 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55 transition-colors z-10"
                      >
                        {showPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        )}
                      </button>
                    </motion.div>
                  </motion.div>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 bg-red-500/[0.07] border border-red-500/15 rounded-xl px-4 py-3">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <p className="font-game text-[12px] text-red-400/90 font-medium">{error}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Create Account Button */}
                  <motion.div variants={fadeUp} className="pt-1.5">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={!loading ? { y: -2, boxShadow: '0 10px 34px rgba(94,196,196,0.34), 0 0 50px rgba(94,196,196,0.12), inset 0 1px 0 rgba(255,255,255,0.22)' } : {}}
                      whileTap={!loading ? { scale: 0.978 } : {}}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className={`group relative w-full py-[15px] rounded-xl font-game text-[14px] font-bold tracking-wide overflow-hidden
                        ${loading ? 'bg-white/5 text-white/25 cursor-not-allowed' : 'text-[#07161a]'}`}
                      style={!loading ? {
                        background: 'linear-gradient(135deg, #7BD6D2 0%, #5EC4C4 45%, #3D9690 100%)',
                        boxShadow: '0 6px 20px rgba(94,196,196,0.26), inset 0 1px 0 rgba(255,255,255,0.28)',
                      } : undefined}
                    >
                      {!loading && (
                        <motion.div
                          className="absolute inset-0"
                          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)' }}
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
                        />
                      )}
                      <span className="relative flex items-center justify-center gap-2">
                        {loading && <div className="w-4 h-4 border-2 border-[#07161a]/25 border-t-[#07161a]/70 rounded-full animate-spin" />}
                        {loading ? 'Creating account...' : 'Create account'}
                        {!loading && (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        )}
                      </span>
                    </motion.button>
                  </motion.div>
                </motion.form>

                {/* Divider */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-3.5 my-5">
                  <motion.div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10))' }} initial={{ scaleX: 0, originX: 1 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }} />
                  <span className="font-game text-[10px] text-white/25 uppercase tracking-[2px] font-semibold">or</span>
                  <motion.div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.10), transparent)' }} initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }} />
                </motion.div>

                {/* Google */}
                <form ref={googleFormRef} action="/api/auth/signin/google" method="POST" className="hidden">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <input type="hidden" name="callbackUrl" value="/" />
                </form>
                <motion.div initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as const }}>
                  <motion.button
                    type="button"
                    onClick={handleGoogleSignup}
                    disabled={googleLoading || !csrfToken}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.055)', borderColor: 'rgba(255,255,255,0.14)' }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl
                              font-game text-[13px] font-semibold text-white/65
                              border border-white/[0.07] transition-colors duration-200
                              disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(255,255,255,0.025)' }}
                  >
                    {googleLoading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    <span>{googleLoading ? 'Redirecting...' : 'Continue with Google'}</span>
                  </motion.button>
                </motion.div>

                {/* Login link */}
                <motion.p initial={{ y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.9 }} className="text-center mt-6 font-game text-[12px] text-white/35 font-medium">
                  Already have an account?{' '}
                  <a href="/login" className="text-[#5EC4C4] hover:text-[#7DD8D8] transition-colors duration-200 font-semibold cursor-pointer relative z-50">
                    Log in
                  </a>
                </motion.p>
              </div>
            </motion.div>

            {/* Trust footnote */}
            <motion.p variants={fadeUp} className="text-center mt-5 font-game text-[11px] text-white/30 flex items-center justify-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Encrypted &amp; secure. We never share your details.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
