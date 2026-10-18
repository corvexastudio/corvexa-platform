import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { sendDailyCrewScheduleBroadcast } from '@/lib/crews/crew-manager'

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('crews:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    let targetCrewId: string | undefined
    let dateStr: string | undefined
    try {
      const body = await request.json()
      targetCrewId = body.crewId
      dateStr = body.date
    } catch {
      // Body is optional
    }

    const result = await sendDailyCrewScheduleBroadcast(supabase, {
      orgId,
      targetCrewId,
      dateStr
    })

    return NextResponse.json({
      success: true,
      totalSent: result.totalSent,
      details: result.details
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to dispatch route broadcast' }, { status: 500 })
  }
}
