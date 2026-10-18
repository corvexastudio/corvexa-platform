import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { generateWeeklyDigestForOrg } from '@/lib/reporting/weekly-digest'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client/weekly-digest/test
 * Triggers an instant on-demand preview of the Monday ROI digest to the owner's mobile phone and notifications.
 */
export async function POST(request: Request) {
  const tenantResult = await getTenantContext('org:view')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const result = await generateWeeklyDigestForOrg(supabase, orgId)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to dispatch test digest' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly ROI digest sent to your phone and in-app notifications.',
      metrics: result.metrics
    })
  } catch (err: any) {
    console.error('[TEST_WEEKLY_DIGEST_ERROR]', err)
    return NextResponse.json({ error: 'Failed to dispatch preview digest.' }, { status: 500 })
  }
}
