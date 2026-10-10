import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { logAuditEvent } from '@/lib/security/audit-logger'
import { profileUpdateSchema, FORBIDDEN_ESCALATION_KEYS } from '@/lib/security/profile-schema'
import { normalizePhoneToE164 } from '@/lib/telephony/phone-normalizer'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext()
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, supabase } = tenantResult

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, org_id, full_name, first_name, last_name, email, phone, avatar_url, role, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, profile })
}

export async function PATCH(request: Request) {
  const tenantResult = await getTenantContext()
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, orgId, role, supabase } = tenantResult

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
  }

  // 1. Explicit Privilege Escalation Detection
  const attemptedForbiddenKeys = FORBIDDEN_ESCALATION_KEYS.filter((key) => key in body)
  if (attemptedForbiddenKeys.length > 0) {
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'security.privilege_escalation_attempt',
      description: `User ${user.id} attempted to modify protected fields: ${attemptedForbiddenKeys.join(', ')}`,
      metadata: {
        actor_id: user.id,
        current_role: role,
        attempted_keys: attemptedForbiddenKeys,
        payload_preview: body
      }
    })

    return NextResponse.json(
      {
        error: `Unauthorized attribute modification: Changing ${attemptedForbiddenKeys.join(', ')} is strictly forbidden.`
      },
      { status: 403 }
    )
  }

  // 2. Strict Zod Schema Validation
  const parseResult = profileUpdateSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid profile data',
        details: parseResult.error.flatten()
      },
      { status: 400 }
    )
  }

  const validData = parseResult.data
  const updates: Record<string, any> = {
    ...validData,
    updated_at: new Date().toISOString()
  }

  if (validData.first_name !== undefined || validData.last_name !== undefined) {
    const fullName = [validData.first_name, validData.last_name].filter(Boolean).join(' ').trim()
    if (fullName) {
      updates.full_name = fullName
    }
  }

  if (validData.phone !== undefined) {
    const raw = (validData.phone || '').trim()
    if (raw.length === 0) {
      updates.phone = null
    } else {
      const norm = normalizePhoneToE164(raw)
      if (!norm.isValid || !norm.e164) {
        return NextResponse.json(
          { error: `Invalid profile phone: ${norm.error || 'Please provide a valid phone number.'}` },
          { status: 400 }
        )
      }
      updates.phone = norm.e164
    }
  }

  // 3. Update Authoritative Profile
  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, org_id, full_name, first_name, last_name, email, phone, avatar_url, role, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  await logAuditEvent(supabase, {
    org_id: orgId,
    event_type: 'user.profile_updated',
    description: `User ${user.id} updated their profile`,
    metadata: {
      actor_id: user.id,
      updated_fields: Object.keys(validData)
    }
  })

  return NextResponse.json({ success: true, profile: updatedProfile })
}

export async function PUT(request: Request) {
  return PATCH(request)
}
