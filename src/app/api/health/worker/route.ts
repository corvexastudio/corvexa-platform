import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkWorkerHealth } from '@/lib/automations/worker-health'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()

    const url = new URL(request.url)
    const degradedThresholdSeconds = url.searchParams.get('degraded_seconds')
      ? parseInt(url.searchParams.get('degraded_seconds')!, 10)
      : undefined
    const unhealthyThresholdSeconds = url.searchParams.get('unhealthy_seconds')
      ? parseInt(url.searchParams.get('unhealthy_seconds')!, 10)
      : undefined

    const health = await checkWorkerHealth(supabase, {
      degradedThresholdSeconds,
      unhealthyThresholdSeconds
    })

    const httpStatus = health.status === 'unhealthy' ? 503 : 200

    return NextResponse.json(health, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Worker-Status': health.status,
        'X-Worker-Delay-Seconds': String(health.metrics.currentDelaySeconds)
      }
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: err.message || 'Worker health check failed'
      },
      { status: 503 }
    )
  }
}
