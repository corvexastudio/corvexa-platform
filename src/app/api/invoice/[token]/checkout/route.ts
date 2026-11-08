import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeCheckoutSession } from '@/lib/payments/stripe-adapter'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: 'Invoice token is required' }, { status: 400 })
  }
  const supabase = createAdminClient()

  let { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, contacts(*), invoice_items(*), organizations(id, external_payment_url)')
    .eq('manage_token', token.trim())
    .maybeSingle()

  if (error || !invoice) {
    const { data: rawInvoice, error: rawError } = await supabase
      .from('invoices')
      .select('*')
      .eq('manage_token', token.trim())
      .maybeSingle()

    if (rawError || !rawInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    invoice = rawInvoice
  }

  if (invoice.status === 'paid') {
    return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  let contact = invoice.contacts
  if (!contact && invoice.contact_id) {
    const { data: c } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', invoice.contact_id)
      .maybeSingle()
    contact = c
  }

  let org = (invoice as any).organizations
  if (!org && invoice.org_id) {
    const { data: o } = await supabase
      .from('organizations')
      .select('id, external_payment_url')
      .eq('id', invoice.org_id)
      .maybeSingle()
    org = o
  }

  let items = invoice.invoice_items
  if (!items || items.length === 0) {
    const { data: fetchedItems } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
    items = fetchedItems || invoice.items || []
  }

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
