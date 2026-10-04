import { isWithinBusinessHours } from '../services/safety-rules.ts'
import type { CallEvaluationResult } from './call-state-machine.ts'

export interface OrganizationTemplates {
  name: string
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
  [key: string]: string | undefined
}

const DEFAULT_OPEN_TEMPLATE =
  'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?'
const DEFAULT_AFTER_HOURS_TEMPLATE =
  'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.'
const DEFAULT_BUSY_TEMPLATE =
  'Hey, this is {business_name}! We are currently on the other line with a client. How can we help you?'

/**
 * Replaces placeholders like {{key}} or {key} with variable values.
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  if (!template) return ''

  let rendered = template
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

  const renderedText = renderTemplate(rawTemplate, {
    business_name: org.name || 'our team',
    caller_name: callerName || 'there',
    callback_number: callbackNumber || ''
  })

  return { templateType, renderedText }
}
