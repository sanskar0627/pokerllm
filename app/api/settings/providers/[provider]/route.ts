import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { isProviderId } from '@/lib/aiProviders/catalog'
import { deleteConfig, ServiceError } from '@/lib/aiProviders/service'
import { sameOrigin } from '@/lib/apiSecurity'

/** DELETE /api/settings/providers/:provider — remove a config and its key. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const rl = rateLimit(`provider-write:${session.user.id}`, 20, 5 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many updates — retry in ${rl.retryAfterSec}s` }, { status: 429 })
  }

  const { provider } = await params
  if (!isProviderId(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  try {
    await deleteConfig(session.user.id, provider)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/settings/providers] delete failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not delete provider' }, { status: 500 })
  }
}
