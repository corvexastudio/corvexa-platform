import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { convertQuoteToJob } from '@/lib/jobs/job-manager'

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('quotes:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const { id } = await props.params
    if (!id) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    const result = await convertQuoteToJob(supabase, {
      quoteId: id,
      orgId,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      assignedTo: body.assignedTo
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to convert quote to job' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      job: result.job,
      message: 'Quote converted to field service job'
    })
  } catch (err: any) {
    console.error('[CONVERT_QUOTE_TO_JOB_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
