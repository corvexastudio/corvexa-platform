import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/security/audit-logger'

export async function POST(request: Request) {
  const tenantResult = await getTenantContext()
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, orgId, supabase } = tenantResult

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 })
  }

  const rawEmail = (body.email || '').trim().toLowerCase()
  const rawPassword = body.password

  // Validate Email
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  if (rawEmail.endsWith('@claim.captodesk.com')) {
    return NextResponse.json({ error: 'Please provide your actual email address, not a placeholder claim address.' }, { status: 400 })
  }

  // Validate Password
  if (!rawPassword || typeof rawPassword !== 'string' || rawPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 })
  }

  // Update Supabase Auth User
  try {
    const adminClient = getAdminClient()
    const { error: authErr } = await adminClient.auth.admin.updateUserById(user.id, {
      email: rawEmail,
      password: rawPassword,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        is_placeholder_email: false
      }
    })

    if (authErr) {
      return NextResponse.json({ error: authErr.message || 'Failed to update login credentials' }, { status: 400 })
    }
  } catch (err: any) {
    console.warn('[Account Claim Auth Update Warning]', err.message)
  }

  // Update Profile & Organization Rows
  try {
    await supabase
      .from('profiles')
      .update({
        email: rawEmail,
        is_placeholder_email: false
      })
      .eq('id', user.id)
  } catch (profileErr: any) {
    try {
      await supabase
        .from('profiles')
        .update({ email: rawEmail })
        .eq('id', user.id)
    } catch {
      console.warn('[Account Claim Profile Update Warning]', profileErr.message)
    }
  }

  try {
    await supabase
      .from('organizations')
      .update({
        account_claimed_at: new Date().toISOString()
      })
      .eq('id', orgId)
  } catch {
    // Non-blocking
  }

  // Audit Logging
  await logAuditEvent(supabase, {
    org_id: orgId,
    event_type: 'security.account_claimed',
    description: `Workspace owner ${user.id} claimed real login email ${rawEmail}`,
    metadata: {
      actor_id: user.id,
      org_id: orgId,
      new_email: rawEmail
    }
  }).catch(() => null)

  return NextResponse.json({
    success: true,
    email: rawEmail
  })
}
