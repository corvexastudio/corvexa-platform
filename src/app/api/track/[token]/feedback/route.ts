import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelnyxSms } from '@/lib/telnyx'
import { resolveSenderPhone } from '@/lib/billing/plans'
import {
  checkRateLimitAsync,
  RATE_LIMITS,
  getRateLimitHeaders,
  extractClientIp,
  PRIVATE_CACHE_HEADERS
} from '@/lib/security/rate-limiter'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  let rateHeaders: Record<string, string> | undefined
  try {
    const { token } = await props.params
    if (!token) {
      return NextResponse.json({ error: 'Tracking token is required' }, { status: 400 })
    }

    // IP-based rate limiting on feedback submissions (10 req/min)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`tracking:feedback:${clientIp}`, RATE_LIMITS.TRACKING_FEEDBACK)
    rateHeaders = getRateLimitHeaders(rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many feedback requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    const body = await request.json().catch(() => ({}))
    const rating = Number(body.rating)
    const feedbackText = String(body.feedbackText || '').trim()

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Valid rating between 1 and 5 is required' },
        {
          status: 400,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    // Rating text is optional, default text satisfies NOT NULL database constraint
    const effectiveFeedbackText = feedbackText || `(Rating of ${rating} stars submitted without additional comments)`

    const supabase = createAdminClient()

    // 1. Resolve job by tracking token
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, org_id, contact_id, job_number, title')
      .eq('tracking_token', token)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job tracking link not found or expired' },
        {
          status: 404,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    // 2. Fetch contact info
    const { data: contact } = await supabase
      .from('contacts')
      .select('name, phone')
      .eq('id', job.contact_id)
      .maybeSingle()

    const customerName = contact?.name || 'Customer'
    const customerPhone = contact?.phone || 'No phone provided'

    // 3. Idempotent check: update if already submitted for this job, else insert
    const { data: existingFeedback } = await supabase
      .from('customer_feedback')
      .select('id, created_at')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let feedbackId = existingFeedback?.id

    if (existingFeedback) {
      await supabase
        .from('customer_feedback')
        .update({
          rating,
          feedback_text: effectiveFeedbackText,
          customer_name: customerName,
          customer_phone: customerPhone
        })
        .eq('id', existingFeedback.id)
    } else {
      const { data: feedbackRow, error: feedbackError } = await supabase
        .from('customer_feedback')
        .insert({
          org_id: job.org_id,
          job_id: job.id,
          contact_id: job.contact_id,
          rating,
          feedback_text: effectiveFeedbackText,
          customer_name: customerName,
          customer_phone: customerPhone,
          resolved: false
        })
        .select('id')
        .single()

      if (feedbackError) {
        console.error('[FEEDBACK_INSERT_ERROR]', feedbackError)
        return NextResponse.json(
          { error: 'Failed to record customer feedback' },
          {
            status: 500,
            headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
          }
        )
      }
      feedbackId = feedbackRow?.id
    }

    // 4. Fetch organization owner phone and dispatch number
    const { data: org } = await supabase
      .from('organizations')
      .select('name, owner_phone, telnyx_phone_number, phone_provisioning_status, plan_id, subscription_status')
      .eq('id', job.org_id)
      .single()

    // 5. Send Notification / SMS to Business Owner
    if (org?.owner_phone) {
      const senderNumber = resolveSenderPhone(org)
      const alertBody = rating <= 3
        ? `🚨 URGENT: ${customerName} submitted a ${rating}★ rating on Job #${job.job_number} (${job.title}): "${effectiveFeedbackText.slice(0, 100)}". Call them right away to resolve: ${customerPhone}`
        : `⭐ ${customerName} submitted a ${rating}★ rating on Job #${job.job_number} (${job.title})${feedbackText ? `: "${feedbackText.slice(0, 100)}"` : '.'}`

      try {
        await sendTelnyxSms({
          to: org.owner_phone,
          from: senderNumber,
          text: alertBody
        })
      } catch (smsErr) {
        console.warn('[FEEDBACK_OWNER_SMS_WARNING]', smsErr)
      }
    }

    // 6. Push dashboard notification
    try {
      await supabase.from('notifications').insert({
        org_id: job.org_id,
        title: rating <= 3 ? `🚨 Urgent ${rating}★ Customer Complaint` : `⭐ New ${rating}★ Customer Feedback`,
        message: `${customerName} on Job #${job.job_number}: "${effectiveFeedbackText.slice(0, 80)}"`,
        link: '/client/reviews?tab=feedback'
      })
    } catch (notifErr) {
      console.warn('[FEEDBACK_NOTIFICATION_WARNING]', notifErr)
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Feedback received and recorded successfully',
        feedbackId
      },
      {
        status: 200,
        headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
      }
    )
  } catch (err: any) {
    console.error('[API_CUSTOMER_FEEDBACK_ERROR]', err)
    return NextResponse.json(
      { error: 'Internal server error processing feedback' },
      {
        status: 500,
        headers: { ...PRIVATE_CACHE_HEADERS, ...(rateHeaders || {}) }
      }
    )
  }
}
