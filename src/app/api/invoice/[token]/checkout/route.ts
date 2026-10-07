import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeCheckoutSession } from '@/lib/payments/stripe-adapter'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, contacts(*), invoice_items(*)')
    .eq('manage_token', token)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (invoice.status === 'paid') {
    return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const contact = invoice.contacts

  const sessionResult = await createStripeCheckoutSession({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    orgId: invoice.org_id,
    contactId: invoice.contact_id,
    customerEmail: contact?.email || undefined,
    customerName: contact?.name || undefined,
    amountDue: Number(invoice.amount_due) || Number(invoice.total),
    title: invoice.title,
    manageToken: invoice.manage_token,
    baseUrl,
    items: invoice.invoice_items || []
  })

  return NextResponse.json({ checkoutUrl: sessionResult.checkoutUrl })
}
