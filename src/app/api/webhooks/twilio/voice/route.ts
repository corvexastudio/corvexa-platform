import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  // Use service role key for webhooks since there is no user session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    // Twilio sends form data
    const formData = await request.formData()
    const toPhone = formData.get('To') as string
    const fromPhone = formData.get('From') as string
    const callStatus = formData.get('CallStatus') as string

    // Only process missed calls (no-answer, busy, canceled, failed)
    const missedStatuses = ['no-answer', 'busy', 'canceled', 'failed']
    if (!missedStatuses.includes(callStatus)) {
      return NextResponse.json({ success: true, message: 'Not a missed call' })
    }

    // Find the organization this Twilio number belongs to
    const { data: org } = await supabase
      .from('organizations')
      .select('id, auto_reply_template, is_missed_call_active, name')
      .eq('twilio_number', toPhone)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found for this number' }, { status: 404 })
    }

    if (!org.is_missed_call_active) {
      return NextResponse.json({ success: true, message: 'Missed call automation is disabled' })
    }

    // Log the missed call in Supabase Activity Stream
    await supabase.from('activity_logs').insert({
      org_id: org.id,
      type: 'missed_call',
      contact_phone: fromPhone,
      status: 'pending',
      source: 'Twilio Webhook'
    })

    // DEMO MODE: If no Twilio keys are present, we just log it and return success
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log(`[DEMO MODE] Missed call from ${fromPhone}. Would have sent SMS: ${org.auto_reply_template.replace('{business_name}', org.name)}`)
      
      // Auto-update to replied for demo purposes
      await supabase.from('activity_logs')
        .update({ status: 'replied' })
        .eq('contact_phone', fromPhone)
        .eq('type', 'missed_call')

      return NextResponse.json({ success: true, demo_mode: true })
    }

    // ACTUAL TWILIO INTEGRATION GOES HERE (Once subscribed)
    /*
    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
       body: org.auto_reply_template.replace('{business_name}', org.name),
       from: toPhone,
       to: fromPhone
    });
    */

    // Update log to replied
    await supabase.from('activity_logs')
      .update({ status: 'replied' })
      .eq('contact_phone', fromPhone)
      .eq('type', 'missed_call')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
