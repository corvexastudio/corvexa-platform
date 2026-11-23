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
      return NextResponse.json({ error: 'Management token is required' }, { status: 400 })
    }

    // IP-based rate limiting on feedback submissions (10 req/min)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`manage:feedback:${clientIp}`, RATE_LIMITS.TRACKING_FEEDBACK)
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

    const effectiveFeedbackText = feedbackText || `(Rating of ${rating} stars submitted without additional comments)`

    const supabase = createAdminClient()

    // 1. Resolve appointment by management token
    const { data: apt, error: aptError } = await supabase
      .from('appointments')
      .select('id, org_id, contact_id, service_type, title, status')
      .eq('manage_token', token)
      .maybeSingle()

    if (aptError || !apt) {
      return NextResponse.json(
        { error: 'Appointment not found or expired' },
        {
          status: 404,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    // 2. Fetch linked job if any
    const { data: linkedJob } = await supabase
      .from('jobs')
      .select('id, job_number, title')
      .eq('appointment_id', apt.id)
      .is('deleted_at', null)
      .maybeSingle()

    // 3. Fetch contact info
    let customerName = 'Customer'
    let customerPhone = 'No phone provided'

    if (apt.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name, phone')
        .eq('id', apt.contact_id)
        .maybeSingle()

      if (contact) {
        customerName = contact.name || 'Customer'
        customerPhone = contact.phone || 'No phone provided'
      }
    }

    // 4. Idempotent check: update if existing feedback found, else insert
    let feedbackQuery = supabase
      .from('customer_feedback')
      .select('id')
      .eq('org_id', apt.org_id)

    if (linkedJob?.id) {
      feedbackQuery = feedbackQuery.eq('job_id', linkedJob.id)
    } else if (apt.contact_id) {
      feedbackQuery = feedbackQuery.eq('contact_id', apt.contact_id)
    }

    const { data: existingFeedback } = await feedbackQuery
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
          org_id: apt.org_id,
          job_id: linkedJob?.id || null,
          contact_id: apt.contact_id || null,
          rating,
          feedback_text: effectiveFeedbackText,
          customer_name: customerName,
          customer_phone: customerPhone,
          resolved: false
        })
        .select('id')
        .single()

      if (feedbackError) {
        console.error('[MANAGE_FEEDBACK_INSERT_ERROR]', feedbackError)
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

    // 5. Fetch organization owner phone and dispatch number
    const { data: org } = await supabase
      .from('organizations')
      .select('name, owner_phone, telnyx_phone_number, phone_provisioning_status, plan_id, subscription_status')
      .eq('id', apt.org_id)
      .single()

    // 6. Send Notification / SMS to Business Owner
    if (org?.owner_phone) {
      const senderNumber = resolveSenderPhone(org)
      const serviceLabel = apt.service_type || apt.title || 'Service'
      const alertBody = rating <= 3
        ? `🚨 URGENT: ${customerName} submitted a ${rating}★ rating on ${serviceLabel}: "${effectiveFeedbackText.slice(0, 100)}". Call them right away to resolve: ${customerPhone}`
        : `⭐ ${customerName} submitted a ${rating}★ rating on ${serviceLabel}${feedbackText ? `: "${feedbackText.slice(0, 100)}"` : '.'}`

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

    // 7. Push dashboard notification
    try {
      const serviceLabel = apt.service_type || apt.title || 'Service'
      await supabase.from('notifications').insert({
        org_id: apt.org_id,
        title: rating <= 3 ? `🚨 Urgent ${rating}★ Customer Complaint` : `⭐ New ${rating}★ Customer Feedback`,
        message: `${customerName} for ${serviceLabel}: "${effectiveFeedbackText.slice(0, 80)}"`,
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
    console.error('[API_MANAGE_FEEDBACK_ERROR]', err)
    return NextResponse.json(
      { error: 'Internal server error processing feedback' },
      {
        status: 500,
        headers: { ...PRIVATE_CACHE_HEADERS, ...(rateHeaders || {}) }
      }
    )
  }
}
