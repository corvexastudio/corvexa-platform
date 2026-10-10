/**
 * CaptoDesk Canonical SaaS Plan Configuration
 * Server-authoritative plan representations, pricing, and billing intervals.
 */

export interface SaasPlan {
  id: string
  name: string
  description: string
  amount: number // in currency units (e.g. 99.00 USD)
  currency: string
  billingInterval: 'month' | 'year'
  features: string[]
}

export const DEFAULT_SAAS_PLAN_ID = 'captodesk_standard'

export const SAAS_PLANS: Record<string, SaasPlan> = {
  captodesk_standard: {
    id: 'captodesk_standard',
    name: 'CaptoDesk Standard',
    description: 'Complete AI receptionist, missed-call recovery, service booking, and automated field-service platform.',
    amount: 99.00,
    currency: 'USD',
    billingInterval: 'month',
    features: [
      'Dedicated Telnyx business phone number',
      'Instant AI missed-call recovery text-back',
      'Public booking page & service catalog',
      'Automated appointment confirmations & reminders',
      'Lead management & customer intelligence',
      'Quotes, invoicing, and review automation'
    ]
  }
}

/**
 * Resolves a plan by identifier, falling back to default standard plan.
 */
export function getSaasPlan(planId: string = DEFAULT_SAAS_PLAN_ID): SaasPlan {
  const plan = SAAS_PLANS[planId]
  if (!plan) {
    throw new Error(`Unknown SaaS plan identifier: ${planId}`)
  }
  return plan
}

/**
 * Calculates a clean period end date given a start date and number of months.
 * Preserves the exact day of month without timezone drift.
 */
export function calculatePeriodEnd(startDate: Date, intervalMonths: number = 1): Date {
  const end = new Date(startDate.getTime())
  end.setMonth(end.getMonth() + intervalMonths)
  return end
}
