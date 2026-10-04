import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { createJob, convertQuoteToJob } from '@/lib/jobs/job-manager'

import { encodeCursor, decodeCursor } from '@/lib/pagination/cursor'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('appointments:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { searchParams } = new URL(request.url)
  const isTodayOnly = searchParams.get('today') === 'true'
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50
  const cursorStr = searchParams.get('cursor')
  const cursor = decodeCursor(cursorStr)

  let query = supabase
    .from('jobs')
    .select(`
      *,
      contact:contacts(id, name, phone, email, address),
      service:services(id, name, duration_minutes),
      appointment:appointments(id, start_time, end_time),
      quote:quotes(id, quote_number, total),
      items:job_items(*)
    `)
    .eq('org_id', orgId)
    .order('scheduled_start', { ascending: true })
    .limit(limit + 1)

  if (cursor) {
    query = query.gte('scheduled_start', cursor.timestamp).neq('id', cursor.id)
  }

  if (isTodayOnly) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tonight = new Date()
    tonight.setHours(23, 59, 59, 999)
    query = query.gte('scheduled_start', today.toISOString()).lte('scheduled_start', tonight.toISOString())
  }

  const { data: rawJobs, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const items = [...(rawJobs || [])]
  const hasMore = items.length > limit
  if (hasMore) {
    items.pop()
  }

  let nextCursor: string | null = null
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1]
    nextCursor = encodeCursor({
      timestamp: lastItem.scheduled_start || lastItem.created_at,
      id: lastItem.id
    })
  }

  return NextResponse.json({
    jobs: items,
    nextCursor,
    hasMore
  })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()

    // 1. If convertQuoteId is provided, bridge directly from quote
    if (body.convertQuoteId) {
      const result = await convertQuoteToJob(supabase, {
        quoteId: body.convertQuoteId,
        orgId,
        scheduledStart: body.scheduledStart,
        scheduledEnd: body.scheduledEnd,
        assignedTo: body.assignedTo
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to convert quote to job' }, { status: 400 })
      }

      return NextResponse.json(result)
    }

    // 2. Otherwise create standard job
    const {
      contactId,
      leadId,
      quoteId,
      appointmentId,
      serviceId,
      assignedTo,
      title,
      description,
      scheduledStart,
      scheduledEnd,
      items,
      notes
    } = body

    if (!contactId || !title?.trim() || !scheduledStart) {
      return NextResponse.json(
        { error: 'Missing required job fields: customer, title, or scheduled time' },
        { status: 400 }
      )
    }

    const result = await createJob(supabase, {
      orgId,
      contactId,
      leadId,
      quoteId,
      appointmentId,
      serviceId,
      assignedTo,
      title,
      description,
      scheduledStart,
      scheduledEnd,
      items: items || [],
      notes
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create job' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[CLIENT_CREATE_JOB_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
