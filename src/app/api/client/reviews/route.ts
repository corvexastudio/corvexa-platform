import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('reviews:view')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  // 1. Fetch organization review settings
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, google_review_url, is_review_engine_active, review_requests_enabled, review_delay_hours, review_cooldown_days')
    .eq('id', orgId)
    .single()

  // 2. Fetch all review requests for this tenant
  const { data: requests, error } = await supabase
    .from('review_requests')
    .select('*, contacts(name, phone), jobs(job_number, title)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = requests || []
  const totalSent = list.filter(r => r.status === 'sent' || r.status === 'delivered' || r.status === 'clicked').length
  const totalDelivered = list.filter(r => r.status === 'delivered' || r.status === 'clicked').length
  const totalClicked = list.filter(r => r.status === 'clicked' || (r.click_count && r.click_count > 0)).length
  const totalSuppressed = list.filter(r => r.status === 'suppressed').length

  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0

  return NextResponse.json({
    metrics: {
      totalSent,
      totalDelivered,
      totalClicked,
      totalSuppressed,
      clickRate
    },
    settings: {
      googleReviewUrl: org?.google_review_url || '',
      reviewRequestsEnabled: org?.review_requests_enabled !== false && org?.is_review_engine_active !== false,
      delayHours: org?.review_delay_hours || 24,
      cooldownDays: org?.review_cooldown_days || 60
    },
    requests: list
  })
}

export async function PATCH(request: Request) {
  const tenantResult = await getTenantContext('reviews:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const body = await request.json()

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  if (typeof body.googleReviewUrl === 'string') updates.google_review_url = body.googleReviewUrl.trim()
  if (typeof body.reviewRequestsEnabled === 'boolean') {
    updates.review_requests_enabled = body.reviewRequestsEnabled
    updates.is_review_engine_active = body.reviewRequestsEnabled
  }
  if (typeof body.delayHours === 'number') updates.review_delay_hours = Math.max(1, body.delayHours)
  if (typeof body.cooldownDays === 'number') updates.review_cooldown_days = Math.max(7, body.cooldownDays)

  const { data: updatedOrg, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select('google_review_url, review_requests_enabled, review_delay_hours, review_cooldown_days')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, settings: updatedOrg })
}
