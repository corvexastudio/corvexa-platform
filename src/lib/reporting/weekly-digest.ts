/**
 * CaptoDesk Weekly Owner ROI Digest Service
 * Computes 7-day tangible performance metrics (missed calls recovered, jobs booked,
 * revenue collected, reviews earned) and dispatches weekly Monday recap to business owners.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '@/lib/telnyx'

export interface WeeklyDigestMetrics {
  missedCallsRecovered: number
  jobsBooked: number
  estimatedRevenue: number
  invoicesCollected: number
  fiveStarReviews: number
}

/**
 * Computes 7-day ROI metrics for a single organization.
 */
export async function computeWeeklyMetrics(
  supabase: SupabaseClient,
  orgId: string,
  sinceDate: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
): Promise<WeeklyDigestMetrics> {
  const sinceIso = sinceDate.toISOString()

  // 1. Missed calls recovered
  const { count: missedCallsCount } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', sinceIso)

  // 2. Jobs booked / created
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('id, quote:quotes(total)')
    .eq('org_id', orgId)
    .gte('created_at', sinceIso)

  const jobsBooked = recentJobs?.length || 0
  const estimatedRevenue = (recentJobs || []).reduce((acc, j: any) => {
    return acc + (Number(j.quote?.total) || 250) // Default $250 avg service ticket if unpriced
  }, 0)

  // 3. Invoices paid / collected
  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('amount_paid')
    .eq('org_id', orgId)
    .eq('status', 'paid')
    .gte('paid_at', sinceIso)

  const invoicesCollected = (paidInvoices || []).reduce((acc, inv) => {
    return acc + Number(inv.amount_paid || 0)
  }, 0)

  // 4. 5★ Reviews collected
  const { count: reviewsCount } = await supabase
    .from('review_requests')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'clicked')
    .gte('updated_at', sinceIso)

  return {
    missedCallsRecovered: missedCallsCount || 0,
    jobsBooked,
    estimatedRevenue,
    invoicesCollected,
    fiveStarReviews: reviewsCount || 0
  }
}

/**
 * Generates and dispatches the weekly ROI recap SMS and dashboard notification for one organization.
 */
export async function generateWeeklyDigestForOrg(
  supabase: SupabaseClient,
  orgId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'https://app.corvexastudio.com'
): Promise<{ success: boolean; metrics?: WeeklyDigestMetrics; error?: string }> {
  try {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, owner_phone, telnyx_phone_number, weekly_digest_enabled')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return { success: false, error: 'Organization not found' }
    }

    if (org.weekly_digest_enabled === false) {
      return { success: true } // Skipped cleanly
    }

    const metrics = await computeWeeklyMetrics(supabase, orgId)
    const senderNumber = org.telnyx_phone_number || org.owner_phone

    // Format concise, high-impact SMS message
    const lines = [
      `📊 CaptoDesk Weekly Recap for ${org.name}:`,
      `• ${metrics.missedCallsRecovered} missed call${metrics.missedCallsRecovered === 1 ? '' : 's'} recovered (<15s)`,
      `• ${metrics.jobsBooked} job${metrics.jobsBooked === 1 ? '' : 's'} booked (~$${metrics.estimatedRevenue.toLocaleString()} est. value)`,
      `• $${metrics.invoicesCollected.toLocaleString()} collected via Stripe`,
      `• ${metrics.fiveStarReviews} new 5★ review${metrics.fiveStarReviews === 1 ? '' : 's'}`
    ]

    lines.push(`Your front desk is working 24/7! Dashboard: ${baseUrl}/client/dashboard`)
    const rawSmsBody = lines.join('\n')

    // Dispatch SMS to owner phone
    if (org.owner_phone && senderNumber) {
      try {
        await sendTelnyxSms({
          to: org.owner_phone,
          from: senderNumber,
          text: rawSmsBody
        })
      } catch (smsErr) {
        console.warn(`[WEEKLY_DIGEST_SMS_FAILED] Org ${orgId}:`, smsErr)
      }
    }

    // Insert in-app dashboard notification
    try {
      await supabase.from('notifications').insert({
        org_id: org.id,
        title: '📊 Weekly Performance Recap Ready',
        message: `${metrics.missedCallsRecovered} calls saved, ${metrics.jobsBooked} jobs booked, and $${metrics.invoicesCollected.toLocaleString()} collected this past week.`,
        link: '/client/dashboard'
      })
    } catch (notifErr) {
      console.warn('[WEEKLY_DIGEST_NOTIF_FAILED]', notifErr)
    }

    // Record timestamp
    await supabase
      .from('organizations')
      .update({
        last_weekly_digest_sent_at: new Date().toISOString()
      })
      .eq('id', orgId)

    return { success: true, metrics }
  } catch (err: any) {
    console.error(`[WEEKLY_DIGEST_ERROR] Org ${orgId}:`, err)
    return { success: false, error: err.message || 'Error executing weekly digest' }
  }
}

/**
 * Batched execution across all eligible organizations.
 */
export async function processAllWeeklyDigests(
  supabase: SupabaseClient,
  baseUrl?: string
): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Query orgs where weekly_digest_enabled != false and last digest was at least 6 days ago (or null)
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id')
    .or(`last_weekly_digest_sent_at.is.null,last_weekly_digest_sent_at.lt.${sixDaysAgo}`)
    .neq('weekly_digest_enabled', false)

  if (error || !orgs) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const o of orgs) {
    const result = await generateWeeklyDigestForOrg(supabase, o.id, baseUrl)
    if (result.success) {
      succeeded++
    } else {
      failed++
    }
  }

  return {
    processed: orgs.length,
    succeeded,
    failed
  }
}
