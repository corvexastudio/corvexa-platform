import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { createEventEnvelope } from '@/lib/automations/events'
import { handleAutomationEvent } from '@/lib/automations/engine'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('leads:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const searchQuery = searchParams.get('search')?.toLowerCase().trim()

  let rawLeads: any[] = []
  let queryError: any = null

  // 1. Primary Query with PostgREST Relational Embedding
  try {
    let query = supabase
      .from('leads')
      .select(`
        id, contact_id, source, status, urgency, service_needed, estimated_value, notes, created_at,
        contact:contacts(id, name, phone, email, address)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const res = await query
    if (res.error) {
      queryError = res.error
    } else {
      rawLeads = res.data || []
    }
  } catch (err: any) {
    queryError = err
  }

  // 2. Resilient Fallback: If relational embed fails (e.g. FK constraint or column variance)
  if (queryError) {
    console.warn('[LEADS_GET] Relational embed query encountered error, using batch resolution:', queryError.message || queryError)
    try {
      let fallbackQuery = supabase
        .from('leads')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        fallbackQuery = fallbackQuery.eq('status', statusFilter)
      }

      const { data: baseLeads, error: fallbackError } = await fallbackQuery
      if (fallbackError) {
        console.error('[LEADS_GET] Fallback query failed:', fallbackError.message)
        return NextResponse.json({ error: fallbackError.message }, { status: 500 })
      }

      const leadRows = baseLeads || []
      const contactIds = Array.from(new Set(leadRows.map((l: any) => l.contact_id).filter(Boolean)))

      let contactsMap = new Map<string, any>()
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name, phone, email, address')
          .in('id', contactIds)

        for (const c of contacts || []) {
          contactsMap.set(c.id, c)
        }
      }

      rawLeads = leadRows.map((l: any) => ({
        ...l,
        contact: contactsMap.get(l.contact_id) || null
      }))
    } catch (fallbackErr: any) {
      return NextResponse.json({ error: fallbackErr.message || 'Failed to load leads' }, { status: 500 })
    }
  }

  // Normalize contacts (in case PostgREST returned single or array)
  const enrichedLeads = rawLeads.map((l: any) => ({
    id: l.id,
    contact_id: l.contact_id,
    source: l.source || 'manual',
    status: l.status || 'new',
    urgency: l.urgency || 'normal',
    service_needed: l.service_needed || null,
    estimated_value: l.estimated_value != null ? Number(l.estimated_value) : null,
    notes: l.notes || null,
    created_at: l.created_at,
    contact: Array.isArray(l.contact) ? l.contact[0] : (l.contact || null)
  }))

  // Optional server-side text filtering
  const filteredLeads = searchQuery
    ? enrichedLeads.filter((l: any) => {
        const name = l.contact?.name?.toLowerCase() || ''
        const phone = l.contact?.phone || ''
        const service = l.service_needed?.toLowerCase() || ''
        const source = l.source?.toLowerCase() || ''
        const notes = l.notes?.toLowerCase() || ''
        return name.includes(searchQuery) || phone.includes(searchQuery) || service.includes(searchQuery) || source.includes(searchQuery) || notes.includes(searchQuery)
      })
    : enrichedLeads

  // Compute stage counts across all tenant leads
  const counts = {
    all: enrichedLeads.length,
    new: enrichedLeads.filter((l: any) => l.status === 'new').length,
    contacted: enrichedLeads.filter((l: any) => l.status === 'contacted').length,
    booked: enrichedLeads.filter((l: any) => l.status === 'booked').length,
    lost: enrichedLeads.filter((l: any) => l.status === 'lost' || l.status === 'archived').length,
  }

  return NextResponse.json({
    success: true,
    leads: filteredLeads,
    counts
  })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('leads:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const {
      contactId,
      source = 'manual',
      status = 'new',
      urgency = 'normal',
      serviceNeeded,
      estimatedValue,
      notes
    } = body

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    const insertPayload: Record<string, any> = {
      org_id: orgId,
      contact_id: contactId,
      source,
      status,
      urgency,
      service_needed: serviceNeeded?.trim() || null,
      estimated_value: estimatedValue != null && estimatedValue !== '' ? Number(estimatedValue) : null,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString()
    }

    let insertedLead: any = null
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert(insertPayload)
      .select(`
        id, contact_id, source, status, urgency, service_needed, estimated_value, notes, created_at,
        contact:contacts(id, name, phone, email, address)
      `)
      .single()

    if (insertError) {
      // Fallback without relation embed if embed fails
      const { data: baseLead, error: fallbackError } = await supabase
        .from('leads')
        .insert(insertPayload)
        .select('*')
        .single()

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 400 })
      }
      insertedLead = baseLead
    } else {
      insertedLead = newLead
    }

    // Trigger Domain Automation Event for lead creation
    await handleAutomationEvent(
      supabase,
      createEventEnvelope('lead.created', orgId, {
        lead_id: insertedLead.id,
        contact_id: contactId,
        source: insertedLead.source,
        service_needed: insertedLead.service_needed,
        estimated_value: insertedLead.estimated_value
      }, {
        entityId: insertedLead.id,
        contactId
      })
    ).catch(err => console.warn('[LEAD_AUTOMATION_EVENT_FAILED]', err))

    return NextResponse.json({
      success: true,
      lead: insertedLead
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid lead creation request' }, { status: 500 })
  }
}
