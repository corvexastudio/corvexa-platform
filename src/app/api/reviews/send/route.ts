import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTelnyxSms, toE164 } from '@/lib/telnyx'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, phone, message: customMessage } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // 1. Get user's organization details
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, organizations(*)')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

    const org: any = profile.organizations
    const reviewLink = org?.google_review_url || 'https://google.com'
    const businessName = org?.name || 'our team'
    const senderNumber = org?.telnyx_phone_number

    const messageText = customMessage || 
      `Hey ${name || 'there'}! Thank you for choosing ${businessName}. If you loved the service, could you take 30 seconds to drop us a quick 5-star review here: ${reviewLink}`

    // 2. Send SMS via Telnyx
    const result = await sendTelnyxSms({
      to: toE164(phone),
      from: senderNumber,
      text: messageText
    })

    // 3. Log in activity_logs
    await supabase.from('activity_logs').insert({
      org_id: profile.org_id,
      event_type: 'review_invite',
      description: `Sent 5-star review invite to ${name || phone}`,
      metadata: {
        phone: toE164(phone),
        message: messageText,
        delivery: result.success ? 'sent' : 'failed'
      }
    })

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
