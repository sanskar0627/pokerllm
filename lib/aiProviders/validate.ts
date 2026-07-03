// SERVER-ONLY MODULE — live API-key validation against each provider.
import { PROVIDERS, type ProviderId } from './catalog'

/**
 * Validates a key with the cheapest authenticated call each provider offers
 * (a models-list GET wherever possible — zero token cost). Returns a
 * sanitized result; never throws raw provider errors upward and never logs
 * the key itself.
 */

export interface ValidationResult {
  ok:      boolean
  message: string          // sanitized, safe to store & show
}

const TIMEOUT_MS = 8000

/**
 * SSRF guard for user-supplied base URLs.
 * - http(s) only, no embedded credentials
 * - cloud metadata + link-local ranges blocked
 * - localhost/private ranges allowed ONLY for providers that support local
 *   endpoints (Ollama / custom) — that is the point of those providers.
 */
export function sanitizeBaseUrl(raw: string, allowLocal: boolean): { ok: true; url: string } | { ok: false; error: string } {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, error: 'Base URL is not a valid URL' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Base URL must be http(s)' }
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Base URL must not contain credentials' }
  }
  const host = url.hostname.toLowerCase()
  const blocked = ['169.254.169.254', 'metadata.google.internal', 'metadata.internal']
  if (blocked.includes(host) || host.startsWith('169.254.')) {
    return { ok: false, error: 'This host is not allowed' }
  }
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host.startsWith('10.') || host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (isLocal && !allowLocal) {
    return { ok: false, error: 'Local addresses are only allowed for Ollama / custom providers' }
  }
  if (url.protocol === 'http:' && !isLocal) {
    return { ok: false, error: 'Remote endpoints must use https' }
  }
  // Normalize: strip trailing slash
  return { ok: true, url: url.toString().replace(/\/+$/, '') }
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function classify(status: number): ValidationResult {
  if (status === 401 || status === 403) return { ok: false, message: 'Invalid API key (authentication rejected)' }
  if (status === 429) return { ok: true,  message: 'Key is valid (provider is rate limiting right now)' }
  if (status >= 500)  return { ok: false, message: 'Provider is having issues — try again later' }
  return { ok: false, message: `Provider returned an unexpected status (${status})` }
}

export async function validateProviderKey(
  provider: ProviderId,
  apiKey: string,
  baseUrl?: string | null,
): Promise<ValidationResult> {
  const info = PROVIDERS[provider]
  const endpoint = baseUrl ?? info.baseUrl

  try {
    switch (info.wire) {
      case 'anthropic': {
        const res = await timedFetch('https://api.anthropic.com/v1/models?limit=1', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        })
        return res.ok ? { ok: true, message: 'Connected to Anthropic' } : classify(res.status)
      }
      case 'google': {
        // Key goes in a header (not the query string) so it can never land in URL logs.
        const res = await timedFetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
          headers: { 'x-goog-api-key': apiKey },
        })
        return res.ok ? { ok: true, message: 'Connected to Google AI' } : classify(res.status)
      }
      case 'openai': {
        const base = endpoint ?? 'https://api.openai.com/v1'
        const res = await timedFetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        return res.ok ? { ok: true, message: `Connected to ${info.label}` } : classify(res.status)
      }
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      ok: false,
      message: aborted ? 'Connection timed out — check the endpoint' : 'Could not reach the provider',
    }
  }
}
