import { normalizePhoneToE164 } from './phone-normalizer.ts'

export type LineType = 'mobile' | 'voip' | 'landline' | 'unknown'
export type CarrierPreset = 'verizon' | 'att' | 'tmobile' | 'other'

export interface PhoneLookupResult {
  e164Phone: string
  lineType: LineType
  carrierName: string | null
  detectedCarrierPreset: CarrierPreset
  canReceiveSms: boolean
  warning: string | null
}

/**
 * Maps Telnyx / carrier names to standard carrier forwarding presets
 */
export function inferCarrierPreset(carrierName?: string | null): CarrierPreset {
  if (!carrierName) return 'other'
  const norm = carrierName.toLowerCase()

  if (norm.includes('verizon') || norm.includes('cellco')) {
    return 'verizon'
  }
  if (
    norm.includes('at&t') ||
    norm.includes('att') ||
    norm.includes('cingular') ||
    norm.includes('new cingular') ||
    norm.includes('cricket')
  ) {
    return 'att'
  }
  if (
    norm.includes('t-mobile') ||
    norm.includes('tmobile') ||
    norm.includes('sprint') ||
    norm.includes('metro')
  ) {
    return 'tmobile'
  }

  return 'other'
}

/**
 * Inspects Telnyx line_type and carrier metadata to determine whether a number is mobile, voip, or landline
 */
export function categorizeLineType(
  rawLineType?: string | null,
  carrierType?: string | null
): LineType {
  const combined = `${rawLineType || ''} ${carrierType || ''}`.toLowerCase()

  if (
    combined.includes('mobile') ||
    combined.includes('wireless') ||
    combined.includes('cellular') ||
    combined.includes('cell')
  ) {
    return 'mobile'
  }
  if (combined.includes('voip') || combined.includes('virtual')) {
    return 'voip'
  }
  if (
    combined.includes('landline') ||
    combined.includes('fixed line') ||
    combined.includes('fixed') ||
    combined.includes('wireline')
  ) {
    return 'landline'
  }

  return 'unknown'
}

/**
 * Performs a fast, non-blocking Telnyx Number Lookup with mobile/landline categorization and carrier inference
 */
export async function lookupPhoneNumber(rawPhone: string): Promise<PhoneLookupResult> {
  const normalized = normalizePhoneToE164(rawPhone)
  if (!normalized.isValid || !normalized.e164) {
    return {
      e164Phone: rawPhone,
      lineType: 'unknown',
      carrierName: null,
      detectedCarrierPreset: 'other',
      canReceiveSms: false,
      warning: normalized.error || 'Invalid phone format'
    }
  }

  const e164 = normalized.e164
  const apiKey = process.env.TELNYX_API_KEY
  const isOfflineOrTest = process.env.NODE_ENV === 'test' || !apiKey || process.env.TELNYX_MOCK_DISPATCH === 'true'

  if (isOfflineOrTest) {
    return {
      e164Phone: e164,
      lineType: 'unknown',
      carrierName: null,
      detectedCarrierPreset: 'other',
      canReceiveSms: true,
      warning: null
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const url = `https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(e164)}?type=carrier&type=portability`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return {
        e164Phone: e164,
        lineType: 'unknown',
        carrierName: null,
        detectedCarrierPreset: 'other',
        canReceiveSms: true,
        warning: null
      }
    }

    const payload = await res.json()
    const data = payload?.data || {}

    const rawLineType = data.portability?.line_type || null
    const carrierName = data.carrier?.name || null
    const carrierType = data.carrier?.type || null

    const lineType = categorizeLineType(rawLineType, carrierType)
    const detectedCarrierPreset = inferCarrierPreset(carrierName)
    const canReceiveSms = lineType !== 'landline'

    let warning: string | null = null
    if (lineType === 'landline') {
      const displayCarrier = carrierName ? ` (${carrierName})` : ''
      warning = `⚠️ This looks like a Landline${displayCarrier}. Ask the owner for their personal cell number before texting the claim link!`
    }

    return {
      e164Phone: e164,
      lineType,
      carrierName,
      detectedCarrierPreset,
      canReceiveSms,
      warning
    }
  } catch {
    // Graceful fallback on network timeout or fetch error
    return {
      e164Phone: e164,
      lineType: 'unknown',
      carrierName: null,
      detectedCarrierPreset: 'other',
      canReceiveSms: true,
      warning: null
    }
  }
}
