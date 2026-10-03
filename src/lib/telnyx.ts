/**
 * Telnyx Telephony & Messaging Client Helper
 * Handles REST API dispatches and E.164 phone formatting.
 */

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (phone.startsWith('+')) return phone
  return `+1${digits}`
}

export async function sendTelnyxSms({
  to,
  text,
  from,
}: {
  to: string
  text: string
  from?: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.TELNYX_API_KEY
  const defaultFrom = process.env.TELNYX_PHONE_NUMBER || from

  if (!apiKey) {
    console.warn('[TELNYX SIMULATED MODE] No TELNYX_API_KEY found in environment. Simulating SMS send.')
    return { success: true, messageId: `mock_${Date.now()}` }
  }

  const sender = from || defaultFrom
  if (!sender) {
    return { success: false, error: 'No sender Telnyx phone number configured' }
  }

  const recipient = toE164(to)
  const formattedSender = toE164(sender)

  try {
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: formattedSender,
        to: recipient,
        text: text,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[TELNYX ERROR]', data)
      const errorMsg = data.errors?.[0]?.detail || 'Telnyx API error'
      return { success: false, error: errorMsg }
    }

    return {
      success: true,
      messageId: data.data?.id,
    }
  } catch (err: any) {
    console.error('[TELNYX NETWORK ERROR]', err)
    return { success: false, error: err.message }
  }
}
