/**
 * Domain Validation, Normalization, and Content Security Policy Helpers
 * Remediates F-AGY-11: Secure framing policy and contractor domain allowlist.
 */

export interface DomainValidationResult {
  isValid: boolean
  normalized?: string
  error?: string
}

/**
 * Validates and normalizes an input domain string for website embed authorization.
 * Strips protocol, port, paths, and trailing slashes. Enforces valid RFC 1123 hostname syntax.
 */
export function validateAndNormalizeDomain(input: any): DomainValidationResult {
  if (typeof input !== 'string') {
    return { isValid: false, error: 'Domain must be a text string' }
  }

  let cleaned = input.trim().toLowerCase()
  if (!cleaned) {
    return { isValid: false, error: 'Domain cannot be empty' }
  }

  // Reject explicit unsafe protocols or scripts
  if (
    cleaned.startsWith('javascript:') ||
    cleaned.startsWith('data:') ||
    cleaned.startsWith('vbscript:') ||
    cleaned.includes('<') ||
    cleaned.includes('>')
  ) {
    return { isValid: false, error: 'Unsafe scheme or character detected' }
  }

  // Strip leading http:// or https:// if provided
  cleaned = cleaned.replace(/^https?:\/\//, '')

  // Reject path fragments or query parameters
  if (cleaned.includes('/') || cleaned.includes('?') || cleaned.includes('#')) {
    cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0].trim()
  }

  // Strip standard ports :80, :443, or port specs
  if (cleaned.includes(':')) {
    cleaned = cleaned.split(':')[0].trim()
  }

  // Strip leading and trailing dots
  cleaned = cleaned.replace(/^\.+|\.+$/g, '')

  // Reject wildcards to prevent indiscriminate framing vulnerabilities
  if (cleaned.includes('*')) {
    return { isValid: false, error: 'Wildcard domains are not permitted for security reasons' }
  }

  // Validate length
  if (cleaned.length < 3 || cleaned.length > 253) {
    return { isValid: false, error: 'Domain must be between 3 and 253 characters' }
  }

  // Validate RFC 1123 hostname structure
  const labels = cleaned.split('.')
  if (labels.length < 2 && cleaned !== 'localhost') {
    return { isValid: false, error: 'Domain must include a valid top-level domain (e.g. example.com)' }
  }

  const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
  for (const label of labels) {
    if (!label) {
      return { isValid: false, error: 'Domain contains empty label or consecutive dots' }
    }
    if (!labelRegex.test(label)) {
      return { isValid: false, error: `Invalid domain label: "${label}". Must contain only letters, numbers, and hyphens.` }
    }
  }

  return { isValid: true, normalized: cleaned }
}

/**
 * Checks whether an incoming origin or referer matches an approved domain list.
 * Prevents subdomain confusion by strictly comparing normalized hostnames.
 */
export function isOriginAllowedForFraming(
  originOrUrl: string | null | undefined,
  approvedDomains: string[]
): boolean {
  if (!originOrUrl || typeof originOrUrl !== 'string') return false
  if (!Array.isArray(approvedDomains) || approvedDomains.length === 0) return false

  let incomingHost = originOrUrl.trim().toLowerCase()
  try {
    if (incomingHost.includes('://')) {
      incomingHost = new URL(incomingHost).host.toLowerCase()
    } else {
      incomingHost = incomingHost.split('/')[0].split(':')[0]
    }
  } catch {
    return false
  }

  // Strip port if present
  if (incomingHost.includes(':')) {
    incomingHost = incomingHost.split(':')[0]
  }

  for (const approved of approvedDomains) {
    const normApproved = approved.trim().toLowerCase()
    // Exact match
    if (incomingHost === normApproved) {
      return true
    }
    // Also support www. prefix match if root was approved
    if (incomingHost === `www.${normApproved}` || `www.${incomingHost}` === normApproved) {
      return true
    }
  }

  return false
}

/**
 * Builds a route-specific Content-Security-Policy header with frame-ancestors.
 * If no approved domains are configured, defaults to 'self' to prevent unauthorized framing.
 */
export function buildFrameAncestorsCsp(approvedDomains: string[]): string {
  if (!Array.isArray(approvedDomains) || approvedDomains.length === 0) {
    return "frame-ancestors 'self';"
  }

  const origins: string[] = ["'self'"]
  for (const d of approvedDomains) {
    const val = validateAndNormalizeDomain(d)
    if (val.isValid && val.normalized) {
      origins.push(`https://${val.normalized}`)
      // Include www variant for convenience and safety
      if (!val.normalized.startsWith('www.') && val.normalized.includes('.')) {
        origins.push(`https://www.${val.normalized}`)
      }
    }
  }

  const uniqueOrigins = Array.from(new Set(origins))
  return `frame-ancestors ${uniqueOrigins.join(' ')};`
}
