import type { MarketingAttributionData } from './agency-types.ts'

/**
 * 30-Day Default Attribution Window in Milliseconds
 */
export const DEFAULT_ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Sanitizes a single raw UTM or tracking parameter.
 * Strips script tags, HTML tags, and unsafe special characters.
 */
export function sanitizeParam(raw: any, maxLength: number = 100): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Strip dangerous characters and HTML tags
  const sanitized = trimmed
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'";&`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!sanitized) return null
  return sanitized.slice(0, maxLength)
}

/**
 * Validates and sanitizes a complete marketing attribution payload.
 * Enforces length limits, allowed characters, and valid timestamps.
 */
export function sanitizeAttributionInput(input: any): MarketingAttributionData | null {
  if (!input || typeof input !== 'object') return null

  // Extract from either camelCase or snake_case keys
  const rawSource = input.utm_source ?? input.utmSource ?? input.source
  const rawMedium = input.utm_medium ?? input.utmMedium ?? input.medium
  const rawCampaign = input.utm_campaign ?? input.utmCampaign ?? input.campaign
  const rawContent = input.utm_content ?? input.utmContent ?? input.content
  const rawTerm = input.utm_term ?? input.utmTerm ?? input.term
  const rawLanding = input.landing_page ?? input.landingPage
  const rawReferrer = input.referrer ?? input.referrerDomain

  const utm_source = sanitizeParam(rawSource, 100)
  const utm_campaign = sanitizeParam(rawCampaign, 150)

  // A valid attribution requires at least a valid source or campaign
  if (!utm_source && !utm_campaign) {
    return null
  }

  const utm_medium = sanitizeParam(rawMedium, 100)
  const utm_content = sanitizeParam(rawContent, 150)
  const utm_term = sanitizeParam(rawTerm, 150)
  const landing_page = sanitizeParam(rawLanding, 500)
  const referrer = sanitizeParam(rawReferrer, 500)

  // Validate or assign first_touch_at timestamp
  let first_touch_at = new Date().toISOString()
  const rawTimestamp = input.first_touch_at ?? input.firstTouchAt ?? input.attributionTimestamp
  if (rawTimestamp && typeof rawTimestamp === 'string') {
    const parsedMs = new Date(rawTimestamp).getTime()
    if (!isNaN(parsedMs) && parsedMs <= Date.now() + 60000) {
      first_touch_at = new Date(parsedMs).toISOString()
    }
  }

  return {
    utm_source: (utm_source || 'direct').toLowerCase(),
    utm_campaign: (utm_campaign || 'unspecified').toLowerCase(),
    utm_medium: utm_medium ? utm_medium.toLowerCase() : null,
    utm_content: utm_content || null,
    utm_term: utm_term || null,
    landing_page: landing_page || null,
    referrer: referrer || null,
    first_touch_at
  }
}

/**
 * Checks whether an attribution timestamp falls within the active attribution window.
 */
export function isAttributionWithinWindow(
  firstTouchAt: string,
  windowDays: number = 30
): boolean {
  if (!firstTouchAt) return false
  const touchMs = new Date(firstTouchAt).getTime()
  if (isNaN(touchMs)) return false

  const windowMs = windowDays * 24 * 60 * 60 * 1000
  const elapsed = Date.now() - touchMs
  return elapsed >= 0 && elapsed <= windowMs
}

/**
 * Resolves a normalized channel source category for reporting.
 */
export function resolveMarketingChannel(
  source?: string | null,
  medium?: string | null,
  referrer?: string | null
): string {
  const s = (source || '').toLowerCase().trim()
  const m = (medium || '').toLowerCase().trim()
  const r = (referrer || '').toLowerCase().trim()

  if (s.includes('google-lsa') || s.includes('lsa') || s.includes('local-services')) {
    return 'Google Local Services'
  }
  if (s.includes('google') && (m.includes('cpc') || m.includes('paid') || s.includes('ad'))) {
    return 'Google Ads'
  }
  if (s.includes('facebook') || s.includes('meta') || s === 'fb') {
    return 'Facebook Ads'
  }
  if (s.includes('instagram') || s === 'ig') {
    return 'Instagram Ads'
  }
  if (s.includes('embed') || m.includes('embed') || s.includes('widget')) {
    return 'Contractor Website Embed'
  }
  if (s.includes('missed_call') || s.includes('missed-call') || m === 'sms') {
    return 'Missed-Call Recovery'
  }
  if (s.includes('referral') || m.includes('referral')) {
    return 'Customer Referral'
  }
  if (s.includes('organic') || m.includes('organic') || s.includes('maps') || r.includes('google.com')) {
    return 'Organic Search'
  }
  if (s === 'direct' || (!s && !m && !r)) {
    return 'Direct'
  }

  return s || 'Unknown'
}

/**
 * Computes Return On Ad Spend (ROAS).
 * Formula: Net Collected Revenue / Actual Recorded Ad Spend.
 * Returns null if ad spend is missing or zero (safe zero denominator).
 */
export function computeRoas(
  netRevenue: number,
  adSpend?: number | null
): number | null {
  if (typeof adSpend !== 'number' || !Number.isFinite(adSpend) || adSpend <= 0) {
    return null
  }
  return Number((netRevenue / adSpend).toFixed(2))
}

/**
 * Computes Marketing ROI.
 * Formula: (Net Collected Revenue - Total Marketing Costs) / Total Marketing Costs.
 * Returns null if total costs are missing or zero (safe zero denominator).
 */
export function computeRoi(
  netRevenue: number,
  totalCosts?: number | null
): number | null {
  if (typeof totalCosts !== 'number' || !Number.isFinite(totalCosts) || totalCosts <= 0) {
    return null
  }
  const roi = (netRevenue - totalCosts) / totalCosts
  return Number(roi.toFixed(2))
}
