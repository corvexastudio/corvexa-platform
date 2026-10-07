import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { createInvoice, convertJobToInvoice, convertQuoteToInvoice } from '@/lib/payments/invoice-manager'

import { encodeCursor, decodeCursor } from '@/lib/pagination/cursor'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('appointments:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50
  const cursorStr = searchParams.get('cursor')
  const cursor = decodeCursor(cursorStr)

  let query = supabase
    .from('invoices')
    .select(`
      *,
      contact:contacts(id, name, phone, email),
      items:invoice_items(*),
      payments(*)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  const includeDeleted = searchParams.get('include_deleted') === 'true'
  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (cursor) {
    query = query.lte('created_at', cursor.timestamp).neq('id', cursor.id)
  }

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data: rawInvoices, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const items = [...(rawInvoices || [])]
  const hasMore = items.length > limit
  if (hasMore) {
    items.pop()
  }

  let nextCursor: string | null = null
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1]
    nextCursor = encodeCursor({
      timestamp: lastItem.created_at,
      id: lastItem.id
    })
  }

  return NextResponse.json({
    invoices: items,
    nextCursor,
    hasMore
  })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const { action, jobId, quoteId, contactId, title, description, items, taxRate, discountAmount, dueDate, notes } = body

    if (action === 'convert_job' && jobId) {
      const result = await convertJobToInvoice(supabase, { jobId, orgId, dueDate, taxRate, discountAmount })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json(result)
    }

    if (action === 'convert_quote' && quoteId) {
      const result = await convertQuoteToInvoice(supabase, { quoteId, orgId, dueDate })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json(result)
    }

    if (!contactId || !title?.trim()) {
      return NextResponse.json({ error: 'Customer and title are required' }, { status: 400 })
    }

    const result = await createInvoice(supabase, {
      orgId,
      contactId,
      title,
      description,
      items: Array.isArray(items) ? items : [],
      taxRate,
      discountAmount,
      dueDate,
      notes
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process invoice' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const url = new URL(request.url)
  let invoiceId = url.searchParams.get('id')

  if (!invoiceId) {
    try {
      const body = await request.json()
      invoiceId = body.id
    } catch {
      // Body not provided
    }
  }

  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice ID is required.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('invoices')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)
    .eq('org_id', orgId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Invoice successfully soft-deleted.' })
}

