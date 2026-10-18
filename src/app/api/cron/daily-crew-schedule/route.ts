import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDailyCrewScheduleBroadcast } from '@/lib/crews/crew-manager'
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
      { error: 'Unauthorized invocation of daily crew schedule cron' },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminClient()

    // Find organizations that have daily crew schedule enabled
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, timezone, daily_crew_schedule_enabled, daily_crew_schedule_hour, last_daily_crew_schedule_sent_at')
      .eq('daily_crew_schedule_enabled', true)

    if (error || !orgs) {
      return NextResponse.json({ success: true, processedCount: 0, details: [] })
    }

    const now = new Date()
    let processedCount = 0
    const summaryDetails: any[] = []

    for (const org of orgs) {
      const tz = org.timezone || 'America/Chicago'
      const targetHour = org.daily_crew_schedule_hour ?? 7

      // Get current local hour and local date
      let currentHour = 7
      let currentDateStr = new Date().toISOString().slice(0, 10)
      try {
        const hourStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now)
        currentHour = parseInt(hourStr, 10)
        currentDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
      } catch {
        // Fallback
      }

      // Check if already sent today
      if (org.last_daily_crew_schedule_sent_at) {
        try {
          const lastSentDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(org.last_daily_crew_schedule_sent_at))
          if (lastSentDateStr === currentDateStr) {
            continue
          }
        } catch {
          // Continue
        }
      }

      // Send broadcast if current hour >= targetHour
      if (currentHour >= targetHour) {
        const res = await sendDailyCrewScheduleBroadcast(supabase, {
          orgId: org.id,
          dateStr: currentDateStr
        })
        processedCount += res.totalSent
        summaryDetails.push({ orgId: org.id, orgName: org.name, totalSent: res.totalSent, details: res.details })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCount,
      summaryDetails
    })
  } catch (err: any) {
    console.error('[CRON_DAILY_CREW_SCHEDULE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error processing daily crew schedules' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
