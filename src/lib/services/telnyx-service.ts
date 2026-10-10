import { sendTelnyxSms, toE164, verifyTelnyxSignature } from '../telnyx.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { resolveOrganizationByPhoneNumber, hasCapability } from '../telephony/telnyx-numbers.ts'
import { provisionOrganizationPhoneNumber } from '../telephony/provisioning.ts'

export interface TelnyxSearchNumbersOptions {
  areaCode: string
  limit?: number
}

export interface TelnyxAvailableNumber {
  phoneNumber: string
  locality?: string
  region?: string
  capabilities: string[]
}

/**
 * TelnyxService
 * 
 * Domain service & provider adapter isolating all Telnyx telephony,
 * WebRTC, SMS dispatch, webhook cryptographic verification, and phone provisioning.
 */
export class TelnyxService {
  /**
   * Dispatches an outbound SMS message via Telnyx API.
   */
  static async sendSms(params: { to: string; text: string; from?: string }) {
    return sendTelnyxSms(params)
  }

  /**
   * Formats a phone number to standard E.164.
   */
  static formatPhone(phone: string): string {
    return toE164(phone)
  }

  /**
   * Validates whether a phone number matches E.164 format.
   */
  static isValidPhone(phone: string): boolean {
    const res = normalizePhoneToE164(phone)
    return res.isValid
  }

  /**
   * Cryptographically verifies an incoming Telnyx webhook ED25519 signature.
   */
  static verifyWebhookSignature(params: {
    rawBody: string
    signature: string | null
    timestamp: string | null
    publicKeyOverride?: string
  }): boolean {
    return verifyTelnyxSignature(
      params.rawBody,
      params.signature,
      params.timestamp,
      params.publicKeyOverride
    )
  }

  /**
   * Searches available Telnyx numbers in an area code using the official Telnyx API.
   */
  static async searchAvailableNumbers(areaCode: string, limit: number = 5): Promise<TelnyxAvailableNumber[]> {
    const { TelnyxApiClient } = await import('../telephony/telnyx-api-client.ts')
    const client = new TelnyxApiClient()
    const results = await client.searchAvailableNumbers({ areaCode, limit })
    return results.map((r) => ({
      phoneNumber: r.phoneNumber,
      locality: r.locality,
      region: r.region,
      capabilities: r.features
    }))
  }

  /**
   * Orders and assigns a phone number for a tenant organization.
   */
  static async orderNumber(params: {
    supabase: any
    orgId: string
    preferredNumberOrAreaCode?: string
    messagingProfileId?: string
    connectionId?: string
  }) {
    return provisionOrganizationPhoneNumber(params.supabase, {
      orgId: params.orgId,
      preferredNumberOrAreaCode: params.preferredNumberOrAreaCode,
      messagingProfileId: params.messagingProfileId,
      connectionId: params.connectionId
    })
  }

  /**
   * Resolves the tenant organization that owns a given inbound Telnyx phone number.
   */
  static async resolveTenantByNumber(supabase: any, rawPhoneNumber: string) {
    return resolveOrganizationByPhoneNumber(supabase, rawPhoneNumber)
  }

  /**
   * Verifies number capability (e.g. voice or sms).
   */
  static hasCapability(record: any, required: 'voice' | 'sms') {
    return hasCapability(record, required)
  }
}
