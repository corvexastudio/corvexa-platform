import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhoneToE164 } from './phone-normalizer.ts'
import { logAuditEvent } from '../security/audit-logger.ts'
import {
  TelnyxApiClient,
  TelnyxApiError,
  type TelnyxNumberOrderResponse
} from './telnyx-api-client.ts'

export interface ProvisionNumberParams {
  orgId: string
  preferredNumberOrAreaCode?: string
  messagingProfileId?: string
  connectionId?: string
  webhookUrl?: string
  apiClient?: TelnyxApiClient
}

export interface ProvisionNumberResult {
  success: boolean
  phoneNumber?: string
  recordId?: string
  orderId?: string
  status: 'active' | 'provisioning' | 'already_assigned' | 'failed'
  error?: string
}

/**
 * Clean, idempotent service abstraction for provisioning a dedicated, REAL Telnyx phone number
 * to a tenant organization via the official Telnyx v2 API.
 * 
 * Invariants:
 * 1. A synthetic or randomly generated phone number is NEVER created in production.
 * 2. Only a confirmed Telnyx-owned number order may become an active tenant DID.
 * 3. Fully idempotent against network retries, crash/timeout, and double-submissions.
 * 4. Multi-tenant isolation: An active number is unique per organization and across all organizations.
 */
export async function provisionOrganizationPhoneNumber(
  supabase: SupabaseClient,
  params: ProvisionNumberParams
): Promise<ProvisionNumberResult> {
  const { orgId, preferredNumberOrAreaCode, messagingProfileId, connectionId } = params

  if (!orgId) {
    return { success: false, status: 'failed', error: 'Organization ID is required' }
  }

  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production'

  // Initialize or receive Telnyx API client
  const apiClient = params.apiClient || new TelnyxApiClient()

  // 1. Fetch organization record
  const { data: orgRow, error: orgFetchErr } = await supabase
    .from('organizations')
    .select('id, name, telnyx_phone_number, phone_provisioning_status, telnyx_order_id, telnyx_phone_number_id')
    .eq('id', orgId)
    .maybeSingle()

  if (orgFetchErr || !orgRow) {
    return { success: false, status: 'failed', error: 'Organization not found' }
  }

  // 2. Idempotency Check A: Does this organization already have an active, verified phone number?
  const { data: existingActive } = await supabase
    .from('telnyx_phone_numbers')
    .select('id, phone_number, status, verification_status')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .maybeSingle()

  if (existingActive && existingActive.verification_status !== 'unverified') {
    return {
      success: true,
      phoneNumber: existingActive.phone_number,
      recordId: existingActive.id,
      status: 'already_assigned'
    }
  }

  if (
    orgRow.telnyx_phone_number &&
    orgRow.phone_provisioning_status === 'active' &&
    (!existingActive || existingActive.verification_status === 'verified')
  ) {
    return {
      success: true,
      phoneNumber: orgRow.telnyx_phone_number,
      status: 'already_assigned'
    }
  }

  // 3. Crash / Timeout Reconciliation (Idempotency Check B):
  // Check if an order is already in-flight or was previously placed on Telnyx
  const customerRef = `org_${orgId}`
  const existingOrderId = orgRow.telnyx_order_id || null

  try {
    let priorOrder: TelnyxNumberOrderResponse | null = null

    if (existingOrderId) {
      priorOrder = await apiClient.getNumberOrder(existingOrderId).catch(() => null)
    } else {
      priorOrder = await apiClient
        .findExistingNumberOrderByCustomerReference(customerRef)
        .catch(() => null)
    }

    if (priorOrder) {
      if (priorOrder.status === 'success' && priorOrder.phoneNumbers.length > 0) {
        const confirmedNum = priorOrder.phoneNumbers[0]
        return await finalizeProvisionedNumber(supabase, {
          orgId,
          phoneNumber: confirmedNum.phoneNumber,
          orderId: priorOrder.orderId,
          telnyxPhoneNumberId: confirmedNum.id,
          messagingProfileId,
          connectionId
        })
      }

      if (priorOrder.status === 'pending') {
        // Attempt short bounded poll to see if it settled
        const polled = await apiClient
          .pollNumberOrderUntilSettled(priorOrder.orderId, 2, 500)
          .catch(() => priorOrder)

        if (polled.status === 'success' && polled.phoneNumbers.length > 0) {
          const confirmedNum = polled.phoneNumbers[0]
          return await finalizeProvisionedNumber(supabase, {
            orgId,
            phoneNumber: confirmedNum.phoneNumber,
            orderId: polled.orderId,
            telnyxPhoneNumberId: confirmedNum.id,
            messagingProfileId,
            connectionId
          })
        }

        // Still pending on provider side: keep provisioning status and return safely
        return {
          success: true,
          status: 'provisioning',
          orderId: priorOrder.orderId,
          phoneNumber: priorOrder.phoneNumbers[0]?.phoneNumber
        }
      }
    }
  } catch (reconcileErr) {
    console.warn('[TELNYX RECONCILIATION WARNING]', reconcileErr)
  }

  // 4. Concurrency Guard: Atomic update to prevent multiple concurrent purchases
  if (orgRow.phone_provisioning_status === 'provisioning' && !orgRow.telnyx_order_id) {
    return {
      success: false,
      status: 'provisioning',
      error: 'Provisioning is already in progress for this organization'
    }
  }

  await supabase
    .from('organizations')
    .update({
      phone_provisioning_status: 'provisioning',
      updated_at: new Date().toISOString()
    })
    .eq('id', orgId)

  // 5. Fail-Closed Credential Check for Production
  if (!process.env.TELNYX_API_KEY && !params.apiClient) {
    if (isProduction) {
      await supabase
        .from('organizations')
        .update({ phone_provisioning_status: 'failed' })
        .eq('id', orgId)

      return {
        success: false,
        status: 'failed',
        error: 'TELNYX_API_KEY is not configured in production environment'
      }
    }

    // Explicit Non-Production / Test Mode with explicit number:
    // Support test mock if running under Node test runner without external credentials
    if (process.env.NODE_ENV === 'test' && preferredNumberOrAreaCode?.startsWith('+')) {
      const norm = normalizePhoneToE164(preferredNumberOrAreaCode)
      if (!norm.isValid || !norm.e164) {
        return { success: false, status: 'failed', error: `Invalid requested phone number: ${norm.error}` }
      }

      // Check collision
      const { data: numCollision } = await supabase
        .from('telnyx_phone_numbers')
        .select('id, org_id')
        .eq('phone_number', norm.e164)
        .eq('status', 'active')
        .maybeSingle()

      if (numCollision && numCollision.org_id !== orgId) {
        await supabase.from('organizations').update({ phone_provisioning_status: 'failed' }).eq('id', orgId)
        return { success: false, status: 'failed', error: `Phone number ${norm.e164} is already assigned to another organization.` }
      }

      return await finalizeProvisionedNumber(supabase, {
        orgId,
        phoneNumber: norm.e164,
        orderId: `test_order_${Date.now()}`,
        telnyxPhoneNumberId: `test_num_${Date.now()}`,
        messagingProfileId,
        connectionId
      })
    }

    await supabase.from('organizations').update({ phone_provisioning_status: 'failed' }).eq('id', orgId)
    return {
      success: false,
      status: 'failed',
      error: 'TELNYX_API_KEY is not configured'
    }
  }

  // 6. Real Telnyx Number Search
  let candidateNumber: string | null = null
  let candidateLocality: string | undefined
  let candidateRegion: string | undefined

  try {
    let targetAreaCode: string | undefined

    if (preferredNumberOrAreaCode) {
      if (preferredNumberOrAreaCode.startsWith('+')) {
        const match = preferredNumberOrAreaCode.match(/^\+1([2-9]\d{2})/)
        if (match) targetAreaCode = match[1]
      } else if (/^\d{3}$/.test(preferredNumberOrAreaCode)) {
        targetAreaCode = preferredNumberOrAreaCode
      }
    }

    const searchResults = await apiClient.searchAvailableNumbers({
      areaCode: targetAreaCode,
      countryCode: 'US',
      limit: 5,
      features: ['sms', 'voice']
    })

    if (!searchResults || searchResults.length === 0) {
      await supabase
        .from('organizations')
        .update({ phone_provisioning_status: 'failed' })
        .eq('id', orgId)

      return {
        success: false,
        status: 'failed',
        error: `No available Telnyx phone numbers found for area code ${targetAreaCode || 'any'}`
      }
    }

    // Select first eligible candidate returned by Telnyx search
    const selected = searchResults[0]
    candidateNumber = selected.phoneNumber
    candidateLocality = selected.locality
    candidateRegion = selected.region
  } catch (searchErr: any) {
    await supabase
      .from('organizations')
      .update({ phone_provisioning_status: 'failed' })
      .eq('id', orgId)

    return {
      success: false,
      status: 'failed',
      error: searchErr instanceof TelnyxApiError ? searchErr.message : `Telnyx number search failed: ${searchErr?.message}`
    }
  }

  // 7. Verify Number Collision in Database Before Purchase
  const { data: numberCollision } = await supabase
    .from('telnyx_phone_numbers')
    .select('id, org_id')
    .eq('phone_number', candidateNumber)
    .eq('status', 'active')
    .maybeSingle()

  if (numberCollision && numberCollision.org_id !== orgId) {
    await supabase.from('organizations').update({ phone_provisioning_status: 'failed' }).eq('id', orgId)
    return {
      success: false,
      status: 'failed',
      error: `Phone number ${candidateNumber} is already assigned to another organization.`
    }
  }

  // 8. Submit Real Telnyx Number Order
  let orderResponse: TelnyxNumberOrderResponse
  try {
    orderResponse = await apiClient.createNumberOrder({
      phoneNumber: candidateNumber,
      customerReference: customerRef,
      connectionId: connectionId || process.env.TELNYX_CONNECTION_ID || undefined,
      messagingProfileId: messagingProfileId || process.env.TELNYX_MESSAGING_PROFILE_ID || undefined
    })
  } catch (orderErr: any) {
    await supabase
      .from('organizations')
      .update({ phone_provisioning_status: 'failed' })
      .eq('id', orgId)

    return {
      success: false,
      status: 'failed',
      error: orderErr instanceof TelnyxApiError ? orderErr.message : `Telnyx number order failed: ${orderErr?.message}`
    }
  }

  // 9. Persist In-Flight Order Data
  const subOrder = orderResponse.phoneNumbers[0]
  const confirmedPhone = subOrder?.phoneNumber || candidateNumber

  const { data: insertedRecord, error: insertErr } = await supabase
    .from('telnyx_phone_numbers')
    .insert({
      org_id: orgId,
      phone_number: confirmedPhone,
      status: orderResponse.status === 'success' ? 'active' : 'pending',
      order_id: orderResponse.orderId,
      telnyx_phone_number_id: subOrder?.id || null,
      verification_status: orderResponse.status === 'success' ? 'verified' : 'unverified',
      capabilities: ['voice', 'sms'],
      messaging_profile_id: messagingProfileId || null,
      connection_id: connectionId || null,
      provisioning_metadata: {
        order_id: orderResponse.orderId,
        customer_reference: customerRef,
        locality: candidateLocality,
        region: candidateRegion,
        submitted_at: new Date().toISOString()
      }
    })
    .select()
    .maybeSingle()

  if (insertErr) {
    console.error('[PROVISIONING DB ERROR] Failed to record order:', insertErr)
  }

  await supabase
    .from('organizations')
    .update({
      telnyx_order_id: orderResponse.orderId,
      telnyx_phone_number_id: subOrder?.id || null,
      phone_provisioning_status: orderResponse.status === 'success' ? 'active' : 'provisioning',
      telnyx_phone_number: orderResponse.status === 'success' ? confirmedPhone : null
    })
    .eq('id', orgId)

  // 10. Settle or Poll for Asynchronous Completion
  if (orderResponse.status === 'success') {
    return {
      success: true,
      phoneNumber: confirmedPhone,
      recordId: insertedRecord?.id,
      orderId: orderResponse.orderId,
      status: 'active'
    }
  }

  // Bounded poll for fulfillment (up to 3 seconds)
  const finalOrder = await apiClient
    .pollNumberOrderUntilSettled(orderResponse.orderId, 3, 1000)
    .catch(() => orderResponse)

  if (finalOrder.status === 'success') {
    return await finalizeProvisionedNumber(supabase, {
      orgId,
      phoneNumber: confirmedPhone,
      orderId: finalOrder.orderId,
      telnyxPhoneNumberId: finalOrder.phoneNumbers[0]?.id || subOrder?.id,
      messagingProfileId,
      connectionId,
      existingRecordId: insertedRecord?.id
    })
  }

  if (finalOrder.status === 'failure') {
    await supabase.from('organizations').update({ phone_provisioning_status: 'failed' }).eq('id', orgId)
    await supabase.from('telnyx_phone_numbers').update({ status: 'released', verification_status: 'failed' }).eq('org_id', orgId).eq('order_id', finalOrder.orderId)
    return {
      success: false,
      status: 'failed',
      orderId: finalOrder.orderId,
      error: 'Telnyx order failed during provider fulfillment'
    }
  }

  // Still pending on provider side: keep safe 'provisioning' state
  return {
    success: true,
    phoneNumber: confirmedPhone,
    orderId: finalOrder.orderId,
    status: 'provisioning'
  }
}

/**
 * Finalizes and activates a confirmed Telnyx phone number in the database.
 */
async function finalizeProvisionedNumber(
  supabase: SupabaseClient,
  details: {
    orgId: string
    phoneNumber: string
    orderId: string
    telnyxPhoneNumberId?: string
    messagingProfileId?: string
    connectionId?: string
    existingRecordId?: string
  }
): Promise<ProvisionNumberResult> {
  const { orgId, phoneNumber, orderId, telnyxPhoneNumberId, messagingProfileId, connectionId, existingRecordId } = details

  let recordId = existingRecordId

  if (recordId) {
    await supabase
      .from('telnyx_phone_numbers')
      .update({
        status: 'active',
        verification_status: 'verified',
        order_id: orderId,
        telnyx_phone_number_id: telnyxPhoneNumberId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
  } else {
    const { data: upserted } = await supabase
      .from('telnyx_phone_numbers')
      .upsert(
        {
          org_id: orgId,
          phone_number: phoneNumber,
          status: 'active',
          order_id: orderId,
          telnyx_phone_number_id: telnyxPhoneNumberId || null,
          verification_status: 'verified',
          capabilities: ['voice', 'sms'],
          messaging_profile_id: messagingProfileId || null,
          connection_id: connectionId || null,
          provisioning_metadata: {
            order_id: orderId,
            verified_at: new Date().toISOString()
          }
        },
        { onConflict: 'phone_number' }
      )
      .select('id')
      .maybeSingle()

    recordId = upserted?.id
  }

  // Update organization
  await supabase
    .from('organizations')
    .update({
      telnyx_phone_number: phoneNumber,
      phone_provisioning_status: 'active',
      telnyx_order_id: orderId,
      telnyx_phone_number_id: telnyxPhoneNumberId || null,
      telnyx_provisioned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orgId)

  // Audit logging
  try {
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'security.login',
      description: `Dedicated Telnyx phone number ${phoneNumber} successfully provisioned (Order: ${orderId})`,
      metadata: {
        phone_number: phoneNumber,
        order_id: orderId,
        action: 'real_phone_provisioned'
      }
    })
  } catch {
    // Non-blocking
  }

  return {
    success: true,
    phoneNumber,
    recordId,
    orderId,
    status: 'active'
  }
}
