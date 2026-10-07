import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { createQuote } from '@/lib/quotes/quote-manager'

import { encodeCursor, decodeCursor } from '@/lib/pagination/cursor'

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
    .from('quotes')
    .select(`
      *,
      contact:contacts(id, name, phone, email, address),
      items:quote_items(*)
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

  const { data: rawQuotes, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const items = [...(rawQuotes || [])]
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
    quotes: items,
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
    const { contactId, leadId, title, description, items, taxRate, discount, expiresInDays, notes } = body

    if (!contactId || !title?.trim() || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required quote fields: customer, title, and at least one item' },
        { status: 400 }
      )
    }

    const appBaseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'

    const result = await createQuote(supabase, {
      orgId,
      contactId,
      leadId,
      title,
      description,
      items,
      taxRate: taxRate ? parseFloat(taxRate) : 0,
      discount: discount ? parseFloat(discount) : 0,
      expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : 14,
      notes
    }, appBaseUrl)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create quote' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[CLIENT_CREATE_QUOTE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const url = new URL(request.url)
  let quoteId = url.searchParams.get('id')

  if (!quoteId) {
    try {
      const body = await request.json()
      quoteId = body.id
    } catch {
      // Body not provided
    }
  }

  if (!quoteId) {
    return NextResponse.json({ error: 'Quote ID is required.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('quotes')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('org_id', orgId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Quote successfully soft-deleted.' })
}

