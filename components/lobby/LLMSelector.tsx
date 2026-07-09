'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AIModel } from '@/types/poker'
import { AI_META_LIST } from '@/lib/aiMeta'
import { PROVIDERS, OPENROUTER_KEYS_URL, type ProviderId, type ProviderConfigDTO, type KeyVia } from '@/lib/aiProviders/catalog'

/* ─────────────────────────────────────────────────────────────────────────────
   AI player selector with INLINE provider configuration.
   Selecting a provider slides open a panel under its card:
     column 1 — paste your API key (write-only; server returns last-4 only)
     column 2 — Apple-style model list + free-form "custom model" row
   The "Custom AI" card connects any OpenAI-compatible endpoint.
   ──────────────────────────────────────────────────────────────────────────── */

// ─── Custom Inline SVGs for AI Models ─────────────────────────────────────────

const ClaudeLogo = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 0 1-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
  </svg>
)

const ChatGPTLogo = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
  </svg>
)

const GeminiLogo = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
  </svg>
)

const GrokLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
  </svg>
)

const DeepSeekLogo = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" />
  </svg>
)

const GroqLogo = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5 22.5 17.799 22.5 12 17.799 1.5 12 1.5zm0 2.25a8.25 8.25 0 110 16.5 8.25 8.25 0 010-16.5z" fill="currentColor"/>
    <path d="M12 6.75a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5zm0 2.25a3 3 0 110 6 3 3 0 010-6z" fill="currentColor"/>
    <path d="M18.75 11.25h-3v1.5h3v3h1.5v-3a1.5 1.5 0 00-1.5-1.5z" fill="currentColor"/>
  </svg>
)

const CustomLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
  </svg>
)

export function ModelLogo({ id, className }: { id: string; className?: string }) {
  if (id === 'claude') return <ClaudeLogo className={className} />
  if (id === 'chatgpt') return <ChatGPTLogo className={className} />
  if (id === 'gemini') return <GeminiLogo className={className} />
  if (id === 'grok') return <GrokLogo className={className} />
  if (id === 'deepseek') return <DeepSeekLogo className={className} />
  if (id === 'groq') return <GroqLogo className={className} />
  if (id === 'custom') return <CustomLogo className={className} />
  return null
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg px-3 py-2.5 font-game text-[13px] text-white/90 panel-inset ' +
  'placeholder:text-white/20 focus:outline-none focus:border-[#FFD700]/40 transition-colors duration-200'

function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`inline-block w-3.5 h-3.5 border-2 rounded-full animate-spin align-middle ${dark ? 'border-[#1a0a2e]/25 border-t-[#1a0a2e]/80' : 'border-white/20 border-t-white/70'}`} />
}

type KeyStatus = 'none' | 'unverified' | 'valid' | 'invalid'

function keyStatus(cfg?: ProviderConfigDTO): KeyStatus {
  if (!cfg) return 'none'
  return cfg.status === 'valid' ? 'valid' : cfg.status === 'invalid' ? 'invalid' : 'unverified'
}

const STATUS_DOT: Record<KeyStatus, string> = {
  none:       '',
  unverified: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]',
  valid:      'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]',
  invalid:    'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]',
}

// ─── Inline config panel (slides open under a selected card) ─────────────────

function ConfigPanel({
  id, cfg, customConfigs = [], onSaved, onReady, onDeleted,
}: {
  id:      AIModel
  cfg?:    ProviderConfigDTO
  customConfigs?: ProviderConfigDTO[]          // all saved custom endpoints (custom card only)
  onSaved: (c: ProviderConfigDTO) => void
  onReady: (id: AIModel) => void
  onDeleted?: (slot: number) => void
}) {
  const info = PROVIDERS[id as ProviderId]
  const canUseOpenRouter = info.playable && !info.isCustom && info.id !== 'openrouter' && info.id !== 'ollama'
  const knownModel = cfg && info.models.some(m => m.id === cfg.model || m.orId === cfg.model)

  const [via, setVia]                 = useState<KeyVia>(cfg?.via ?? 'official')
  const [slot, setSlot]               = useState(cfg?.slot ?? 0)   // custom endpoints: which slot the form edits
  const [apiKey, setApiKey]           = useState('')
  const [showKey, setShowKey]         = useState(false)
  const [keyFocused, setKeyFocused]   = useState(false)
  const [model, setModel]             = useState(() => {
    if (cfg) {
      const row = info.models.find(m => m.id === cfg.model || m.orId === cfg.model)
      if (row) return row.id
    }
    return info.models[0]?.id ?? ''
  })
  const [customModel, setCustomModel] = useState(cfg && !knownModel ? cfg.model : '')
  const [customRow, setCustomRow]     = useState(Boolean(cfg && !knownModel) || info.models.length === 0)
  const [baseUrl, setBaseUrl]         = useState(cfg?.baseUrl ?? info.baseUrl ?? '')
  const [customName, setCustomName]   = useState(cfg?.customName ?? '')
  const [busy, setBusy]               = useState<'save' | 'test' | 'model' | null>(null)
  const [msg, setMsg]                 = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  // Panel can be collapsed mid-request — never auto-seat or set state after unmount
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  // If the persisted config's model changes (e.g. a save just landed), adopt it
  const [seenCfgModel, setSeenCfgModel] = useState(cfg?.model)
  if (cfg?.model !== seenCfgModel) {
    setSeenCfgModel(cfg?.model)
    if (cfg?.model) {
      const row = info.models.find(m => m.id === cfg.model || m.orId === cfg.model)
      setCustomRow(!row && info.models.length > 0 ? true : info.models.length === 0)
      if (row) setModel(row.id)
      else setCustomModel(cfg.model)
    }
  }

  /** Map the UI-selected model row to the id we persist for the current route. */
  const wireModelId = (rowId: string): string => {
    if (via !== 'openrouter') return rowId
    const row = info.models.find(m => m.id === rowId)
    return row?.orId ?? rowId
  }
  const activeModel = customRow ? customModel.trim() : wireModelId(model)

  async function api(path: string, init: RequestInit) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
    const data = await res.json().catch(() => ({} as Record<string, unknown>))
    return { ok: res.ok, data: data as Record<string, unknown> }
  }

  /** Persist just a model change (only possible once a key is saved). */
  async function saveModel(nextModel: string) {
    if (!cfg || !nextModel || busy) return
    setBusy('model'); setMsg(null)
    const { ok, data } = await api('/api/settings/providers', {
      method: 'PUT',
      body: JSON.stringify({
        provider: id, model: nextModel, via, slot,
        baseUrl: info.allowsBaseUrl ? (baseUrl.trim() || undefined) : undefined,
        customName: info.isCustom ? (customName.trim() || undefined) : undefined,
      }),
    })
    setBusy(null)
    if (ok) {
      onSaved(data.config as unknown as ProviderConfigDTO)
      setMsg({ text: 'Model saved', kind: 'ok' })
      setTimeout(() => setMsg(m => m?.text === 'Model saved' ? null : m), 1800)
    } else {
      setMsg({ text: String(data.error ?? 'Could not save model'), kind: 'err' })
    }
  }

  function pickModel(m: string) {
    if (busy) return  // no model changes while a save/test request is in flight
    setCustomRow(false)
    setModel(m)
    if (cfg) void saveModel(wireModelId(m))
  }

  /** Save key (+ everything else), then auto-test the connection. */
  async function saveKey() {
    if (!activeModel) return setMsg({ text: 'Choose a model first', kind: 'err' })
    if (!cfg && !apiKey.trim() && info.requiresKey) return setMsg({ text: 'Paste your API key', kind: 'err' })
    if (info.isCustom && !baseUrl.trim()) return setMsg({ text: 'Base URL is required', kind: 'err' })

    setBusy('save'); setMsg(null)
    const { ok, data } = await api('/api/settings/providers', {
      method: 'PUT',
      body: JSON.stringify({
        provider: id, via, slot,
        apiKey: apiKey.trim() || undefined,
        model: activeModel,
        baseUrl: info.allowsBaseUrl ? (baseUrl.trim() || undefined) : undefined,
        customName: info.isCustom ? (customName.trim() || undefined) : undefined,
        // saving a custom endpoint makes it the active one
        makeActive: info.isCustom || undefined,
      }),
    })
    if (!ok) {
      setBusy(null)
      return setMsg({ text: String(data.error ?? 'Save failed'), kind: 'err' })
    }
    onSaved(data.config as unknown as ProviderConfigDTO)
    setApiKey('')

    // Auto-test right after saving a key — one less click.
    setBusy('test')
    const t = await api('/api/settings/providers/test', { method: 'POST', body: JSON.stringify({ provider: id, slot }) })
    setBusy(null)
    if (t.data.config) onSaved(t.data.config as unknown as ProviderConfigDTO)
    if (!aliveRef.current) return // panel closed while testing — don't seat behind the user's back
    if (t.ok && t.data.ok) {
      setMsg({ text: `${String(t.data.message ?? 'Connected')} — seated at the table`, kind: 'ok' })
      onReady(id) // key verified → seat this AI automatically
    } else {
      setMsg({ text: String(t.data.message ?? t.data.error ?? 'Key saved, but the test failed'), kind: 'err' })
    }
  }

  async function testKey() {
    setBusy('test'); setMsg(null)
    const { ok, data } = await api('/api/settings/providers/test', { method: 'POST', body: JSON.stringify({ provider: id, slot }) })
    setBusy(null)
    if (data.config) onSaved(data.config as unknown as ProviderConfigDTO)
    setMsg(ok && data.ok
      ? { text: String(data.message ?? 'Connected'), kind: 'ok' }
      : { text: String(data.message ?? data.error ?? 'Test failed'), kind: 'err' })
  }

  const status = keyStatus(cfg)

  // Staggered entrance for the model rows
  const listStagger = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } } }
  const rowFade = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } } }

  return (
    <div className="relative border-t border-white/[0.06]" style={{ background: 'rgba(0,0,0,0.28)' }}>
      {/* Gold hairline at the seam */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#FFD700]/30 to-transparent" />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.15fr] gap-5 sm:gap-6 px-4 sm:px-5 pt-4 pb-3">

        {/* ── Column 1: API key ── */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel text-[7px] text-[#FFD700]/60 uppercase tracking-[2px] flex items-center gap-1.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {info.isCustom ? 'Your Endpoint' : via === 'openrouter' ? 'OpenRouter Key' : `${info.label} API Key`}
            </span>
            {/* Status chip lives in the header — keeps the column balanced */}
            {status === 'valid' && (
              <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-400/25 text-emerald-300/90 bg-emerald-500/10">
                Connected ••••{cfg!.keyLast4}
              </span>
            )}
            {status === 'unverified' && (
              <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-400/25 text-amber-300/90 bg-amber-500/10">
                Untested
              </span>
            )}
            {status === 'invalid' && (
              <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-400/25 text-red-300/90 bg-red-500/10">
                Invalid key
              </span>
            )}
            {status === 'none' && !info.isCustom && (
              <span className="font-game text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#FFD700]/20 text-[#FFD700]/50 bg-[#FFD700]/[0.04]">
                Key required
              </span>
            )}
          </div>

          {/* Route toggle: provider's official API vs OpenRouter (one key for everything) */}
          {canUseOpenRouter && (
            <div className="relative flex rounded-lg p-0.5 mb-2.5 panel-inset w-fit">
              {(['official', 'openrouter'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => { if (!busy) { setVia(v); setMsg(null) } }}
                  className={`relative px-3 py-1.5 rounded-md font-game text-[11px] font-semibold transition-all duration-200
                    ${via === v ? 'text-[#1a0a2e]' : 'text-white/35 hover:text-white/60'}`}
                >
                  {via === v && (
                    <motion.span
                      layoutId={`via-${id}`}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-md"
                      style={{ background: 'linear-gradient(135deg, #FFE27A 0%, #FFD700 45%, #C49630 100%)' }}
                    />
                  )}
                  <span className="relative">{v === 'official' ? 'Official API' : 'OpenRouter'}</span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2.5">
            {/* Saved custom endpoints — pick active, edit, or delete */}
            {info.isCustom && customConfigs.length > 0 && (
              <div className="panel-inset rounded-lg overflow-hidden mb-1">
                {customConfigs.map((c, i) => (
                  <div key={c.slot} className={`flex items-center gap-2.5 px-3 py-2 ${i > 0 ? 'border-t border-white/[0.05]' : ''} ${c.slot === slot ? 'bg-[#FFD700]/[0.05]' : ''}`}>
                    {/* Active radio */}
                    <button
                      onClick={async () => {
                        if (busy || c.isActive) return
                        const { ok, data } = await api('/api/settings/providers', {
                          method: 'PUT',
                          body: JSON.stringify({ provider: 'custom', slot: c.slot, activateOnly: true }),
                        })
                        if (ok && data.config) onSaved(data.config as unknown as ProviderConfigDTO)
                      }}
                      title={c.isActive ? 'Active endpoint' : 'Make active'}
                      className="shrink-0"
                    >
                      <span className={`block w-3.5 h-3.5 rounded-full border-2 transition-all
                        ${c.isActive ? 'border-[#FFD700] bg-[#FFD700] shadow-[0_0_6px_rgba(255,215,0,0.5)]' : 'border-white/25 hover:border-[#FFD700]/50'}`} />
                    </button>
                    {/* Load into the form for editing */}
                    <button
                      onClick={() => {
                        setSlot(c.slot)
                        setCustomName(c.customName ?? '')
                        setBaseUrl(c.baseUrl ?? '')
                        setCustomModel(c.model)
                        setCustomRow(true)
                        setApiKey('')
                        setMsg(null)
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="font-game text-[12px] font-semibold text-white/75 block truncate">
                        {c.customName || `Endpoint ${c.slot + 1}`}
                        {c.isActive && <span className="font-pixel text-[5px] text-[#FFD700]/70 border border-[#FFD700]/25 rounded px-1 py-0.5 ml-1.5 tracking-wider align-middle">ACTIVE</span>}
                      </span>
                      <span className="font-game text-[10px] text-white/30 block truncate">{c.model} · ••••{c.keyLast4}</span>
                    </button>
                    {/* Delete this endpoint */}
                    <button
                      onClick={async () => {
                        if (busy) return
                        const { ok } = await api(`/api/settings/providers/custom?slot=${c.slot}`, { method: 'DELETE' })
                        if (ok) onDeleted?.(c.slot)
                      }}
                      className="shrink-0 text-white/20 hover:text-red-300/80 transition-colors"
                      aria-label="Delete endpoint"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </div>
                ))}
                {/* Add another endpoint */}
                {customConfigs.length < 10 && (
                  <button
                    onClick={() => {
                      const next = Math.max(...customConfigs.map(c => c.slot)) + 1
                      setSlot(next)
                      setCustomName('')
                      setBaseUrl('')
                      setCustomModel('')
                      setCustomRow(true)
                      setApiKey('')
                      setMsg(null)
                    }}
                    className="w-full px-3 py-2 border-t border-white/[0.05] font-game text-[11px] font-semibold text-[#FFD700]/60 hover:text-[#FFD700]/90 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    + Add another endpoint
                  </button>
                )}
              </div>
            )}

            {info.isCustom && (
              <input
                type="text" value={customName} maxLength={40} spellCheck={false}
                onChange={e => { setCustomName(e.target.value); setMsg(null) }}
                placeholder="Provider name (optional)" className={inputCls}
              />
            )}
            {info.allowsBaseUrl && (
              <input
                type="text" value={baseUrl} spellCheck={false} autoCapitalize="off"
                onChange={e => { setBaseUrl(e.target.value); setMsg(null) }}
                placeholder="https://api.example.com/v1" className={inputCls}
              />
            )}

            {/* Key input — icon, focus glow, show/hide */}
            <div
              className="relative rounded-lg transition-shadow duration-200"
              style={{ boxShadow: keyFocused
                ? '0 0 0 1.5px rgba(255,215,0,0.4), 0 0 18px rgba(255,215,0,0.1)'
                : 'none' }}
            >
              <span className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
                    style={{ color: keyFocused ? '#FFD700' : 'rgba(255,255,255,0.25)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </span>
              <input
                type={showKey ? 'text' : 'password'} value={apiKey} autoComplete="off" spellCheck={false}
                onChange={e => { setApiKey(e.target.value); setMsg(null) }}
                onFocus={() => setKeyFocused(true)}
                onBlur={() => setKeyFocused(false)}
                placeholder={cfg ? `Saved ••••${cfg.keyLast4} — paste to replace` : 'Enter your API key'}
                className={inputCls + ' pl-9 pr-9'}
              />
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55 transition-colors"
                >
                  {showKey ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={saveKey}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg font-game text-[12.5px] font-bold text-[#1a0a2e]
                           transition-all duration-150 hover:-translate-y-px active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #FFE27A 0%, #FFD700 45%, #C49630 100%)', boxShadow: '0 3px 14px rgba(255,215,0,0.22), inset 0 1px 0 rgba(255,255,255,0.3)' }}
              >
                {busy === 'save' && <Spinner dark />}
                {cfg ? 'Update key' : 'Save & connect'}
              </button>
              {cfg && (
                <button
                  onClick={testKey}
                  disabled={busy !== null}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg font-game text-[12.5px] font-semibold text-white/60
                             panel-inset hover:border-[#FFD700]/35 hover:text-white/85 transition-all duration-150 active:scale-[0.98]
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy === 'test' ? <Spinner /> : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                  )}
                  Test
                </button>
              )}
            </div>
          </div>

          {/* Footer: docs link + trust note — anchored to the bottom */}
          <div className="mt-auto pt-3.5 space-y-1.5">
            {(via === 'openrouter' || info.docsUrl) && (
              <a
                href={via === 'openrouter' ? OPENROUTER_KEYS_URL : info.docsUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="group inline-flex items-center gap-1 font-game text-[10.5px] text-[#FFD700]/45 hover:text-[#FFD700]/80 transition-colors"
              >
                Get a key from {via === 'openrouter' ? 'OpenRouter' : info.company}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                     className="transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px">
                  <path d="M7 17 17 7" /><path d="M8 7h9v9" />
                </svg>
              </a>
            )}
            <p className="font-game text-[10px] text-white/20 flex items-center gap-1.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              AES-256 encrypted · never shown again · only you can use it
            </p>
          </div>
        </div>

        {/* ── Column 2: Apple-style model list ── */}
        <div className="sm:border-l sm:border-white/[0.06] sm:pl-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel text-[7px] text-[#FFD700]/60 uppercase tracking-[2px]">Model</span>
            {info.models.length > 0 && (
              <span className="font-game text-[9.5px] text-white/25 tracking-wide">{info.models.length} available</span>
            )}
          </div>
          {!cfg && (
            <p className="font-game text-[10.5px] text-white/25 mb-2 -mt-1">Save your API key and pick a model to seat this player.</p>
          )}

          <div className="panel-inset rounded-xl overflow-hidden">
            <motion.div
              variants={listStagger} initial="hidden" animate="show"
              className="max-h-[236px] overflow-y-auto thinking-scroll"
            >
              {info.models.map((m, i) => {
                const active = !customRow && model === m.id
                return (
                  <motion.button
                    key={m.id}
                    variants={rowFade}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => pickModel(m.id)}
                    className={`relative w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors duration-150
                      ${i > 0 ? 'border-t border-white/[0.05]' : ''}
                      ${active ? '' : 'hover:bg-white/[0.03]'}`}
                  >
                    {/* Sliding gold highlight — glides between rows */}
                    {active && (
                      <motion.span
                        layoutId={`model-highlight-${id}`}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 bg-gradient-to-r from-[#FFD700]/[0.11] to-[#FFD700]/[0.04] border-l-2 border-[#FFD700] pointer-events-none"
                      />
                    )}
                    <span className="relative min-w-0">
                      <span className={`font-game text-[13px] font-semibold block truncate transition-colors duration-150 ${active ? 'text-[#FFD700]' : 'text-white/80'}`}>{m.label}</span>
                      <span className="font-game text-[10.5px] text-white/35 block truncate">{m.description}</span>
                    </span>
                    <span className="relative shrink-0 w-[15px] h-[15px]">
                      <AnimatePresence>
                        {active && (
                          <motion.svg
                            initial={{ scale: 0.3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.3, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </motion.svg>
                        )}
                      </AnimatePresence>
                    </span>
                  </motion.button>
                )
              })}

              {/* Custom model row — always last */}
              <motion.div variants={rowFade} className={`relative ${info.models.length > 0 ? 'border-t border-white/[0.05]' : ''}`}>
                {customRow && (
                  <motion.span
                    layoutId={`model-highlight-${id}`}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 bg-gradient-to-r from-[#FFD700]/[0.11] to-[#FFD700]/[0.04] border-l-2 border-[#FFD700] pointer-events-none"
                  />
                )}
                {customRow ? (
                  <div className="relative flex items-center gap-2 px-3.5 py-2.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    <input
                      type="text" value={customModel} autoFocus={info.models.length > 0} spellCheck={false} autoCapitalize="off"
                      onChange={e => { setCustomModel(e.target.value); setMsg(null) }}
                      onKeyDown={e => { if (e.key === 'Enter' && cfg && customModel.trim()) void saveModel(customModel.trim()) }}
                      placeholder="model-id (exact)"
                      className="flex-1 bg-transparent font-game text-[13px] text-white/90 placeholder:text-white/20 focus:outline-none caret-[#FFD700]"
                    />
                    {cfg && customModel.trim() && customModel.trim() !== cfg.model && (
                      <button
                        onClick={() => saveModel(customModel.trim())}
                        className="font-game text-[10.5px] text-[#FFD700] font-bold hover:text-white transition-colors shrink-0"
                      >
                        {busy === 'model' ? <Spinner /> : 'SAVE'}
                      </button>
                    )}
                    {info.models.length > 0 && (
                      <button onClick={() => setCustomRow(false)} className="text-white/25 hover:text-white/55 transition-colors shrink-0" aria-label="Back to list">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    onClick={() => setCustomRow(true)}
                    className="relative w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors duration-150"
                  >
                    <span>
                      <span className="font-game text-[13px] font-semibold text-white/55 block">Custom model…</span>
                      <span className="font-game text-[10.5px] text-white/25 block">Type any model id</span>
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m9 18 6-6-6-6"/></svg>
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Feedback line — fixed slot so the panel never jumps */}
      <div className="px-4 sm:px-5 pb-3 min-h-[26px]">
        <AnimatePresence>
          {(msg || busy === 'model') && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`font-game text-[11.5px] flex items-center gap-1.5
                ${!msg ? 'text-white/30' : msg.kind === 'ok' ? 'text-emerald-300/90' : 'text-red-300/90'}`}
            >
              {busy === 'model' && !msg ? 'Saving…' : (
                <>
                  {msg?.kind === 'ok' && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  )}
                  {msg?.text}
                </>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Main selector ────────────────────────────────────────────────────────────

interface Props {
  selected: AIModel[]
  onChange: (models: AIModel[]) => void
  watchOnly?: boolean
}

export function LLMSelector({ selected, onChange, watchOnly = false }: Props) {
  // All saved configs (custom may occupy several slots)
  const [configs, setConfigs] = useState<ProviderConfigDTO[]>([])
  const [expanded, setExpanded] = useState<AIModel | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside any expanded card → collapse it
  useEffect(() => {
    if (!expanded) return
    function handleClick(e: MouseEvent) {
      // Find the expanded card's DOM node
      const expandedCard = containerRef.current?.querySelector(`[data-ai-card="${expanded}"]`)
      if (expandedCard && !expandedCard.contains(e.target as Node)) {
        setExpanded(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expanded])

  // Load saved provider configs once — never blocks the lobby.
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/providers')
      .then(r => r.ok ? r.json() : { configs: [] })
      .then((data: { configs?: ProviderConfigDTO[] }) => {
        if (!cancelled) setConfigs(data.configs ?? [])
      })
      .catch(() => { /* lobby works without configs (house keys) */ })
    return () => { cancelled = true }
  }, [])

  const upsertConfig = (c: ProviderConfigDTO) =>
    setConfigs(prev => {
      const rest = prev.filter(x => !(x.provider === c.provider && x.slot === c.slot))
      // an activated custom endpoint deactivates its siblings locally too
      const adjusted = c.provider === 'custom' && c.isActive
        ? rest.map(x => x.provider === 'custom' ? { ...x, isActive: false } : x)
        : rest
      return [...adjusted, c]
    })

  const removeCustomSlot = (slot: number) =>
    setConfigs(prev => prev.filter(x => !(x.provider === 'custom' && x.slot === slot)))

  const customCfgs = configs
    .filter(c => c.provider === 'custom')
    .sort((a, b) => a.slot - b.slot)

  /** The config shown on a card: for custom, the ACTIVE endpoint. */
  const cfgFor = (id: AIModel): ProviderConfigDTO | undefined =>
    id === 'custom'
      ? (customCfgs.find(c => c.isActive) ?? customCfgs[0])
      : configs.find(c => c.provider === id)

  /** BYOK-only: a seat requires the user's saved key + model (and a working one). */
  const isReady = (id: AIModel) => {
    const cfg = cfgFor(id)
    if (!cfg || !cfg.model || cfg.status === 'invalid') return false
    if (id === 'custom' && (!cfg.baseUrl || !cfg.isActive)) return false
    return true
  }

  /** Called by the panel when a key is saved + verified — seat the AI. */
  const seatIfUnseated = (id: AIModel) => {
    if (!selected.includes(id)) onChange([...selected, id])
  }

  function toggle(id: AIModel) {
    if (selected.includes(id)) {
      // Deselect — collapse if this card was expanded
      onChange(selected.filter(m => m !== id))
      if (expanded === id) setExpanded(null)
    } else if (!isReady(id)) {
      // Not configured yet → expand the config panel (don't seat)
      setExpanded(id)
    } else {
      // Ready (key + model saved) → just seat, no expand
      onChange([...selected, id])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-[10px] text-[#FFD700] uppercase tracking-[2px]">
          AI Players
        </p>
        <span className="font-pixel text-[8px] text-white/40">{selected.length} selected</span>
      </div>

      <div ref={containerRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AI_META_LIST.map(m => {
          const active = selected.includes(m.id)
          const isOpen = expanded === m.id
          const cfg = cfgFor(m.id)
          const status = keyStatus(cfg)
          const isCustom = m.id === 'custom'
          const displayName = isCustom && cfg?.customName ? cfg.customName : m.label

          return (
            <motion.div
              key={m.id}
              data-ai-card={m.id}
              layout
              transition={{ layout: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } }}
              className={`relative rounded-xl border overflow-hidden transition-colors duration-200
                ${isOpen ? 'sm:col-span-2' : ''}
                ${active
                  ? 'bg-[#FFD700]/10 border-[#FFD700]/70 shadow-[0_0_20px_rgba(255,215,0,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'panel-inset hover:border-[#FFD700]/35'
                }`}
            >
              {/* Gold accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-[#FFD700] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />

              {/* Card header — click to select + open */}
              <button onClick={() => toggle(m.id)} className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:scale-[0.995] transition-transform">
                {/* Avatar */}
                <div className={`relative w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-200 border
                  ${active
                    ? 'bg-black/40 border-[#FFD700]/70 shadow-[0_0_12px_rgba(255,215,0,0.25)] text-[#FFD700]'
                    : 'bg-black/25 border-white/10 text-white/50'}`}
                >
                  <ModelLogo id={m.id} />
                  {status !== 'none' && (
                    <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-pixel font-bold text-[11px] truncate ${active ? 'text-white' : 'text-white/40'}`}>
                      {displayName}
                    </span>
                    <span className={`font-pixel text-[6px] px-2 py-0.5 rounded border transition-all shrink-0
                      ${active ? 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/40' : 'bg-white/5 text-white/20 border-white/10'}`}>
                      {m.company}
                    </span>
                  </div>
                  <p className={`font-game text-[12px] mt-1.5 truncate transition-colors ${active ? 'text-white/60' : 'text-white/35'}`}>
                    {isReady(m.id) ? (cfg?.model ?? m.tagline) : (isCustom ? 'Add your endpoint to seat this player' : 'Add your API key to play')}
                  </p>
                </div>

                {/* Config chevron — expands without changing selection */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Configure ${m.label}`}
                  onClick={e => { e.stopPropagation(); setExpanded(prev => prev === m.id ? null : m.id) }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setExpanded(prev => prev === m.id ? null : m.id) } }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-[#FFD700]/80 hover:bg-white/[0.04] transition-colors shrink-0"
                >
                  <motion.svg
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </motion.svg>
                </span>

                {/* Checkbox */}
                <div className={`w-5.5 h-5.5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all
                  ${active ? 'bg-[#FFD700] border-transparent shadow-[0_0_8px_rgba(255,215,0,0.45)]' : 'border-white/25 bg-transparent'}`}>
                  {active && (
                    <svg className="w-3.5 h-3.5 text-[#1a0a2e]" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Slide-down config panel */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="overflow-hidden"
                  >
                    <ConfigPanel
                      id={m.id}
                      cfg={cfg}
                      customConfigs={isCustom ? customCfgs : undefined}
                      onSaved={upsertConfig}
                      onReady={seatIfUnseated}
                      onDeleted={isCustom ? removeCustomSlot : undefined}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {watchOnly && selected.length < 2 && (
        <p className="font-pixel text-[7px] sm:text-[8px] text-amber-400 text-center mt-2 tracking-wide">WATCH MODE REQUIRES AT LEAST 2 AI PLAYERS</p>
      )}
      {!watchOnly && selected.length === 0 && (
        <p className="font-pixel text-[7px] sm:text-[8px] text-red-400 text-center mt-2 tracking-wide">SELECT AT LEAST ONE AI PLAYER</p>
      )}
    </div>
  )
}
