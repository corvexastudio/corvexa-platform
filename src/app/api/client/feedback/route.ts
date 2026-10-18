import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client/feedback
 * Fetches customer feedback history with unresolved complaint counts.
 */
export async function GET(request: Request) {
  const tenantResult = await getTenantContext('reviews:view')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const { data: feedbackList, error } = await supabase
      .from('customer_feedback')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[FETCH_FEEDBACK_ERROR]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const unresolvedCount = (feedbackList || []).filter(f => !f.resolved).length

    return NextResponse.json({
      feedback: feedbackList || [],
      unresolvedCount
    })
  } catch (err: any) {
    console.error('[CLIENT_FEEDBACK_GET_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error fetching feedback' }, { status: 500 })
  }
}

/**
 * PATCH /api/client/feedback
 * Marks a complaint as resolved and attaches resolution notes.
 */
export async function PATCH(request: Request) {
  const tenantResult = await getTenantContext('reviews:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const { id, resolved = true, resolutionNotes } = body

    if (!id) {
      return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('customer_feedback')
      .update({
        resolved: !!resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolution_notes: resolutionNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: 'Failed to update feedback status' }, { status: 400 })
    }

    return NextResponse.json({ success: true, feedback: updated })
  } catch (err: any) {
    console.error('[CLIENT_FEEDBACK_PATCH_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error updating feedback' }, { status: 500 })
  }
}
