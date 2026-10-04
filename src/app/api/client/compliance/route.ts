import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { normalizePhoneToE164 } from '@/lib/telephony/phone-normalizer'
import { logComplianceAudit, recordConsent } from '@/lib/compliance/compliance-engine'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('contacts:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { supabase, orgId } = tenantResult
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone')

  try {
    let suppressionQuery = supabase
      .from('compliance_suppression_list')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100)

    let auditQuery = supabase
      .from('compliance_audit_logs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100)

    let consentQuery = supabase
      .from('compliance_consent_records')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (phone) {
      const norm = normalizePhoneToE164(phone)
      const cleanPhone = norm.isValid && norm.e164 ? norm.e164 : phone
      suppressionQuery = suppressionQuery.eq('phone', cleanPhone)
      auditQuery = auditQuery.eq('phone', cleanPhone)
      consentQuery = consentQuery.eq('phone', cleanPhone)
    }

    const [
      { data: suppressionList, error: suppErr },
      { data: auditLogs, error: auditErr },
      { data: consentRecords, error: consentErr }
    ] = await Promise.all([suppressionQuery, auditQuery, consentQuery])

    if (suppErr || auditErr || consentErr) {
      console.error('[COMPLIANCE GET ERROR]', suppErr || auditErr || consentErr)
    }

    return NextResponse.json({
      success: true,
      suppressionList: suppressionList || [],
      auditLogs: auditLogs || [],
      consentRecords: consentRecords || []
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('contacts:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { supabase, orgId, profile } = tenantResult

  try {
    const body = await request.json()
    const { action, phone, reason = 'manual_admin', contactId, preferredChannel, marketingOptIn, transactionalOptIn } = body

    if (!phone) {
      return NextResponse.json({ error: 'Missing phone number' }, { status: 400 })
    }

    const norm = normalizePhoneToE164(phone)
    if (!norm.isValid || !norm.e164) {
      return NextResponse.json({ error: 'Invalid phone format. Please use E.164 (e.g. +15551234567)' }, { status: 400 })
    }
    const cleanPhone = norm.e164

    // 1. Manual Suppression / Opt-Out
    if (action === 'suppress' || action === 'opt_out') {
      await supabase.from('compliance_suppression_list').upsert(
        {
          org_id: orgId,
          phone: cleanPhone,
          reason,
          source: 'manual_portal',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'org_id,phone' }
      )

      await supabase
        .from('contacts')
        .update({
          opt_out: true,
          opt_out_at: new Date().toISOString(),
          marketing_opt_in: false,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId)
        .eq('phone', cleanPhone)

      await logComplianceAudit(supabase, {
        orgId,
        phone: cleanPhone,
        contactId,
        action: 'opt_out',
        reason: 'manual_admin_suppression',
        metadata: { performedBy: profile.id, role: profile.role }
      })

      return NextResponse.json({ success: true, action: 'suppressed', phone: cleanPhone })
    }

    // 2. Manual Unsuppress / Opt-In Recovery
    if (action === 'unsuppress' || action === 'opt_in') {
      await supabase
        .from('compliance_suppression_list')
        .delete()
        .eq('org_id', orgId)
        .eq('phone', cleanPhone)

      await supabase
        .from('contacts')
        .update({
          opt_out: false,
          opt_in_at: new Date().toISOString(),
          transactional_opt_in: true,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId)
        .eq('phone', cleanPhone)

      await recordConsent(supabase, {
        orgId,
        phone: cleanPhone,
        contactId,
        consentType: 'transactional',
        source: 'manual_admin_recovery',
        proofText: `Manual opt-in recovery authorized by admin ${profile.id}`
      })

      await logComplianceAudit(supabase, {
        orgId,
        phone: cleanPhone,
        contactId,
        action: 'opt_in',
        reason: 'manual_admin_recovery',
        metadata: { performedBy: profile.id, role: profile.role }
      })

      return NextResponse.json({ success: true, action: 'unsuppressed', phone: cleanPhone })
    }

    // 3. Update Customer Communication Preferences
    if (action === 'update_preferences') {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      }
      if (preferredChannel) updates.preferred_channel = preferredChannel
      if (typeof marketingOptIn === 'boolean') updates.marketing_opt_in = marketingOptIn
      if (typeof transactionalOptIn === 'boolean') updates.transactional_opt_in = transactionalOptIn

      await supabase
        .from('contacts')
        .update(updates)
        .eq('org_id', orgId)
        .eq('phone', cleanPhone)

      if (marketingOptIn === true) {
        await recordConsent(supabase, {
          orgId,
          phone: cleanPhone,
          contactId,
          consentType: 'marketing',
          source: 'preferences_update',
          proofText: 'Explicit marketing consent granted in customer preferences'
        })
      }

      await logComplianceAudit(supabase, {
        orgId,
        phone: cleanPhone,
        contactId,
        action: 'opt_in',
        reason: 'communication_preferences_updated',
        metadata: updates
      })

      return NextResponse.json({ success: true, action: 'preferences_updated', updates })
    }

    return NextResponse.json({ error: 'Unknown action specified' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
