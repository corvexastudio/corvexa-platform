import { NextResponse } from 'next/server.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTenantContext } from '../../../../../../lib/security/tenant-context.ts'
import { logAuditEvent } from '../../../../../../lib/security/audit-logger.ts'
import { provisionOrganizationPhoneNumber } from '../../../../../../lib/telephony/provisioning.ts'
import type { TelnyxApiClient } from '../../../../../../lib/telephony/telnyx-api-client.ts'

export const dynamic = 'force-dynamic'

// Process-level in-flight concurrency lock per tenant organization
const inFlightProvisioningLocks = new Set<string>()

export interface ProvisionRouteDependencies {
  apiClient?: TelnyxApiClient
  customSupabase?: SupabaseClient
}

/**
 * Super Admin Telnyx DID Provisioning API
 * Strictly restricted to Super Admin role ('admin:all').
 * 
 * Path: POST /api/admin/organizations/[id]/provision-phone
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: ProvisionRouteDependencies
) {
  // 1. Synchronously resolve target organization from URL to eliminate microtask race gaps
  let initialOrgId: string | null = null
  try {
    const urlMatch = new URL(request.url).pathname.match(/\/organizations\/([^/]+)\/provision-phone/)
    if (urlMatch) {
      initialOrgId = urlMatch[1].trim()
    }
  } catch {
    // Non-fatal
  }

  // 2. Immediate synchronous concurrency lock
  if (initialOrgId) {
    if (inFlightProvisioningLocks.has(initialOrgId)) {
      return NextResponse.json({
        success: false,
        status: 'provisioning',
        error: 'Provisioning is already in progress for this organization'
      }, { status: 409 })
    }
    inFlightProvisioningLocks.add(initialOrgId)
  }

  let lockedOrgId = initialOrgId

  try {
    // 3. Authenticate user & verify hardened Super Admin authorization
    const tenantResult = await getTenantContext('admin:all', deps?.customSupabase)
    if (!tenantResult.ok) {
      return tenantResult.response
    }

    const supabase = deps?.customSupabase || tenantResult.supabase
    const user = tenantResult.user

    // 4. Resolve organization strictly from URL route parameter
    let orgId = initialOrgId || undefined
    if (props?.params) {
      try {
        const resolved = await props.params
        const paramId = resolved.id || (resolved as any).orgId
        if (paramId) orgId = paramId.trim()
      } catch {
        // Fallback to URL parsing
      }
    }

    if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
      return NextResponse.json({ error: 'Valid organization ID is required in URL parameter' }, { status: 400 })
    }

    orgId = orgId.trim()

    // If lockedOrgId wasn't set earlier (e.g. edge URL formatting), lock now
    if (!lockedOrgId) {
      if (inFlightProvisioningLocks.has(orgId)) {
        return NextResponse.json({
          success: false,
          status: 'provisioning',
          error: 'Provisioning is already in progress for this organization'
        }, { status: 409 })
      }
      inFlightProvisioningLocks.add(orgId)
      lockedOrgId = orgId
    }

    // 5. Parse and validate minimal input
    // Disallow arbitrary client-supplied provider/role payloads
    let areaCode: string | undefined = undefined

    try {
      const text = await request.text()
      if (text && text.trim().length > 0) {
        const body = JSON.parse(text)
        if (body && typeof body === 'object') {
          const prohibitedKeys = [
            'orgId',
            'org_id',
            'status',
            'phone_provisioning_status',
            'phoneNumber',
            'phone_number',
            'telnyx_phone_number',
            'orderId',
            'order_id',
            'telnyx_order_id',
            'telnyxPhoneNumberId',
            'telnyx_phone_number_id',
            'provider_status',
            'role'
          ]

          for (const key of prohibitedKeys) {
            if (key in body) {
              return NextResponse.json(
                { error: `Prohibited parameter '${key}' in request body. Organization is resolved strictly from route parameter.` },
                { status: 400 }
              )
            }
          }

          const rawAreaCode = body.areaCode ?? body.preferredAreaCode
          if (rawAreaCode !== undefined && rawAreaCode !== null && rawAreaCode !== '') {
            const str = String(rawAreaCode).trim()
            if (!/^[2-9]\d{2}$/.test(str)) {
              return NextResponse.json(
                { error: 'Invalid area code. Area code must be a 3-digit NANPA code (e.g. 214, 512, 415).' },
                { status: 400 }
              )
            }
            areaCode = str
          }
        }
      }
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 })
    }

    // 6. Validate organization exists
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, slug, subscription_status, phone_provisioning_status, telnyx_phone_number, telnyx_order_id')
      .eq('id', orgId)
      .maybeSingle()

    if (orgErr || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // 7. Validate provisioning eligibility
    if (org.subscription_status === 'churned') {
      return NextResponse.json(
        { error: 'Organization subscription is churned and not eligible for DID provisioning' },
        { status: 400 }
      )
    }

    // 8. Invoke the existing robust provisionOrganizationPhoneNumber service
    const result = await provisionOrganizationPhoneNumber(supabase, {
      orgId,
      preferredNumberOrAreaCode: areaCode,
      apiClient: deps?.apiClient
    })

    // 9. Structured Audit Logging (never log credentials or auth tokens)
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'admin.action_performed',
      description: `Super Admin triggered Telnyx DID provisioning for organization ${org.name || orgId} (${result.status})`,
      metadata: {
        admin_user_id: user.id,
        admin_email: user.email,
        target_org_id: orgId,
        action: 'admin_provision_telnyx_phone',
        requested_area_code: areaCode || null,
        provisioning_result: result.status,
        phone_number: result.phoneNumber || null,
        provider_order_id: result.orderId || null,
        failure_category: result.status === 'failed' ? (result.error ? 'provider_error' : 'unknown') : null,
        error: result.error || null,
        timestamp: new Date().toISOString()
      }
    })

    // 10. Handle return status truthfully
    if (result.status === 'already_assigned') {
      return NextResponse.json({
        success: true,
        status: 'already_assigned',
        phoneNumber: result.phoneNumber,
        message: 'Organization already has an active verified phone number'
      }, { status: 200 })
    }

    if (result.status === 'active') {
      return NextResponse.json({
        success: true,
        status: 'active',
        phoneNumber: result.phoneNumber,
        orderId: result.orderId,
        message: 'Phone number successfully provisioned'
      }, { status: 200 })
    }

    if (result.status === 'provisioning') {
      return NextResponse.json({
        success: result.success,
        status: 'provisioning',
        orderId: result.orderId,
        phoneNumber: result.phoneNumber,
        message: result.error || 'Provisioning order is in progress'
      }, { status: result.success ? 200 : 409 })
    }

    // result.status === 'failed'
    return NextResponse.json({
      success: false,
      status: 'failed',
      error: result.error || 'Failed to provision Telnyx phone number'
    }, { status: 422 })
  } catch (err: any) {
    console.error('[SUPER ADMIN PHONE PROVISIONING ERROR]', err)
    return NextResponse.json({
      success: false,
      status: 'failed',
      error: err?.message || 'Internal server error during phone provisioning'
    }, { status: 500 })
  } finally {
    // Release in-flight lock
    if (lockedOrgId) {
      inFlightProvisioningLocks.delete(lockedOrgId)
    }
  }
}
