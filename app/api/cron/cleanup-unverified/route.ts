import { NextResponse } from 'next/server'
import { cleanupUnverifiedUsers } from '@/lib/cleanup'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cleanup endpoint — kept as a backup for external cron services (e.g. Vercel Cron).
 * Primary cleanup now runs via setInterval in server.ts (no HTTP self-call).
 */
export async function GET(req: Request) {
  // Always require CRON_SECRET (dev and prod) to prevent unauthorized user deletion
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await cleanupUnverifiedUsers()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Cron] Cleanup error:', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
