import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { createEventEnvelope } from '@/lib/automations/events'
import { handleAutomationEvent } from '@/lib/automations/engine'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('leads:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id: leadId } = await params

  try {
    const body = await request.json()
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (body.status !== undefined) updatePayload.status = body.status
    if (body.urgency !== undefined) updatePayload.urgency = body.urgency
    if (body.serviceNeeded !== undefined) updatePayload.service_needed = body.serviceNeeded?.trim() || null
    if (body.estimatedValue !== undefined) updatePayload.estimated_value = body.estimatedValue != null && body.estimatedValue !== '' ? Number(body.estimatedValue) : null
    if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId)
      .eq('org_id', orgId)
      .select(`
        id, contact_id, source, status, urgency, service_needed, estimated_value, notes, created_at,
        contact:contacts(id, name, phone, email, address)
      `)
      .maybeSingle()

    if (updateError) {
      // Fallback update without relational embed if embed fails
      const { data: fallbackLead, error: fallbackError } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', leadId)
        .eq('org_id', orgId)
        .select('*')
        .maybeSingle()

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 400 })
      }
      if (!fallbackLead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, lead: fallbackLead })
    }

    if (!updatedLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Emit domain event for lead update
    await handleAutomationEvent(
      supabase,
      createEventEnvelope('lead.updated', orgId, {
        lead_id: leadId,
        contact_id: updatedLead.contact_id,
        status: updatedLead.status,
        urgency: updatedLead.urgency
      }, {
        entityId: leadId,
        contactId: updatedLead.contact_id
      })
    ).catch(err => console.warn('[LEAD_UPDATE_EVENT_FAILED]', err))

    return NextResponse.json({
      success: true,
      lead: updatedLead
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('leads:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id: leadId } = await params

  try {
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('org_id', orgId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete lead' }, { status: 500 })
  }
}
