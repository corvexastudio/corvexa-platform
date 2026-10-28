import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../lib/security/tenant-context.ts'
import { logAuditEvent } from '../../../../lib/security/audit-logger.ts'
import { normalizePhoneToE164 } from '../../../../lib/telephony/phone-normalizer.ts'

export const dynamic = 'force-dynamic'

export interface OrganizationRouteContext {
  params?: Promise<Record<string, string | string[] | undefined>>
  customSupabase?: any
}

export type OrganizationRouteDependencies = OrganizationRouteContext

/**
 * Tenant Organization Management API (HIGH-02 & P1-BILLING-01)
 * Strictly enforces RBAC:
 * - GET: requires 'org:view' (accessible to all tenant roles)
 * - PATCH: strictly requires 'org:update' (restricted to owner and admin roles only; members/technicians/dispatchers are 403 Forbidden)
 * - Rejects any attempt to tamper with billing (subscription_status, monthly_rate), identity, or phone routing.
 */

export async function GET(request?: Request, context?: OrganizationRouteContext) {
  const tenantResult = await getTenantContext('org:view', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  const { data: org, error } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      slug,
      owner_phone,
      telnyx_phone_number,
      carrier,
      timezone,
      google_review_url,
      auto_reply_template,
      reactivation_enabled,
      default_reactivation_interval_days,
      reactivation_cooldown_days,
      reactivation_template,
      reactivation_quiet_hours,
      reactivation_max_daily,
      booking_mode,
      default_duration_minutes,
      buffer_minutes,
      minimum_notice_hours,
      max_booking_days_ahead,
      blocked_dates,
      subscription_status,
      monthly_rate,
      industry,
      operation_mode,
      legal_business_name,
      business_type,
      ein,
      is_sole_proprietor,
      address_street,
      address_city,
      address_state,
      address_postal_code,
      website_url,
      carrier_registration_status,
      tcr_brand_id,
      tcr_campaign_id,
      weekly_digest_enabled,
      weekly_digest_channels,
      weekly_digest_day_of_week,
      weekly_digest_hour,
      last_weekly_digest_sent_at,
      billing_provider,
      paypal_subscription_id,
      paypal_plan_id,
      external_payment_url,
      payment_instructions,
      waive_setup_fee,
      license_number,
      tracking_mode,
      tracking_geofence_miles,
      created_at
    `)
    .eq('id', orgId)
    .single()

  let finalOrg: any = org
  if (error) {
    // Graceful fallback if migration 53 columns are not yet in remote schema cache
    const fallbackRes = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        owner_phone,
        telnyx_phone_number,
        carrier,
        timezone,
        google_review_url,
        auto_reply_template,
        reactivation_enabled,
        default_reactivation_interval_days,
        reactivation_cooldown_days,
        reactivation_template,
        reactivation_quiet_hours,
        reactivation_max_daily,
        booking_mode,
        default_duration_minutes,
        buffer_minutes,
        minimum_notice_hours,
        max_booking_days_ahead,
        blocked_dates,
        subscription_status,
        monthly_rate,
        industry,
        legal_business_name,
        business_type,
        ein,
        is_sole_proprietor,
        address_street,
        address_city,
        address_state,
        address_postal_code,
        website_url,
        carrier_registration_status,
        tcr_brand_id,
        tcr_campaign_id,
        weekly_digest_enabled,
        weekly_digest_channels,
        weekly_digest_day_of_week,
        weekly_digest_hour,
        last_weekly_digest_sent_at,
        created_at
      `)
      .eq('id', orgId)
      .single()

    if (fallbackRes.error || !fallbackRes.data) {
      // Secondary fallback for legacy schema
      const minimalRes = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          slug,
          owner_phone,
          telnyx_phone_number,
          carrier,
          timezone,
          subscription_status,
          monthly_rate,
          created_at
        `)
        .eq('id', orgId)
        .single()

      if (minimalRes.error || !minimalRes.data) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }
      finalOrg = minimalRes.data
    } else {
      finalOrg = fallbackRes.data
    }
  }

  if (finalOrg) {
    finalOrg.operation_mode = finalOrg.operation_mode || 'solo'
    finalOrg.industry = finalOrg.industry || 'general'
  }

  return NextResponse.json({ organization: finalOrg })
}

export async function PATCH(request: Request, context?: OrganizationRouteContext) {
  // 1. Strict RBAC enforcement: Requires 'org:update' permission (owner/admin only)
  const tenantResult = await getTenantContext('org:update', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role, supabase } = tenantResult

  try {
    const body = await request.json()

    // 2. Strict Prohibition of Billing & Identity Tampering (P1-BILLING-01)
    // Tenant owners/admins must NEVER be able to modify SaaS billing, payment, routing, or identity state.
    const FORBIDDEN_BILLING_KEYS = [
      'plan_id',
      'planId',
      'subscription_status',
      'monthly_rate',
      'org_id',
      'orgId',
      'id',
      'role',
      'provider',
      'provider_customer_id',
      'provider_subscription_id',
      'stripe_customer_id',
      'stripe_subscription_id',
      'billing_period',
      'billing_period_start',
      'billing_period_end',
      'payment_status',
      'telnyx_phone_number',
      'telnyx_order_id',
      'phone_provisioning_status',
      'carrier_registration_status',
      'tcr_brand_id',
      'tcr_campaign_id',
      'requestedNumber',
      'telnyxPhoneNumber',
      'billing_provider',
      'paypal_subscription_id',
      'paypal_plan_id',
      'paypal_payer_id',
      'waive_setup_fee'
    ] as const

    const attemptedForbiddenKey = FORBIDDEN_BILLING_KEYS.find(k => k in body)
    if (attemptedForbiddenKey) {
      await logAuditEvent(supabase, {
        org_id: orgId,
        event_type: 'security.privilege_escalation_attempt',
        description: `Tenant user ${user.id} attempted to modify protected billing/identity field: ${attemptedForbiddenKey}`,
        metadata: {
          actor_id: user.id,
          actor_role: role,
          attempted_key: attemptedForbiddenKey
        }
      })
      return NextResponse.json(
        { error: `Prohibited parameter: '${attemptedForbiddenKey}' is server-authoritative and cannot be modified by tenant.` },
        { status: 400 }
      )
    }

    // 3. Strict Allowlist of Mutable Operational Fields
    // Prevents tampering with tenant identity (id, slug), routing (telnyx_phone_number),
    // or billing credentials (stripe_customer_id, subscription_status).
    const allowedUpdates: Record<string, any> = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      allowedUpdates.name = body.name.trim().slice(0, 100)
    }

    if (typeof body.owner_phone === 'string') {
      const trimmed = body.owner_phone.trim()
      if (trimmed.length === 0) {
        allowedUpdates.owner_phone = null
      } else {
        const norm = normalizePhoneToE164(trimmed)
        if (!norm.isValid || !norm.e164) {
          return NextResponse.json(
            { error: `Invalid owner notification phone: ${norm.error || 'Please provide a valid phone number.'}` },
            { status: 400 }
          )
        }
        allowedUpdates.owner_phone = norm.e164
      }
    } else if (body.owner_phone === null) {
      allowedUpdates.owner_phone = null
    }

    if (typeof body.carrier === 'string') {
      allowedUpdates.carrier = body.carrier.trim().slice(0, 50)
    }

    if (typeof body.timezone === 'string') {
      allowedUpdates.timezone = body.timezone.trim()
    }

    if (typeof body.google_review_url === 'string') {
      allowedUpdates.google_review_url = body.google_review_url.trim()
    }

    if (typeof body.auto_reply_template === 'string') {
      allowedUpdates.auto_reply_template = body.auto_reply_template.trim().slice(0, 1000)
    }

    if (typeof body.reactivation_enabled === 'boolean') {
      allowedUpdates.reactivation_enabled = body.reactivation_enabled
    }

    if (typeof body.default_reactivation_interval_days !== 'undefined') {
      const val = parseInt(String(body.default_reactivation_interval_days), 10)
      if (!isNaN(val) && val > 0 && val <= 365) {
        allowedUpdates.default_reactivation_interval_days = val
      }
    }

    if (typeof body.reactivation_cooldown_days !== 'undefined') {
      const val = parseInt(String(body.reactivation_cooldown_days), 10)
      if (!isNaN(val) && val > 0 && val <= 365) {
        allowedUpdates.reactivation_cooldown_days = val
      }
    }

    if (typeof body.reactivation_template === 'string') {
      allowedUpdates.reactivation_template = body.reactivation_template.trim().slice(0, 1000)
    }

    if (typeof body.reactivation_quiet_hours === 'boolean') {
      allowedUpdates.reactivation_quiet_hours = body.reactivation_quiet_hours
    }

    if (typeof body.reactivation_max_daily !== 'undefined') {
      const val = parseInt(String(body.reactivation_max_daily), 10)
      if (!isNaN(val) && val > 0 && val <= 1000) {
        allowedUpdates.reactivation_max_daily = val
      }
    }

    if (typeof body.booking_mode === 'string' && ['instant', 'request'].includes(body.booking_mode)) {
      allowedUpdates.booking_mode = body.booking_mode
    }

    if (typeof body.default_duration_minutes !== 'undefined') {
      const val = parseInt(String(body.default_duration_minutes), 10)
      if (!isNaN(val) && val > 0 && val <= 480) {
        allowedUpdates.default_duration_minutes = val
      }
    }

    if (typeof body.buffer_minutes !== 'undefined') {
      const val = parseInt(String(body.buffer_minutes), 10)
      if (!isNaN(val) && val >= 0 && val <= 120) {
        allowedUpdates.buffer_minutes = val
      }
    }

    if (typeof body.minimum_notice_hours !== 'undefined') {
      const val = parseInt(String(body.minimum_notice_hours), 10)
      if (!isNaN(val) && val >= 0 && val <= 72) {
        allowedUpdates.minimum_notice_hours = val
      }
    }

    if (typeof body.max_booking_days_ahead !== 'undefined') {
      const val = parseInt(String(body.max_booking_days_ahead), 10)
      if (!isNaN(val) && val > 0 && val <= 90) {
        allowedUpdates.max_booking_days_ahead = val
      }
    }

    if (Array.isArray(body.blocked_dates)) {
      allowedUpdates.blocked_dates = body.blocked_dates.filter((d: any) => typeof d === 'string')
    }

    // 10DLC Carrier & Brand Registration Updates
    if (typeof body.legal_business_name === 'string') {
      allowedUpdates.legal_business_name = body.legal_business_name.trim().slice(0, 200) || null
    }

    if (typeof body.business_type === 'string') {
      const bType = body.business_type.trim().toLowerCase()
      if (['llc', 'corporation', 'partnership', 'sole_proprietorship', 'non_profit', 'other'].includes(bType)) {
        allowedUpdates.business_type = bType
      }
    }

    if (typeof body.ein === 'string') {
      allowedUpdates.ein = body.ein.trim().slice(0, 30) || null
    }

    if (typeof body.is_sole_proprietor === 'boolean') {
      allowedUpdates.is_sole_proprietor = body.is_sole_proprietor
    }

    if (typeof body.address_street === 'string') {
      allowedUpdates.address_street = body.address_street.trim().slice(0, 200) || null
    }

    if (typeof body.address_city === 'string') {
      allowedUpdates.address_city = body.address_city.trim().slice(0, 100) || null
    }

    if (typeof body.address_state === 'string') {
      allowedUpdates.address_state = body.address_state.trim().slice(0, 50) || null
    }

    if (typeof body.address_postal_code === 'string') {
      allowedUpdates.address_postal_code = body.address_postal_code.trim().slice(0, 20) || null
    }

    if (typeof body.website_url === 'string') {
      allowedUpdates.website_url = body.website_url.trim().slice(0, 300) || null
    }

    if (typeof body.industry === 'string') {
      allowedUpdates.industry = body.industry.trim().slice(0, 50) || 'general'
    }

    if (typeof body.operation_mode === 'string' && ['solo', 'multi_crew'].includes(body.operation_mode.toLowerCase().trim())) {
      allowedUpdates.operation_mode = body.operation_mode.toLowerCase().trim()
    } else if (typeof body.operationMode === 'string' && ['solo', 'multi_crew'].includes(body.operationMode.toLowerCase().trim())) {
      allowedUpdates.operation_mode = body.operationMode.toLowerCase().trim()
    }

    if (typeof body.weekly_digest_enabled === 'boolean') {
      allowedUpdates.weekly_digest_enabled = body.weekly_digest_enabled
    }

    if (Array.isArray(body.weekly_digest_channels)) {
      allowedUpdates.weekly_digest_channels = body.weekly_digest_channels.filter((c: any) => typeof c === 'string')
    }

    if (typeof body.weekly_digest_day_of_week !== 'undefined') {
      const val = parseInt(String(body.weekly_digest_day_of_week), 10)
      if (!isNaN(val) && val >= 0 && val <= 6) {
        allowedUpdates.weekly_digest_day_of_week = val
      }
    }

    if (typeof body.weekly_digest_hour !== 'undefined') {
      const val = parseInt(String(body.weekly_digest_hour), 10)
      if (!isNaN(val) && val >= 0 && val <= 23) {
        allowedUpdates.weekly_digest_hour = val
      }
    }

    // Direct Homeowner Invoice External Payment URL & Instructions
    if (typeof body.external_payment_url === 'string') {
      allowedUpdates.external_payment_url = body.external_payment_url.trim().slice(0, 500) || null
    } else if (body.external_payment_url === null) {
      allowedUpdates.external_payment_url = null
    }

    if (typeof body.payment_instructions === 'string') {
      allowedUpdates.payment_instructions = body.payment_instructions.trim().slice(0, 2000) || null
    } else if (body.payment_instructions === null) {
      allowedUpdates.payment_instructions = null
    }

    // Trade License Number (homeowner trust & verified contractor identity)
    if (typeof body.license_number === 'string') {
      allowedUpdates.license_number = body.license_number.trim().slice(0, 100) || null
    } else if (body.license_number === null) {
      allowedUpdates.license_number = null
    }

    // Customer Tracking Presentation Mode (Domino's milestone vs geofence live)
    if (typeof body.tracking_mode === 'string' && ['milestone', 'geofence_live'].includes(body.tracking_mode)) {
      allowedUpdates.tracking_mode = body.tracking_mode
    }

    if (typeof body.tracking_geofence_miles !== 'undefined') {
      const val = parseFloat(String(body.tracking_geofence_miles))
      if (!isNaN(val) && val > 0 && val <= 50) {
        allowedUpdates.tracking_geofence_miles = val
      }
    }

    // If client submits updated carrier verification fields, update status to pending review
    if (
      body.submit_carrier_verification === true ||
      ((allowedUpdates.ein || allowedUpdates.is_sole_proprietor) && allowedUpdates.legal_business_name)
    ) {
      allowedUpdates.carrier_registration_status = 'pending'
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 })
    }

    // 3. Persist mutation with row-level tenant bounding
    let { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update(allowedUpdates)
      .eq('id', orgId)
      .select()
      .single()

    // Fallback: If newer columns do not exist in schema (error 42703), retry without them
    if (
      updateError &&
      (updateError.code === '42703' ||
        updateError.message?.toLowerCase().includes('does not exist'))
    ) {
      const sanitizedUpdates = { ...allowedUpdates }
      if (updateError.message?.toLowerCase().includes('operation_mode') || updateError.code === '42703') delete sanitizedUpdates.operation_mode
      if (updateError.message?.toLowerCase().includes('industry')) delete sanitizedUpdates.industry
      if (updateError.message?.toLowerCase().includes('external_payment_url')) delete sanitizedUpdates.external_payment_url
      if (updateError.message?.toLowerCase().includes('payment_instructions')) delete sanitizedUpdates.payment_instructions
      if (updateError.message?.toLowerCase().includes('license_number')) delete sanitizedUpdates.license_number
      if (updateError.message?.toLowerCase().includes('tracking_mode')) delete sanitizedUpdates.tracking_mode
      if (updateError.message?.toLowerCase().includes('tracking_geofence_miles')) delete sanitizedUpdates.tracking_geofence_miles
      
      const retryRes = await supabase
        .from('organizations')
        .update(sanitizedUpdates)
        .eq('id', orgId)
        .select()
        .single()
      updatedOrg = retryRes.data
      updateError = retryRes.error
    }

    if (updateError) {
      console.error('[ORG_UPDATE_ERROR]', updateError)
      return NextResponse.json({ error: updateError.message || 'Failed to update organization' }, { status: 500 })
    }

    // 4. Audit Log organization mutation
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'organization.settings_updated',
      description: `Organization settings updated by ${user.email || user.id} (${role})`,
      metadata: {
        updated_fields: Object.keys(allowedUpdates),
        user_id: user.id,
        role
      }
    })

    return NextResponse.json({
      success: true,
      organization: updatedOrg
    })
  } catch (err: any) {
    console.error('[ORG_UPDATE_EXCEPTION]', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
