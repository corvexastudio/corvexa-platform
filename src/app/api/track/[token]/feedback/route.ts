import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelnyxSms } from '@/lib/telnyx'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params
    if (!token) {
      return NextResponse.json({ error: 'Tracking token is required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const rating = Number(body.rating)
    const feedbackText = String(body.feedbackText || '').trim()

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Valid rating between 1 and 5 is required' }, { status: 400 })
    }

    if (!feedbackText || feedbackText.length < 3) {
      return NextResponse.json({ error: 'Please provide feedback text' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Resolve job by tracking token
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, org_id, contact_id, job_number, title')
      .eq('tracking_token', token)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job tracking link not found or expired' }, { status: 404 })
    }

    // 2. Fetch contact info
    const { data: contact } = await supabase
      .from('contacts')
      .select('name, phone')
      .eq('id', job.contact_id)
      .maybeSingle()

    const customerName = contact?.name || 'Customer'
    const customerPhone = contact?.phone || 'No phone provided'

    // 3. Insert into customer_feedback
    const { data: feedbackRow, error: feedbackError } = await supabase
      .from('customer_feedback')
      .insert({
        org_id: job.org_id,
        job_id: job.id,
        contact_id: job.contact_id,
        rating,
        feedback_text: feedbackText,
        customer_name: customerName,
        customer_phone: customerPhone,
        resolved: false
      })
      .select('id')
      .single()

    if (feedbackError) {
      console.error('[FEEDBACK_INSERT_ERROR]', feedbackError)
      return NextResponse.json({ error: 'Failed to record customer feedback' }, { status: 500 })
    }

    // 4. Fetch organization owner phone and dispatch number
    const { data: org } = await supabase
      .from('organizations')
      .select('name, owner_phone, telnyx_phone_number')
      .eq('id', job.org_id)
      .single()

    // 5. Send High-Priority SMS to Business Owner
    if (org?.owner_phone) {
      const senderNumber = org.telnyx_phone_number || org.owner_phone
      const alertBody = `🚨 URGENT: ${customerName} submitted a ${rating}★ rating on Job #${job.job_number} (${job.title}): "${feedbackText.slice(0, 100)}". Call them right away to resolve: ${customerPhone}`

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

    // 6. Push real-time dashboard notification
    try {
      await supabase.from('notifications').insert({
        org_id: job.org_id,
        title: `🚨 Urgent ${rating}★ Customer Complaint`,
        message: `${customerName} on Job #${job.job_number}: "${feedbackText.slice(0, 80)}"`,
        link: '/client/reviews?tab=feedback'
      })
    } catch (notifErr) {
      console.warn('[FEEDBACK_NOTIFICATION_WARNING]', notifErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback received and escalated to business management',
      feedbackId: feedbackRow?.id
    })
  } catch (err: any) {
    console.error('[API_CUSTOMER_FEEDBACK_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error processing feedback' }, { status: 500 })
  }
}
