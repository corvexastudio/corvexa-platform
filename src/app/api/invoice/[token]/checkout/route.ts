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
    .select('*, contacts(*), invoice_items(*), organizations(id, stripe_account_id, stripe_charges_enabled, external_payment_url)')
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
  const org = (invoice as any).organizations

  // If contractor has configured a direct external payment link and Stripe is not connected, route directly
  if (org?.external_payment_url && !org?.stripe_charges_enabled) {
    return NextResponse.json({ checkoutUrl: org.external_payment_url })
  }

  try {
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
      connectedStripeAccountId: org?.stripe_charges_enabled ? org?.stripe_account_id : undefined,
      items: invoice.invoice_items || []
    })

    return NextResponse.json({ checkoutUrl: sessionResult.checkoutUrl })
  } catch (err: any) {
    if (org?.external_payment_url) {
      return NextResponse.json({ checkoutUrl: org.external_payment_url })
    }
    return NextResponse.json({ error: err.message || 'Payment initiation failed' }, { status: 500 })
  }
}
