import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { isProviderId, PROVIDERS } from '@/lib/aiProviders/catalog'
import { listConfigs, upsertConfig, ServiceError } from '@/lib/aiProviders/service'
import { sanitizeBaseUrl } from '@/lib/aiProviders/validate'
import { sameOrigin } from '@/lib/apiSecurity'

/**
 * GET  /api/settings/providers — list this user's configs (masked, no keys).
 * PUT  /api/settings/providers — create/update a provider config.
 *
 * Security: session required; per-user rate limits; Origin checked on
 * mutations (CSRF hardening on top of SameSite cookies); strict whitelist
 * validation; keys never appear in any response.
 */

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = await listConfigs(session.user.id)
  return NextResponse.json({ configs })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const rl = rateLimit(`provider-write:${session.user.id}`, 20, 5 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many updates — retry in ${rl.retryAfterSec}s` }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const b = body as Record<string, unknown>

  // ── Validation ────────────────────────────────────────────────────────────
  if (!isProviderId(b.provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }
  const info = PROVIDERS[b.provider]

  const model = typeof b.model === 'string' ? b.model.trim() : ''
  if (!model || model.length > 120 || /[\s<>"'`]/.test(model)) {
    return NextResponse.json({ error: 'Model id is required (no spaces or quotes, max 120 chars)' }, { status: 400 })
  }

  let apiKey: string | undefined
  if (b.apiKey !== undefined && b.apiKey !== '') {
    if (typeof b.apiKey !== 'string') return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })
    apiKey = b.apiKey.trim()
    if (apiKey.length < 4 || apiKey.length > 512 || /[\r\n\t]/.test(apiKey)) {
      return NextResponse.json({ error: 'API key looks malformed' }, { status: 400 })
    }
  }

  let baseUrl: string | null = null
  if (typeof b.baseUrl === 'string' && b.baseUrl.trim()) {
    if (!info.allowsBaseUrl) {
      return NextResponse.json({ error: `${info.label} does not accept a custom base URL` }, { status: 400 })
    }
    const check = sanitizeBaseUrl(b.baseUrl, /* allowLocal */ info.id === 'ollama' || info.id === 'custom')
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
    baseUrl = check.url
  }
  if (info.id === 'custom' && !baseUrl) {
    return NextResponse.json({ error: 'Custom providers need a base URL' }, { status: 400 })
  }

  let customName: string | null = null
  if (typeof b.customName === 'string' && b.customName.trim()) {
    customName = b.customName.trim().slice(0, 40)
  }

  // Ollama commonly runs keyless — synthesize a placeholder so encryption
  // and the unified flow still work.
  if (!apiKey && !info.requiresKey) apiKey = 'ollama-local'

  try {
    const dto = await upsertConfig(session.user.id, { provider: info.id, apiKey, model, baseUrl, customName })
    return NextResponse.json({ config: dto })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/settings/providers] upsert failed:', err instanceof Error ? err.stack || err.message : err)
    return NextResponse.json({ error: 'Could not save provider settings' }, { status: 500 })
  }
}
