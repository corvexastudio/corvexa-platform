/**
 * Customer Input Normalizer & Formatter
 * Formats customer names (Title Case), US phone numbers as-you-type,
 * standardizes addresses, and provides intelligent email host suggestions.
 */

const POPULAR_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'hotmail.com',
  'aol.com'
]

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
])

/**
 * Formats a customer name in Title Case:
 * "john smith" -> "John Smith"
 * "karl marx" -> "Karl Marx"
 * "o'connor" -> "O'Connor"
 * "mcdonald" -> "McDonald"
 * "smith-jones" -> "Smith-Jones"
 */
export function formatCustomerName(rawName: string | null | undefined): string {
  if (!rawName || typeof rawName !== 'string') return ''
  const cleaned = rawName.trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''

  return cleaned
    .split(' ')
    .map(word => {
      if (!word) return ''
      // Hyphenated names (e.g. Smith-Jones)
      if (word.includes('-')) {
        return word.split('-').map(part => formatSingleNamePart(part)).join('-')
      }
      return formatSingleNamePart(word)
    })
    .join(' ')
}

function formatSingleNamePart(part: string): string {
  if (!part) return ''
  const lower = part.toLowerCase()

  // O'Connor, D'Angelo, L'Amour
  if (/^[a-z]'[a-z]/i.test(part)) {
    const segments = part.split("'")
    const prefix = segments[0].toUpperCase()
    const rest = segments[1] ? segments[1].charAt(0).toUpperCase() + segments[1].slice(1).toLowerCase() : ''
    return `${prefix}'${rest}`
  }

  // McDonald, MacIntyre (words starting with Mc followed by at least 2 letters)
  if (/^mc[a-z]{2,}/i.test(part)) {
    return 'Mc' + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase()
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Real-time as-you-type US phone number formatter:
 * "4" -> "(4"
 * "456" -> "(456"
 * "4566" -> "(456) 6"
 * "4566780987" -> "(456) 678-0987"
 * Preserves international prefix if starting with '+' (and not '+1')
 */
export function formatAsYouTypeUsPhone(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return ''
  const trimmed = input.trim()

  // Keep foreign international format intact
  if (trimmed.startsWith('+') && !trimmed.startsWith('+1')) {
    return input
  }

  let digits = input.replace(/\D/g, '')

  // Remove leading 1 if pasted full 11 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1)
  }

  const maxDigits = digits.slice(0, 10)
  if (maxDigits.length === 0) return ''

  if (maxDigits.length < 3) {
    return `(${maxDigits}`
  }
  if (maxDigits.length === 3) {
    return `(${maxDigits}`
  }
  if (maxDigits.length <= 6) {
    return `(${maxDigits.slice(0, 3)}) ${maxDigits.slice(3)}`
  }
  return `(${maxDigits.slice(0, 3)}) ${maxDigits.slice(3, 6)}-${maxDigits.slice(6, 10)}`
}

/**
 * Standardizes customer address casing and common USPS abbreviations
 * while strictly preserving every number, unit, suite, and detail.
 * "68 noth street, austin, tx" -> "68 Noth Street, Austin, TX"
 */
export function formatStandardUsAddress(rawAddress: string | null | undefined): string {
  if (!rawAddress || typeof rawAddress !== 'string') return ''
  const trimmed = rawAddress.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''

  // Split by commas to format components (street, city, state zip) cleanly
  const parts = trimmed.split(',')
  const formattedParts = parts.map(part => {
    const tokens = part.trim().split(/\s+/)
    const formattedTokens = tokens.map(token => {
      const upper = token.toUpperCase()
      // State code (e.g. TX, CA, NY)
      if (token.length === 2 && US_STATE_CODES.has(upper)) {
        return upper
      }
      // US Zip code (12345 or 12345-6789)
      if (/^\d{5}(-\d{4})?$/.test(token)) {
        return token
      }
      // Alphanumeric unit designations (e.g. 4B, 12A, 3F)
      if (/^\d+[a-z]$/i.test(token)) {
        return token.toUpperCase()
      }
      // Street type abbreviations
      const streetAbbr: Record<string, string> = {
        st: 'St',
        street: 'Street',
        ave: 'Ave',
        avenue: 'Avenue',
        rd: 'Rd',
        road: 'Road',
        dr: 'Dr',
        drive: 'Drive',
        ln: 'Ln',
        lane: 'Lane',
        blvd: 'Blvd',
        boulevard: 'Boulevard',
        ct: 'Ct',
        court: 'Court',
        cir: 'Circle',
        circle: 'Circle',
        way: 'Way',
        pl: 'Place',
        place: 'Place',
        pkwy: 'Pkwy',
        parkway: 'Parkway',
        hwy: 'Hwy',
        highway: 'Highway',
        apt: 'Apt',
        ste: 'Ste',
        suite: 'Suite',
        unit: 'Unit',
        bldg: 'Bldg',
        building: 'Building',
        fl: 'Fl',
        floor: 'Floor'
      }
      const lower = token.toLowerCase().replace(/[.,]$/, '')
      if (streetAbbr[lower]) {
        return streetAbbr[lower]
      }
      // Directionals: N, S, E, W, NE, NW, SE, SW
      if (/^(n|s|e|w|ne|nw|se|sw)$/i.test(token)) {
        return upper
      }
      // Default Title Case
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
    })
    return formattedTokens.join(' ')
  })

  return formattedParts.join(', ')
}

/**
 * Returns matching email domain suggestions when the user has typed '@'.
 * If the user has not typed '@' or has already finished typing a full domain (with a dot),
 * returns an empty array.
 */
export function getEmailDomainSuggestions(input: string): string[] {
  if (!input || typeof input !== 'string') return []
  const atIndex = input.lastIndexOf('@')
  if (atIndex === -1) return []

  const domainPart = input.slice(atIndex + 1).toLowerCase()

  // If the user already typed a domain with a dot (e.g. "gmail.com"), hide suggestions
  if (domainPart.includes('.') && domainPart.length > 3) {
    return []
  }

  // Filter popular domains
  if (!domainPart) {
    return POPULAR_EMAIL_DOMAINS
  }

  return POPULAR_EMAIL_DOMAINS.filter(d => d.startsWith(domainPart))
}
