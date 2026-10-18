import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processAllWeeklyDigests } from '@/lib/reporting/weekly-digest'
import { createHash, timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function safeCompareSecrets(provided: string, expected: string): boolean {
  try {
    if (!provided || !expected) return false
    const hashProvided = createHash('sha256').update(provided, 'utf8').digest()
    const hashExpected = createHash('sha256').update(expected, 'utf8').digest()
    return timingSafeEqual(hashProvided, hashExpected)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const configuredCronSecret = process.env.CRON_SECRET

  if (!configuredCronSecret || configuredCronSecret.trim().length === 0) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured in runtime environment' },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const xCronHeader = request.headers.get('x-cron-secret')?.trim() || ''
  const providedSecret = bearerToken || xCronHeader

  if (!providedSecret || !safeCompareSecrets(providedSecret, configuredCronSecret)) {
    return NextResponse.json(
      { error: 'Unauthorized invocation of weekly digest cron' },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminClient()
    const result = await processAllWeeklyDigests(supabase)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    })
  } catch (err: any) {
    console.error('[CRON_WEEKLY_DIGEST_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error processing weekly digests' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
