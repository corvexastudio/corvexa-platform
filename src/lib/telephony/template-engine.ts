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
  'Hi, this is {business_name}! Sorry we missed your call — our team is currently assisting customers on-site. You can lock in a time on our schedule here: {booking_url} — or reply directly to this text with what you need!'
export const DEFAULT_AFTER_HOURS_TEMPLATE =
  "Thanks for calling {business_name}! Our office is currently closed, but you can reserve an appointment on our schedule anytime here: {booking_url} — or text us what you need and we'll reply first thing in the morning!"
export const DEFAULT_BUSY_TEMPLATE =
  "Hi, this is {business_name}! We're currently on the other line assisting a customer. You can grab a spot on our calendar here: {booking_url} — or reply with what you need and we'll get back to you shortly!"

const LEGACY_DEFAULT_TEMPLATES = [
  'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?',
  'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.',
  'Hey, this is {business_name}! We are currently on the other line with a client. How can we help you?'
]

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

  return rendered.trim()
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://app.corvexastudio.com').replace(/\/$/, '')
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
