import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('messages:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        org_id,
        contact_id,
        last_message_at,
        last_message_preview,
        unread_count,
        status,
        contact:contacts(id, name, phone, email, address, notes, lifetime_value)
      `)
      .eq('org_id', orgId)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const contactIds = (data || []).map((c: any) => c.contact_id).filter(Boolean)
    const leadsMap = new Map<string, any>()

    if (contactIds.length > 0) {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, contact_id, source, status, urgency, service_needed, estimated_value, notes, created_at')
        .eq('org_id', orgId)
        .in('contact_id', contactIds)
        .order('created_at', { ascending: false })

      if (leadsData) {
        for (const lead of leadsData) {
          if (!leadsMap.has(lead.contact_id)) {
            leadsMap.set(lead.contact_id, lead)
          }
        }
      }
    }

    const conversations = (data || []).map((c: any) => ({
      ...c,
      contact: Array.isArray(c.contact) ? c.contact[0] : c.contact,
      lead: leadsMap.get(c.contact_id) || null
    }))

    return NextResponse.json({
      success: true,
      conversations
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve conversations' },
      { status: 500 }
    )
  }
}
