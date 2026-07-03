import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { isProviderId } from '@/lib/aiProviders/catalog'
import { getDecryptedKey, setValidationResult } from '@/lib/aiProviders/service'
import { validateProviderKey } from '@/lib/aiProviders/validate'
import { sameOrigin } from '@/lib/apiSecurity'

/**
 * POST /api/settings/providers/test — live-validate the user's SAVED key
 * for a provider. The key is decrypted server-side, pinged against the
 * provider's cheapest authenticated endpoint, and discarded. The result
 * (valid/invalid + sanitized message) is persisted and returned — the key
 * itself never appears in the response.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  // Tight limit: this endpoint makes outbound calls with secrets.
  const rl = rateLimit(`provider-test:${session.user.id}`, 6, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many tests — retry in ${rl.retryAfterSec}s` }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const provider = (body as Record<string, unknown>).provider

  if (!isProviderId(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const creds = await getDecryptedKey(session.user.id, provider)
  if (!creds) {
    return NextResponse.json({ error: 'Save this provider before testing' }, { status: 404 })
  }

  const result = await validateProviderKey(provider, creds.apiKey, creds.baseUrl)
  const config = await setValidationResult(session.user.id, provider, result.ok, result.message)

  return NextResponse.json({ ok: result.ok, message: result.message, config })
}
