export type PricingModel = 'fixed' | 'starting_at' | 'diagnostic_fee' | 'free_estimate' | 'quote_on_site'

export interface ServiceAddOn {
  id: string
  name: string
  description?: string
  price: number | null
  duration_minutes?: number
}

export interface ParsedServicePricing {
  model: PricingModel
  price: number | null
  cleanDescription: string
  formattedPrice: string
  shortLabel: string
  addOns: ServiceAddOn[]
}

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  fixed: 'Fixed Price',
  starting_at: 'Starting At',
  diagnostic_fee: 'Diagnostic Fee',
  quote_on_site: 'Quote on Site (Blank Price)',
  free_estimate: 'Free Estimate / Consultation'
}

/**
 * Strips pricing model, add-on metadata, and category tags from service descriptions
 */
export function cleanServiceDescription(description?: string | null): string {
  if (!description) return ''
  return description
    .replace(/\[pricing:(fixed|starting_at|diagnostic_fee|free_estimate|quote_on_site)\]\s*/gi, '')
    .replace(/\[addons:([A-Za-z0-9+/=_-]+)\]\s*/gi, '')
    .replace(/\[category:([^\]]+)\]\s*/gi, '')
    .trim()
}

/**
 * Extracts explicit category from service description if present
 */
export function parseServiceCategory(description?: string | null): string {
  if (!description) return ''
  const match = description.match(/\[category:([^\]]+)\]/i)
  return match && match[1] ? match[1].trim() : ''
}

/**
 * Encodes add-ons list into safe metadata token
 */
export function encodeAddOns(addOns: ServiceAddOn[]): string {
  if (!addOns || addOns.length === 0) return ''
  try {
    const jsonStr = JSON.stringify(addOns)
    let encoded = ''
    if (typeof Buffer !== 'undefined') {
      encoded = Buffer.from(jsonStr, 'utf8').toString('base64')
    } else {
      // Browser-safe UTF-8 Base64
      encoded = btoa(unescape(encodeURIComponent(jsonStr)))
    }
    return `[addons:${encoded}]`
  } catch {
    return ''
  }
}

/**
 * Parses add-ons metadata from service description
 */
export function parseAddOns(description?: string | null): ServiceAddOn[] {
  if (!description) return []
  const match = description.match(/\[addons:([A-Za-z0-9+/=_-]+)\]/i)
  if (!match) return []
  try {
    const raw = match[1]
    let decoded = ''
    if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(raw, 'base64').toString('utf8')
    } else {
      try {
        decoded = decodeURIComponent(escape(atob(raw)))
      } catch {
        decoded = atob(raw)
      }
    }

    // DATA-01: Gracefully handle legacy URI-encoded Base64 tokens
    if (decoded.includes('%5B') || decoded.includes('%7B') || decoded.startsWith('%')) {
      try {
        decoded = decodeURIComponent(decoded)
      } catch {
        // Keep decoded as-is
      }
    }

    const parsed = JSON.parse(decoded)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Encodes pricing model tag into service description
 */
export function encodeServiceDescription(description: string | null | undefined, model: PricingModel): string {
  const clean = cleanServiceDescription(description)
  const existingAddOns = parseAddOns(description)
  const addOnsTag = existingAddOns.length > 0 ? encodeAddOns(existingAddOns) : ''
  const pricingTag = model === 'fixed' ? '' : `[pricing:${model}]`
  const parts = [pricingTag, addOnsTag, clean].filter(Boolean)
  return parts.join(' ')
}

/**
 * Encodes pricing model, category tag, and add-ons into service description
 */
export function encodeServiceDescriptionWithAddOns(
  description: string | null | undefined,
  model: PricingModel,
  addOns?: ServiceAddOn[],
  category?: string | null
): string {
  const clean = cleanServiceDescription(description)
  const pricingTag = model === 'fixed' ? '' : `[pricing:${model}]`
  const categoryTag = category && category.trim() ? `[category:${category.trim()}]` : ''
  const addOnsTag = addOns && addOns.length > 0 ? encodeAddOns(addOns) : ''
  const parts = [categoryTag, pricingTag, addOnsTag, clean].filter(Boolean)
  return parts.join(' ')
}

/**
 * Parses raw service price and description into structured pricing model and formatted labels
 */
export function parseServicePricing(
  price: number | string | null | undefined,
  description?: string | null
): ParsedServicePricing {
  const descStr = description || ''
  const tagMatch = descStr.match(/\[pricing:(fixed|starting_at|diagnostic_fee|free_estimate|quote_on_site)\]/i)
  
  const cleanDesc = cleanServiceDescription(descStr)

  let numPrice: number | null = null
  if (price !== null && price !== undefined && price !== '') {
    const p = typeof price === 'number' ? price : parseFloat(String(price))
    if (!isNaN(p)) {
      numPrice = p
    }
  }

  let model: PricingModel = 'fixed'

  if (tagMatch) {
    model = tagMatch[1].toLowerCase() as PricingModel
  } else {
    // Inferred model
    if (numPrice === null || numPrice === undefined) {
      if (/quote on site|quote-on-site/i.test(cleanDesc)) {
        model = 'quote_on_site'
      } else {
        model = 'free_estimate'
      }
    } else if (numPrice === 0) {
      model = 'free_estimate'
    } else if (/diagnostic/i.test(cleanDesc)) {
      model = 'diagnostic_fee'
    } else {
      model = 'fixed'
    }
  }

  let formattedPrice = ''
  let shortLabel = ''

  switch (model) {
    case 'fixed':
      if (numPrice !== null && numPrice > 0) {
        formattedPrice = `$${numPrice.toFixed(2)}`
        shortLabel = `$${numPrice.toFixed(2)}`
      } else {
        formattedPrice = 'Quote on Site'
        shortLabel = 'Quote'
      }
      break
    case 'starting_at':
      if (numPrice !== null && numPrice > 0) {
        formattedPrice = `Starting at $${numPrice.toFixed(2)}`
        shortLabel = `$${numPrice.toFixed(2)}+`
      } else {
        formattedPrice = 'Quote on Site'
        shortLabel = 'Quote'
      }
      break
    case 'diagnostic_fee':
      if (numPrice !== null && numPrice > 0) {
        formattedPrice = `$${numPrice.toFixed(2)} Diagnostic Fee`
        shortLabel = `$${numPrice.toFixed(2)} Diag`
      } else {
        formattedPrice = 'Diagnostic Fee'
        shortLabel = 'Diag Fee'
      }
      break
    case 'quote_on_site':
      if (numPrice !== null && numPrice > 0) {
        formattedPrice = `Quote on Site (Est. $${numPrice.toFixed(2)})`
        shortLabel = 'Quote'
      } else {
        formattedPrice = 'Quote on Site'
        shortLabel = 'Quote'
      }
      break
    case 'free_estimate':
      if (numPrice !== null && numPrice > 0) {
        formattedPrice = `Free Estimate (Est. $${numPrice.toFixed(2)})`
        shortLabel = 'Free Est'
      } else {
        formattedPrice = 'Free Estimate'
        shortLabel = 'Free Est'
      }
      break
  }

  return {
    model,
    price: numPrice,
    cleanDescription: cleanDesc,
    formattedPrice,
    shortLabel,
    addOns: parseAddOns(description)
  }
}

/**
 * Formats live dynamic pricing total and labels according to the 5 canonical pricing models:
 * - fixed: $150.00 or $185.00
 * - starting_at: Starting at $99.00 or Starting at $134.00
 * - diagnostic_fee: $79.00 Diagnostic Fee or $114.00 Diagnostic Fee
 * - quote_on_site: Quote on Site or Quote on Site (+$35.00 extras)
 * - free_estimate: Free Estimate or Free Estimate (+$35.00 extras)
 */
export function formatDynamicPricingTotal(
  model: PricingModel,
  basePrice: number | null | undefined,
  extrasTotal: number = 0
): {
  hasNumericBase: boolean
  basePrice: number | null
  extrasTotal: number
  total: number
  formattedTotal: string
} {
  const numericBase = basePrice !== null && basePrice !== undefined && !isNaN(Number(basePrice))
    ? Number(basePrice)
    : null

  const extras = Math.max(0, Number(extrasTotal) || 0)

  switch (model) {
    case 'free_estimate':
      return {
        hasNumericBase: false,
        basePrice: 0,
        extrasTotal: extras,
        total: extras,
        formattedTotal: extras > 0 ? `Free Estimate (+$${extras.toFixed(2)} extras)` : 'Free Estimate'
      }

    case 'quote_on_site':
      return {
        hasNumericBase: false,
        basePrice: null,
        extrasTotal: extras,
        total: extras,
        formattedTotal: extras > 0 ? `Quote on Site (+$${extras.toFixed(2)} extras)` : 'Quote on Site'
      }

    case 'diagnostic_fee':
      if (numericBase !== null && numericBase > 0) {
        const finalAmount = numericBase + extras
        return {
          hasNumericBase: true,
          basePrice: numericBase,
          extrasTotal: extras,
          total: finalAmount,
          formattedTotal: extras > 0
            ? `$${finalAmount.toFixed(2)} Diagnostic Fee`
            : `$${numericBase.toFixed(2)} Diagnostic Fee`
        }
      }
      return {
        hasNumericBase: false,
        basePrice: null,
        extrasTotal: extras,
        total: extras,
        formattedTotal: extras > 0 ? `Diagnostic Fee (+$${extras.toFixed(2)} extras)` : 'Diagnostic Fee'
      }

    case 'starting_at':
      if (numericBase !== null && numericBase > 0) {
        const finalAmount = numericBase + extras
        return {
          hasNumericBase: true,
          basePrice: numericBase,
          extrasTotal: extras,
          total: finalAmount,
          formattedTotal: extras > 0
            ? `Starting at $${finalAmount.toFixed(2)}`
            : `Starting at $${numericBase.toFixed(2)}`
        }
      }
      return {
        hasNumericBase: false,
        basePrice: null,
        extrasTotal: extras,
        total: extras,
        formattedTotal: extras > 0 ? `Quote on Site (+$${extras.toFixed(2)} extras)` : 'Quote on Site'
      }

    case 'fixed':
    default:
      if (numericBase !== null && numericBase > 0) {
        const finalAmount = numericBase + extras
        return {
          hasNumericBase: true,
          basePrice: numericBase,
          extrasTotal: extras,
          total: finalAmount,
          formattedTotal: `$${finalAmount.toFixed(2)}`
        }
      }
      return {
        hasNumericBase: false,
        basePrice: null,
        extrasTotal: extras,
        total: extras,
        formattedTotal: extras > 0 ? `Quote on Site (+$${extras.toFixed(2)} extras)` : 'Quote on Site'
      }
  }
}

