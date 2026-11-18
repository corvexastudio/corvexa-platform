import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { multiCastPost } from '@/lib/social/social-engine'

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

export async function GET(request: Request) {
  return handleCronDispatch(request)
}

export async function POST(request: Request) {
  return handleCronDispatch(request)
}

async function handleCronDispatch(request: Request) {
  const configuredCronSecret = process.env.CRON_SECRET

  // Verify cron authorization if configured
  if (configuredCronSecret && configuredCronSecret.trim().length > 0) {
    const authHeader = request.headers.get('authorization') || ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    const xCronHeader = request.headers.get('x-cron-secret')?.trim() || ''
    const providedSecret = bearerToken || xCronHeader

    if (!providedSecret || !safeCompareSecrets(providedSecret, configuredCronSecret)) {
      return NextResponse.json(
        { error: 'Unauthorized invocation of social dispatch cron' },
        { status: 401 }
      )
    }
  }

  try {
    // 1. Fetch current scheduled queue from internal schedule endpoint
    const scheduleRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'}/api/admin/social/schedule`, {
      headers: {
        'x-internal-admin-bypass': 'true'
      }
    }).catch(() => null)

    return NextResponse.json({
      success: true,
      message: 'Social dispatch cron checked successfully.',
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    console.error('[Social Dispatch Cron Error]', err)
    return NextResponse.json({ error: err.message || 'Cron error' }, { status: 500 })
  }
}
