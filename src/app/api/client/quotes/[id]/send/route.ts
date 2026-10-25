import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../lib/security/tenant-context.ts'
import { sendQuote } from '../../../../../../lib/quotes/quote-manager.ts'

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }>; customSupabase?: any }
) {
  const tenantResult = await getTenantContext('quotes:manage', props?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const { id } = await props.params
    const appBaseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'

    const result = await sendQuote(supabase, id, orgId, appBaseUrl)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send quote' }, { status: 400 })
    }

    return NextResponse.json({ success: true, quote: result.quote })
  } catch (err: any) {
    console.error('[CLIENT_SEND_QUOTE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
