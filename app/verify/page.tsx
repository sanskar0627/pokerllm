'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
}

const fadeUp = {
  hidden: { y: 18 },
  show: { y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as const } },
}

const scaleFade = {
  hidden: { scale: 0.92 },
  show: { scale: 1, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } },
}

function VerifyPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'logging-in' | 'error'>('pending')
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const verifyOnce = useRef(false)

  // When user lands with ?token= (clicked email link) → verify immediately.
  // Guard against React StrictMode double-invoke / re-renders so the one-time
  // token is only consumed once.
  useEffect(() => {
    if (token && !verifyOnce.current) {
      verifyOnce.current = true
      verifyToken(token)
    }
  }, [token])

  // When user lands with ?email= (just signed up, waiting) → poll for verification
  useEffect(() => {
    if (!token && email && status === 'pending') {
      startPolling(email)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [token, email, status])

  function startPolling(emailAddr: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/check-verified?email=${encodeURIComponent(emailAddr)}`)
        const data = await res.json()
        if (data.verified) {
          if (pollRef.current) clearInterval(pollRef.current)
          setStatus('success')
          setMessage('Email verified! Logging you in...')
          autoLogin()
        }
      } catch {
        // Silent fail — keep polling
      }
    }, 3000)
  }

  async function verifyToken(t: string) {
    setStatus('verifying')
    try {
      // The 'verify-token' provider validates the token, marks the account
      // verified, consumes the token, and signs the user in — all server-side.
      // This works even in a brand-new tab (no saved password needed), so the
      // email link can land directly on the home page.
      const res = await signIn('verify-token', { token: t, redirect: false })

      if (res?.ok) {
        sessionStorage.removeItem('signup_email')
        setStatus('success')
        setMessage('Email verified! Taking you to the table...')
        window.location.href = '/'
      } else {
        setStatus('error')
        setMessage('This verification link is invalid or has expired.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  async function autoLogin() {
    setStatus('logging-in')
    sessionStorage.removeItem('signup_email')
    setMessage('Email verified! Redirecting to login...')
    setTimeout(() => { window.location.href = '/login' }, 1500)
  }

  async function handleResend() {
    if (!email || resending || resendCooldown > 0) return
    setResending(true)
    setResendSuccess(false)
    setResendError('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setResendSuccess(true)
        // Auto-hide success message after 5 seconds
        setTimeout(() => setResendSuccess(false), 5000)
        // Start 60s cooldown
        setResendCooldown(60)
        cooldownRef.current = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              if (cooldownRef.current) clearInterval(cooldownRef.current)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        setResendError(data.error || 'Failed to resend verification email')
        setTimeout(() => setResendError(''), 5000)
      }
    } catch {
      setResendError('Network error. Please try again.')
      setTimeout(() => setResendError(''), 5000)
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="relative w-full min-h-screen overflow-hidden bg-[#080510] flex items-center justify-center">
      {/* Background images */}
      <img
        src="/images/home-bg-mobile.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover lg:hidden"
      />
      <img
        src="/images/home-bg-desktop.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover hidden lg:block"
      />
      <div className="absolute inset-0 bg-black/55" />

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.03) 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          {/* Spade emblem */}
          <motion.div variants={scaleFade} className="flex justify-center mb-[-22px] relative z-20">
            <motion.div
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #16102a 0%, #0e0a1e 100%)',
                boxShadow: '0 0 24px rgba(255,215,0,0.08), 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,215,0,0.1)',
              }}
              animate={{ boxShadow: [
                '0 0 20px rgba(255,215,0,0.06), 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,215,0,0.08)',
                '0 0 28px rgba(255,215,0,0.18), 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,215,0,0.16)',
                '0 0 20px rgba(255,215,0,0.06), 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,215,0,0.08)',
              ] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg width="24" height="26" viewBox="0 0 24 26" fill="none">
                <path d="M12 1C12 1 3 9.5 3 14c0 2.8 2.2 4.5 4.5 4.5 1.4 0 2.6-.7 3.3-1.6-.2 1.3-.8 2.8-1.8 3.8h6c-1-.9-1.6-2.5-1.8-3.8.7.9 1.9 1.6 3.3 1.6C18.8 18.5 21 16.8 21 14 21 9.5 12 1 12 1z"
                      fill="url(#spadeGVerify)" />
                <defs>
                  <linearGradient id="spadeGVerify" x1="12" y1="1" x2="12" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFD700" />
                    <stop offset="0.55" stopColor="#D4A537" />
                    <stop offset="1" stopColor="#A67C1A" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </motion.div>

          {/* Card */}
          <motion.div
            variants={fadeUp}
            className="relative rounded-[20px]"
            style={{
              background: 'linear-gradient(180deg, rgba(22,16,42,0.94) 0%, rgba(14,10,30,0.96) 100%)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
              backdropFilter: 'blur(40px)',
            }}
          >
            {/* Top shimmer */}
            <div className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden">
              <motion.div
                className="h-full w-[60%]"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)' }}
                animate={{ x: ['-60%', '160%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
              />
            </div>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none"
                 style={{ background: 'radial-gradient(circle at 0% 0%, rgba(255,215,0,0.03) 0%, transparent 70%)' }} />
            <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none"
                 style={{ background: 'radial-gradient(circle at 100% 0%, rgba(255,215,0,0.03) 0%, transparent 70%)' }} />

            <div className="relative px-8 sm:px-10 pt-14 pb-8">
              <AnimatePresence mode="wait">

                {/* ── PENDING: Waiting for email verification ── */}
                {!token && status === 'pending' && (
                  <motion.div
                    key="pending"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="text-center"
                  >
                    {/* Animated envelope */}
                    <motion.div
                      className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(255,215,0,0.02) 100%)',
                        border: '1px solid rgba(255,215,0,0.08)',
                      }}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <polyline points="22,4 12,13 2,4"/>
                      </svg>
                    </motion.div>

                    <motion.h2
                      variants={fadeUp}
                      className="font-game text-[20px] font-bold text-white tracking-wide mb-2"
                    >
                      Check your email
                    </motion.h2>

                    <motion.p
                      variants={fadeUp}
                      className="font-game text-[13px] text-white/35 leading-relaxed mb-1"
                    >
                      We sent a verification link to
                    </motion.p>

                    {email && (
                      <motion.p
                        variants={fadeUp}
                        className="font-game text-[14px] font-semibold mb-5"
                        style={{ color: 'rgba(255,215,0,0.7)' }}
                      >
                        {email}
                      </motion.p>
                    )}

                    <motion.p
                      variants={fadeUp}
                      className="font-game text-[12px] text-white/25 leading-relaxed"
                    >
                      Click the link in the email to verify your account.
                      <br />
                      Can&apos;t find it? Check your spam folder.
                    </motion.p>

                    {/* Polling indicator */}
                    <motion.div
                      className="mt-6 flex items-center justify-center gap-2.5"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <div className="flex gap-1">
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#FFD700]/50"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                        />
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#FFD700]/50"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#FFD700]/50"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                      <p className="font-game text-[11px] text-white/25">
                        Waiting for verification
                      </p>
                    </motion.div>

                    {/* Resend button */}
                    <div className="mt-6 pt-5 border-t border-white/[0.04]">
                      <motion.button
                        type="button"
                        onClick={handleResend}
                        disabled={resending || resendCooldown > 0}
                        whileHover={!(resending || resendCooldown > 0) ? { backgroundColor: 'rgba(255,215,0,0.06)' } : {}}
                        whileTap={!(resending || resendCooldown > 0) ? { scale: 0.98 } : {}}
                        className="w-full py-3 rounded-xl font-game text-[13px] font-semibold
                                   border border-white/[0.06] transition-all duration-200
                                   disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          color: resendCooldown > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,215,0,0.65)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        {resending ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-3.5 h-3.5 border-[1.5px] border-[#FFD700]/20 border-t-[#FFD700]/60 rounded-full animate-spin" />
                            Sending...
                          </span>
                        ) : resendCooldown > 0 ? (
                          `Resend in ${resendCooldown}s`
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10"/>
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                            Resend verification email
                          </span>
                        )}
                      </motion.button>

                      {/* Resend feedback */}
                      <AnimatePresence>
                        {resendSuccess && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -8, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-3 overflow-hidden"
                          >
                            <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-green-500/[0.06] border border-green-500/10">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              <p className="font-game text-[12px] text-green-400/80 font-medium">
                                Verification email sent!
                              </p>
                            </div>
                          </motion.div>
                        )}
                        {resendError && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -8, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-3 overflow-hidden"
                          >
                            <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-red-500/[0.06] border border-red-500/10">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                              <p className="font-game text-[12px] text-red-400/80 font-medium">
                                {resendError}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Back to login */}
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-center mt-5 font-game text-[12px] text-white/20 font-medium"
                    >
                      <Link href="/login" className="text-white/30 hover:text-white/50 transition-colors duration-200 underline underline-offset-2 decoration-white/10 hover:decoration-white/20">
                        Back to login
                      </Link>
                    </motion.p>
                  </motion.div>
                )}

                {/* ── VERIFYING: Spinner ── */}
                {status === 'verifying' && (
                  <motion.div
                    key="verifying"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      className="w-12 h-12 mx-auto mb-5 rounded-full border-2 border-[#FFD700]/15 border-t-[#FFD700]/70"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <p className="font-game text-[14px] text-white/50 font-medium">
                      Verifying your email...
                    </p>
                  </motion.div>
                )}

                {/* ── SUCCESS / LOGGING IN ── */}
                {(status === 'success' || status === 'logging-in') && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center py-4"
                  >
                    {/* Success checkmark */}
                    <motion.div
                      className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,255,136,0.02) 100%)',
                        border: '1px solid rgba(0,255,136,0.12)',
                      }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    >
                      <motion.svg
                        width="28" height="28" viewBox="0 0 24 24" fill="none"
                        stroke="#00FF88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                      >
                        <polyline points="20 6 9 17 4 12"/>
                      </motion.svg>
                    </motion.div>

                    <motion.h2
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="font-game text-[20px] font-bold text-white tracking-wide mb-2"
                    >
                      Verified!
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                      className="font-game text-[13px] text-white/40 mb-5"
                    >
                      {message}
                    </motion.p>

                    {status === 'logging-in' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full border-[1.5px] border-[#00FF88]/20 border-t-[#00FF88]/70"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        <span className="font-game text-[11px] text-[#00FF88]/50">
                          Logging you in...
                        </span>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── ERROR ── */}
                {status === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="text-center py-4"
                  >
                    {/* Error icon */}
                    <motion.div
                      className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,80,80,0.08) 0%, rgba(255,80,80,0.02) 100%)',
                        border: '1px solid rgba(255,80,80,0.12)',
                      }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,100,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </motion.div>

                    <h2 className="font-game text-[20px] font-bold text-white tracking-wide mb-2">
                      Verification failed
                    </h2>

                    <p className="font-game text-[13px] text-white/40 mb-6 leading-relaxed">
                      {message}
                    </p>

                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-game text-[13px] font-semibold
                                 transition-all duration-200 hover:opacity-80"
                      style={{
                        color: '#1a0a2e',
                        background: 'linear-gradient(135deg, #FFD700 0%, #D4A537 60%, #C49630 100%)',
                        boxShadow: '0 4px 16px rgba(255,215,0,0.15)',
                      }}
                    >
                      Try signing up again
                    </Link>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-center mt-5 font-game text-[12px] text-white/20 font-medium"
                    >
                      <Link href="/login" className="text-white/30 hover:text-white/50 transition-colors duration-200 underline underline-offset-2 decoration-white/10 hover:decoration-white/20">
                        Back to login
                      </Link>
                    </motion.p>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </main>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <main className="relative w-full min-h-screen overflow-hidden bg-[#080510] flex items-center justify-center">
        <img src="/images/home-bg-mobile.png" alt="" className="absolute inset-0 w-full h-full object-cover lg:hidden" />
        <img src="/images/home-bg-desktop.png" alt="" className="absolute inset-0 w-full h-full object-cover hidden lg:block" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#FFD700]/20 border-t-[#FFD700]/70 rounded-full animate-spin" />
        </div>
      </main>
    }>
      <VerifyPageContent />
    </Suspense>
  )
}
