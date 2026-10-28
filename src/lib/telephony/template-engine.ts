import { isWithinBusinessHours } from '../services/safety-rules.ts'
import type { CallEvaluationResult } from './call-state-machine.ts'

export interface OrganizationTemplates {
  name: string
  slug?: string | null
  booking_url?: string | null
  auto_reply_template?: string | null
  after_hours_template?: string | null
  busy_template?: string | null
  business_hours?: Record<string, { open: string; close: string; closed: boolean }>
  timezone?: string
}

export interface TemplateVariables {
  business_name?: string
  caller_name?: string
  callback_number?: string
  booking_url?: string
  booking_link?: string
  [key: string]: string | undefined
}

export const DEFAULT_OPEN_TEMPLATE =
  'Hi, this is {business_name}! Sorry we missed your call - our team is currently assisting customers on-site. You can lock in a time on our schedule here: {booking_url} - or reply directly to this text with what you need!'
export const DEFAULT_AFTER_HOURS_TEMPLATE =
  "Thanks for calling {business_name}! Our office is currently closed, but you can reserve an appointment on our schedule anytime here: {booking_url} - or text us what you need and we'll reply first thing in the morning!"
export const DEFAULT_BUSY_TEMPLATE =
  "Hi, this is {business_name}! We're currently on the other line assisting a customer. You can grab a spot on our calendar here: {booking_url} - or reply with what you need and we'll get back to you shortly!"

const LEGACY_DEFAULT_TEMPLATES = [
  'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?',
  'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.',
  'Hey, this is {business_name}! We are currently on the other line with a client. How can we help you?'
]

const GSM_BASIC_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM_EXTENDED_CHARS = "\f^{}\\[~]|€"
const GSM_ALL_SET = new Set((GSM_BASIC_CHARS + GSM_EXTENDED_CHARS).split(''))

/**
 * Checks whether all characters in text belong to the GSM 03.38 standard (basic or extended).
 */
export function isGsm7(text: string): boolean {
  if (typeof text !== 'string') return false
  for (let i = 0; i < text.length; i++) {
    if (!GSM_ALL_SET.has(text[i])) {
      return false
    }
  }
  return true
}

/**
 * Normalizes common non-GSM typographic characters (smart quotes, em-dashes, ellipses, non-breaking spaces)
 * into their GSM-7 compliant ASCII equivalents without breaking URLs or placeholders.
 */
export function normalizeToGsm7(text: string): string {
  if (!text) return ''
  return text
    // Dashes: em-dash, en-dash, horizontal bar to standard hyphen
    .replace(/\s*[\u2014\u2015]\s*/g, ' - ')
    .replace(/\s*[\u2012\u2013]\s*/g, ' - ')
    // Smart single quotes / apostrophes / backticks
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035`]/g, "'")
    // Smart double quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Bullet points
    .replace(/[\u2022\u25E6\u2219]/g, '*')
    // Whitespace variants (non-breaking spaces, zero-width)
    .replace(/[\u00A0\u2002-\u200A\u202F\u205F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    // Collapse any multiple consecutive spaces
    .replace(/ {2,}/g, ' ')
}

/**
 * Replaces placeholders like {{key}} or {key} with variable values.
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  if (!template) return ''

  let rendered = template

  // If booking_url is not present or empty, clean up the booking link clause cleanly
  const hasBookingUrl = Boolean(variables.booking_url || variables.booking_link)
  if (!hasBookingUrl) {
    rendered = rendered
      .replace(/(?:You can (?:pick a time|lock in a time|reserve an appointment|grab a spot|book an appointment) [^.:!?]*here:\s*(?:\{\{booking_url\}\}|\{booking_url\}|\{\{booking_link\}\}|\{booking_link\})\s*(?:—|-)?\s*(?:or\s*)?)/gi, '')
      .replace(/here:\s*(?:\{\{booking_url\}\}|\{booking_url\}|\{\{booking_link\}\}|\{booking_link\})\s*(?:—|-)?\s*(?:or\s*)?/gi, '')
  }

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      // Support double curly braces {{key}}
      rendered = rendered.split(`{{${key}}}`).join(value)
      // Support single curly braces {key}
      rendered = rendered.split(`{${key}}`).join(value)
    }
  }

  // Remove any remaining unresolved double or single variable tags
  rendered = rendered.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '').replace(/\{[a-zA-Z0-9_]+\}/g, '')

  return normalizeToGsm7(rendered.trim())
}

/**
 * Resolves the appropriate template based on business hours and call outcome (busy vs missed).
 */
export function resolveMissedCallTemplate(
  org: OrganizationTemplates,
  outcome: CallEvaluationResult,
  callerName?: string,
  callbackNumber?: string
): { templateType: 'business_hours' | 'after_hours' | 'busy'; renderedText: string } {
  const isOpen = isWithinBusinessHours(org.business_hours, org.timezone || 'America/Chicago')
  
  let rawTemplate: string
  let templateType: 'business_hours' | 'after_hours' | 'busy'

  if (outcome.state === 'busy' && org.busy_template) {
    rawTemplate = org.busy_template || DEFAULT_BUSY_TEMPLATE
    templateType = 'busy'
  } else if (isOpen) {
    rawTemplate = org.auto_reply_template || DEFAULT_OPEN_TEMPLATE
    templateType = 'business_hours'
  } else {
    rawTemplate = org.after_hours_template || DEFAULT_AFTER_HOURS_TEMPLATE
    templateType = 'after_hours'
  }

  // Automatically upgrade legacy low-converting templates
  if (templateType === 'business_hours' && rawTemplate === LEGACY_DEFAULT_TEMPLATES[0]) {
    rawTemplate = DEFAULT_OPEN_TEMPLATE
  } else if (templateType === 'after_hours' && rawTemplate === LEGACY_DEFAULT_TEMPLATES[1]) {
    rawTemplate = DEFAULT_AFTER_HOURS_TEMPLATE
  } else if (templateType === 'busy' && rawTemplate === LEGACY_DEFAULT_TEMPLATES[2]) {
    rawTemplate = DEFAULT_BUSY_TEMPLATE
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://captodesk.com').replace(/\/$/, '')
  const bookingUrl = org.booking_url || (org.slug ? `${appUrl}/book/${org.slug}` : '')

  const renderedText = renderTemplate(rawTemplate, {
    business_name: org.name || 'our team',
    caller_name: callerName || 'there',
    callback_number: callbackNumber || '',
    booking_url: bookingUrl,
    booking_link: bookingUrl
  })

  return { templateType, renderedText }
}
