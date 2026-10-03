import { NextResponse } from 'next/server'
import { sendTelnyxSms, toE164 } from '@/lib/telnyx'

export async function POST(request: Request) {
  try {
    const { business_name, phone, message } = await request.json()

    if (!phone || !message) {
      return NextResponse.json({ error: 'Phone number and message are required' }, { status: 400 })
    }

    const cleanPhone = toE164(phone)
    const result = await sendTelnyxSms({
      to: cleanPhone,
      text: message
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to dispatch demo SMS' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      delivered_to: cleanPhone,
      message_id: result.messageId
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
