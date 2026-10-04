/**
 * CaptoDesk Deep Credential & PII Redactor
 * Strictly scrubs passwords, API keys, tokens, and payment card details before logging.
 */

const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'card',
  'credit_card',
  'pan',
  'cvv',
  'cvc',
  'ssn',
  'tax_id',
  'service_role_key',
  'access_token',
  'refresh_token',
  'stripe_secret',
  'telnyx_key',
  'session_id',
  'pin'
])

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9_\-\.]+/gi, replacement: 'Bearer [REDACTED]' },
  // Stripe live/test secret keys
  { pattern: /sk_(live|test)_[a-zA-Z0-9]{16,}/gi, replacement: '[REDACTED_STRIPE_SECRET]' },
  // Stripe webhook signing secrets
  { pattern: /whsec_[a-zA-Z0-9]{16,}/gi, replacement: '[REDACTED_STRIPE_WEBHOOK_SECRET]' },
  // Telnyx keys
  { pattern: /KEY[a-zA-Z0-9_\-]{20,}/gi, replacement: '[REDACTED_TELNYX_KEY]' },
  // 13-19 digit Credit card patterns (with optional spaces/dashes)
  { pattern: /\b(?:\d[ -]*?){13,19}\b/g, replacement: '[REDACTED_CARD]' }
]

/**
 * Sanitizes a string value against known credential patterns
 */
export function sanitizeString(val: string): string {
  if (!val || typeof val !== 'string') return val
  let result = val
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/**
 * Recursively deep-redacts sensitive keys, secrets, and customer credentials
 */
export function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item))
  }

  const sanitized: Record<string, any> = {}

  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    
    // Check if key itself matches a sensitive name
    const isSensitiveKey =
      SENSITIVE_KEY_NAMES.has(lowerKey) ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('card_number') ||
      lowerKey.includes('cvv')

    if (isSensitiveKey) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof val === 'string') {
      sanitized[key] = sanitizeString(val)
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = redactSensitiveData(val)
    } else {
      sanitized[key] = val
    }
  }

  return sanitized
}

export const sanitizeObject = redactSensitiveData
