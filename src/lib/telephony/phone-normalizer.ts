/**
 * CaptoDesk Canonical Phone Number Normalizer & Validator
 * Enforces strict ITU-T E.164 compliance without blind assumptions.
 */

// Canonical E.164 pattern: '+' followed by 7 to 15 digits, first digit non-zero
const E164_REGEX = /^\+[1-9]\d{6,14}$/

export interface PhoneNormalizationResult {
  isValid: boolean
  e164: string | null
  rawInput: string
  error?: string
}

/**
 * Normalizes an arbitrary phone string into canonical E.164 format.
 * Does NOT blindly prepend '+1' to invalid or arbitrary strings.
 */
export function normalizePhoneToE164(input: string | null | undefined): PhoneNormalizationResult {
  const rawInput = (input || '').trim()

  if (!rawInput) {
    return { isValid: false, e164: null, rawInput, error: 'Empty phone number provided' }
  }

  // Reject strings with alphabetic characters (e.g. spam/spoofed strings like 'PRIVATE', 'UNKNOWN')
  if (/[a-zA-Z]/.test(rawInput)) {
    return { isValid: false, e164: null, rawInput, error: 'Phone number contains alphabetic characters' }
  }

  // Check if string already starts with a '+'
  if (rawInput.startsWith('+')) {
    const cleaned = '+' + rawInput.slice(1).replace(/\D/g, '')
    if (E164_REGEX.test(cleaned)) {
      return { isValid: true, e164: cleaned, rawInput }
    }
    return { isValid: false, e164: null, rawInput, error: 'Invalid international E.164 length or format' }
  }

  // Strip all non-digit characters
  const digits = rawInput.replace(/\D/g, '')

  // Standard 10-digit North American Numbering Plan (NANP)
  if (digits.length === 10) {
    // Valid NANP area code cannot start with 0 or 1
    if (digits[0] === '0' || digits[0] === '1') {
      return { isValid: false, e164: null, rawInput, error: 'Invalid US/Canada area code (cannot begin with 0 or 1)' }
    }
    const e164 = `+1${digits}`
    return { isValid: true, e164, rawInput }
  }

  // 11-digit NANP with leading country code 1
  if (digits.length === 11 && digits.startsWith('1')) {
    if (digits[1] === '0' || digits[1] === '1') {
      return { isValid: false, e164: null, rawInput, error: 'Invalid US/Canada area code in 11-digit number' }
    }
    const e164 = `+${digits}`
    return { isValid: true, e164, rawInput }
  }

  // Rejection: short codes, toll-free incomplete, or non-E.164
  return {
    isValid: false,
    e164: null,
    rawInput,
    error: `Cannot normalize number with ${digits.length} digits into E.164 without international prefix (+)`
  }
}

/**
 * Quick boolean validator for canonical E.164 strings
 */
export function isValidE164(phone: string | null | undefined): boolean {
  if (!phone) return false
  return E164_REGEX.test(phone.trim())
}

/**
 * Formats a valid E.164 number into standard US national representation: (XXX) XXX-XXXX
 */
export function formatNationalUs(e164: string): string {
  const norm = normalizePhoneToE164(e164)
  if (!norm.isValid || !norm.e164) return e164
  
  if (norm.e164.startsWith('+1') && norm.e164.length === 12) {
    const area = norm.e164.slice(2, 5)
    const mid = norm.e164.slice(5, 8)
    const last = norm.e164.slice(8, 12)
    return `(${area}) ${mid}-${last}`
  }
  
  return norm.e164
}
