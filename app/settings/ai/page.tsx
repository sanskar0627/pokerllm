'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { PROVIDER_LIST, type ProviderId, type ProviderInfo, type ProviderConfigDTO } from '@/lib/aiProviders/catalog'
import { ModelLogo } from '@/components/lobby/LLMSelector'

/* ─────────────────────────────────────────────────────────────────────────────
   AI Provider Settings — BYOK management.
   Keys are write-only from this page's perspective: after saving, the server
   only ever returns the last 4 characters.
   ──────────────────────────────────────────────────────────────────────────── */

type Busy = 'save' | 'test' | 'delete' | null

interface CardState {
  apiKey:     string
  model:      string
  customModel: string
  useCustomModel: boolean
  baseUrl:    string
  customName: string
  busy:       Busy
  error:      string
  success:    string
}

function emptyCardState(info: ProviderInfo, cfg?: ProviderConfigDTO): CardState {
  const knownModel = cfg && info.models.some(m => m.id === cfg.model)
  return {
    apiKey: '',
    model: knownModel ? cfg!.model : (info.models[0]?.id ?? ''),
    customModel: cfg && !knownModel ? cfg.model : '',
    useCustomModel: Boolean(cfg && !knownModel) || info.models.length === 0,
    baseUrl: cfg?.baseUrl ?? info.baseUrl ?? '',
    customName: cfg?.customName ?? '',
    busy: null,
    error: '',
    success: '',
  }
}

/* ── Small bits ─────────────────────────────────────────────────────────── */

function StatusChip({ cfg }: { cfg?: ProviderConfigDTO }) {
  if (!cfg) {
    return <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-white/30 bg-white/[0.03]">Not connected</span>
  }
  if (cfg.status === 'valid') {
    return (
      <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300 bg-emerald-500/10 flex items-center gap-1">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        Connected ••••{cfg.keyLast4}
      </span>
    )
  }
  if (cfg.status === 'invalid') {
    return <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-400/30 text-red-300 bg-red-500/10">Key invalid</span>
  }
  return <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300 bg-amber-500/10">Saved ••••{cfg.keyLast4} — untested</span>
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return <div className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${dark ? 'border-[#1a0a2e]/25 border-t-[#1a0a2e]/80' : 'border-white/20 border-t-white/70'}`} />
}

const inputCls =
  'w-full rounded-lg px-3.5 py-2.5 font-game text-[13px] text-white/90 panel-inset ' +
  'placeholder:text-white/20 focus:outline-none focus:border-[#FFD700]/40 transition-colors duration-200'

const labelCls = 'font-game text-[10px] text-white/40 block mb-1.5 font-semibold tracking-[1.5px] uppercase'

/* ── Provider card ──────────────────────────────────────────────────────── */

function ProviderCard({
  info, cfg, expanded, onToggle, onSaved, onDeleted,
}: {
  info:      ProviderInfo
  cfg?:      ProviderConfigDTO
  expanded:  boolean
  onToggle:  () => void
  onSaved:   (c: ProviderConfigDTO) => void
  onDeleted: () => void
}) {
  const [s, setS] = useState<CardState>(() => emptyCardState(info, cfg))

  // Re-seed the form when the panel opens (adjust-state-during-render pattern —
  // React's sanctioned alternative to a setState-in-effect).
  const [wasExpanded, setWasExpanded] = useState(expanded)
  if (expanded !== wasExpanded) {
    setWasExpanded(expanded)
    if (expanded) setS(emptyCardState(info, cfg))
  }

  const patch = (p: Partial<CardState>) => setS(prev => ({ ...prev, ...p, error: '', success: '' }))

  async function call(path: string, init: RequestInit): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data }
  }

  async function handleSave() {
    const model = s.useCustomModel ? s.customModel.trim() : s.model
    if (!model) return patch({ error: 'Pick or type a model' })
    if (!cfg && !s.apiKey.trim() && info.requiresKey) return patch({ error: 'API key is required' })

    setS(prev => ({ ...prev, busy: 'save', error: '', success: '' }))
    const { ok, data } = await call('/api/settings/providers', {
      method: 'PUT',
      body: JSON.stringify({
        provider: info.id,
        apiKey: s.apiKey.trim() || undefined,
        model,
        baseUrl: info.allowsBaseUrl ? (s.baseUrl.trim() || undefined) : undefined,
        customName: info.isCustom ? (s.customName.trim() || undefined) : undefined,
      }),
    })
    if (ok) {
      onSaved(data.config as unknown as ProviderConfigDTO)
      setS(prev => ({ ...prev, busy: null, apiKey: '', success: 'Saved — run a test to verify', error: '' }))
    } else {
      setS(prev => ({ ...prev, busy: null, error: String(data.error ?? 'Save failed') }))
    }
  }

  async function handleTest() {
    setS(prev => ({ ...prev, busy: 'test', error: '', success: '' }))
    const { ok, data } = await call('/api/settings/providers/test', {
      method: 'POST',
      body: JSON.stringify({ provider: info.id }),
    })
    if (data.config) onSaved(data.config as unknown as ProviderConfigDTO)
    setS(prev => ({
      ...prev, busy: null,
      success: ok && data.ok ? String(data.message) : '',
      error: ok && data.ok ? '' : String(data.message ?? data.error ?? 'Test failed'),
    }))
  }

  async function handleDelete() {
    setS(prev => ({ ...prev, busy: 'delete', error: '', success: '' }))
    const { ok, data } = await call(`/api/settings/providers/${info.id}`, { method: 'DELETE' })
    if (ok) onDeleted()
    else setS(prev => ({ ...prev, busy: null, error: String(data.error ?? 'Delete failed') }))
  }

  const displayLabel = info.isCustom && cfg?.customName ? cfg.customName : info.label

  return (
    <div className={`panel-glass rounded-xl overflow-hidden transition-all duration-300 ${expanded ? 'ring-1 ring-[#FFD700]/25' : ''}`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Logo */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-white/10"
          style={{ background: `${info.accent}14`, color: info.accent }}
        >
          <ModelLogo id={info.id} className="w-5 h-5" />
          {['mistral', 'openrouter', 'ollama', 'custom'].includes(info.id) && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {info.id === 'ollama'
                ? <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 10h.01M15 10h.01M9 15c1 1 5 1 6 0"/></>
                : info.id === 'custom'
                ? <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>
                : <><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></>}
            </svg>
          )}
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-game text-[14px] font-bold text-white/90">{displayLabel}</span>
            <span className="font-game text-[10px] text-white/30">{info.company}</span>
            {info.playable && (
              <span className="font-pixel text-[5px] text-[#FFD700]/60 border border-[#FFD700]/20 rounded px-1.5 py-0.5 tracking-wider">TABLE</span>
            )}
          </div>
          <div className="mt-1"><StatusChip cfg={cfg} /></div>
        </div>

        {/* Model + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          {cfg && <span className="hidden sm:block font-game text-[11px] text-white/35 max-w-[160px] truncate">{cfg.model}</span>}
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </div>
      </button>

      {/* Expanded settings */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/[0.05]">

              {/* Custom provider name */}
              {info.isCustom && (
                <div className="pt-3">
                  <label className={labelCls}>Provider name <span className="text-white/20 normal-case">(optional)</span></label>
                  <input
                    type="text" value={s.customName} maxLength={40}
                    onChange={e => patch({ customName: e.target.value })}
                    placeholder="My AI provider" className={inputCls} spellCheck={false}
                  />
                </div>
              )}

              {/* API key */}
              <div className={info.isCustom ? '' : 'pt-3'}>
                <label className={labelCls}>
                  API key
                  {cfg && <span className="text-white/20 normal-case"> — saved ••••{cfg.keyLast4}; enter a new key to replace</span>}
                  {!info.requiresKey && <span className="text-white/20 normal-case"> (optional for local)</span>}
                </label>
                <input
                  type="password" value={s.apiKey}
                  onChange={e => patch({ apiKey: e.target.value })}
                  placeholder={cfg ? '••••••••••••••••' : 'Enter your API key'}
                  className={inputCls}
                  autoComplete="off" spellCheck={false}
                />
                {info.docsUrl && (
                  <a href={info.docsUrl} target="_blank" rel="noopener noreferrer"
                     className="group inline-flex items-center gap-1 font-game text-[10.5px] text-[#FFD700]/50 hover:text-[#FFD700]/80 transition-colors mt-1">
                    Get a key from {info.company}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                         className="transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px">
                      <path d="M7 17 17 7" /><path d="M8 7h9v9" />
                    </svg>
                  </a>
                )}
              </div>

              {/* Base URL */}
              {info.allowsBaseUrl && (
                <div>
                  <label className={labelCls}>Base URL {info.id === 'custom' ? '' : '(optional)'}</label>
                  <input
                    type="text" value={s.baseUrl}
                    onChange={e => patch({ baseUrl: e.target.value })}
                    placeholder={info.baseUrl ?? 'https://api.example.com/v1'}
                    className={inputCls} spellCheck={false} autoCapitalize="off"
                  />
                </div>
              )}

              {/* Model */}
              <div>
                <label className={labelCls}>Model</label>
                {info.models.length > 0 && !s.useCustomModel ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {info.models.map(m => (
                        <button
                          key={m.id}
                          onClick={() => patch({ model: m.id })}
                          className={`text-left rounded-lg px-3 py-2.5 border transition-all duration-150
                            ${s.model === m.id
                              ? 'border-[#FFD700]/60 bg-[#FFD700]/[0.07] shadow-[0_0_12px_rgba(255,215,0,0.1)]'
                              : 'panel-inset hover:border-white/20'}`}
                        >
                          <span className={`font-game text-[12.5px] font-semibold block ${s.model === m.id ? 'text-[#FFD700]' : 'text-white/75'}`}>{m.label}</span>
                          <span className="font-game text-[10.5px] text-white/35">{m.description}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => patch({ useCustomModel: true })}
                            className="font-game text-[10.5px] text-white/30 hover:text-white/55 transition-colors underline underline-offset-2">
                      Use a custom model id instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text" value={s.customModel}
                      onChange={e => patch({ customModel: e.target.value })}
                      placeholder="model-id (exactly as the provider expects)"
                      className={inputCls} spellCheck={false} autoCapitalize="off"
                    />
                    {info.models.length > 0 && (
                      <button onClick={() => patch({ useCustomModel: false })}
                              className="font-game text-[10.5px] text-white/30 hover:text-white/55 transition-colors underline underline-offset-2">
                        Back to suggested models
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {(s.error || s.success) && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 border font-game text-[12px]
                      ${s.error ? 'bg-red-500/[0.07] border-red-500/15 text-red-300/90' : 'bg-emerald-500/[0.07] border-emerald-500/15 text-emerald-300/90'}`}
                  >
                    {s.error || s.success}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={s.busy !== null}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-game text-[12.5px] font-bold text-[#1a0a2e]
                             transition-all duration-150 hover:-translate-y-px active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #FFE27A 0%, #FFD700 45%, #C49630 100%)', boxShadow: '0 4px 14px rgba(255,215,0,0.2)' }}
                >
                  {s.busy === 'save' && <Spinner dark />}
                  {cfg ? 'Update' : 'Save'}
                </button>

                {cfg && (
                  <button
                    onClick={handleTest}
                    disabled={s.busy !== null}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-game text-[12.5px] font-semibold text-white/70
                               panel-inset hover:border-[#FFD700]/35 hover:text-white/90 transition-all duration-150 active:scale-[0.98]
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {s.busy === 'test' ? <Spinner /> : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    )}
                    Test connection
                  </button>
                )}

                {cfg && (
                  <button
                    onClick={handleDelete}
                    disabled={s.busy !== null}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-game text-[12.5px] font-semibold text-red-300/60
                               border border-red-500/15 bg-red-500/[0.04] hover:bg-red-500/10 hover:text-red-300 transition-all duration-150 active:scale-[0.98]
                               disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                  >
                    {s.busy === 'delete' ? <Spinner /> : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    )}
                    Remove
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function AiSettingsPage() {
  const { status } = useSession()
  const router = useRouter()

  const [configs, setConfigs] = useState<Map<ProviderId, ProviderConfigDTO>>(new Map())
  const [expanded, setExpanded] = useState<ProviderId | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/settings/providers')
      .then(r => r.json())
      .then((data: { configs?: ProviderConfigDTO[] }) => {
        setConfigs(new Map((data.configs ?? []).map(c => [c.provider, c])))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status])

  const upsertLocal = useCallback((c: ProviderConfigDTO) => {
    setConfigs(prev => new Map(prev).set(c.provider, c))
  }, [])

  const removeLocal = useCallback((id: ProviderId) => {
    setConfigs(prev => { const m = new Map(prev); m.delete(id); return m })
    setExpanded(null)
  }, [])

  const connectedCount = configs.size

  return (
    <main className="relative min-h-screen min-h-[100dvh] overflow-hidden">
      <img src="/images/table-room-bg.png" alt="" fetchPriority="high" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 min-h-screen py-2.5 sm:py-6">
        <div className="max-w-3xl mx-auto px-2.5 sm:px-6">

          {/* Top bar — same chrome as profile */}
          <div className="relative mb-3 sm:mb-6 overflow-hidden rounded-lg sm:rounded-xl border border-[#FFD700]/20 sm:border-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <img src="/images/topbar-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 flex items-center justify-between px-2.5 sm:px-5 py-1.5 sm:py-3">
              <Link
                href="/"
                className="font-pixel text-[6px] sm:text-[9px] text-[#FFD700] hover:text-[#FFD700]/80 bg-black/40 border border-[#FFD700]/30 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 transition-all active:scale-95 tracking-wide shadow-md touch-manipulation min-h-[32px] flex items-center gap-1"
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                <span className="hidden sm:inline">LOBBY</span>
              </Link>
              <h1 className="font-pixel font-bold text-[8px] sm:text-[13px] text-[#FFD700] tracking-[2px] sm:tracking-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                AI PROVIDERS
              </h1>
              <Link href="/profile" className="font-pixel text-[6px] sm:text-[9px] text-white/50 hover:text-white/80 bg-black/40 border border-white/15 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 transition-all active:scale-95 tracking-wide min-h-[32px] flex items-center">
                PROFILE
              </Link>
            </div>
          </div>

          {/* Intro card */}
          <div className="panel-glass rounded-xl p-4 sm:p-5 mb-3 sm:mb-5 animate-fade-up">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <h2 className="font-game text-[14px] font-bold text-white/90">Bring your own keys</h2>
                <p className="font-game text-[12px] text-white/40 leading-relaxed mt-1">
                  Connect your own AI accounts and games run on your keys and your chosen models.
                  Keys are encrypted with AES-256 before they touch the database, never leave the
                  server, and never appear in this page again after saving.
                  {connectedCount > 0 && <span className="text-[#FFD700]/70"> {connectedCount} provider{connectedCount > 1 ? 's' : ''} connected.</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Provider cards */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-[3px] border-[#FFD700] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-2.5 animate-fade-up">
              {PROVIDER_LIST.map(info => (
                <ProviderCard
                  key={info.id}
                  info={info}
                  cfg={configs.get(info.id)}
                  expanded={expanded === info.id}
                  onToggle={() => setExpanded(prev => prev === info.id ? null : info.id)}
                  onSaved={upsertLocal}
                  onDeleted={() => removeLocal(info.id)}
                />
              ))}
            </div>
          )}

          <p className="font-game text-[10.5px] text-white/20 text-center mt-5 mb-2 px-4">
            Providers tagged <span className="font-pixel text-[5px] text-[#FFD700]/50 border border-[#FFD700]/15 rounded px-1 py-0.5 mx-0.5 tracking-wider">TABLE</span>
            play at the poker table today. Others are stored, validated, and ready as new seats open up.
          </p>

          <div className="h-4 sm:h-8" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }} />
        </div>
      </div>
    </main>
  )
}
