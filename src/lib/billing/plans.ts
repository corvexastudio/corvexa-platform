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
  setupFee: number // one-time setup and carrier registration fee (e.g. 199.00 USD)
  maxUsers: number
  tier: 'solo' | 'multi_crew'
  features: string[]
}

export const DEFAULT_SAAS_PLAN_ID = 'captodesk_standard'
export const DEFAULT_SETUP_FEE = 199.00

export const SAAS_PLANS: Record<string, SaasPlan> = {
  solo: {
    id: 'solo',
    name: 'CaptoDesk Solo',
    description: 'Built for solo owner-operators. Complete missed-call AI, mobile field portal, booking, and on-site payments.',
    amount: 99.00,
    currency: 'USD',
    billingInterval: 'month',
    setupFee: 199.00,
    maxUsers: 1,
    tier: 'solo',
    features: [
      '1 Owner-Operator user included',
      'Dedicated Telnyx business phone number (10DLC verified)',
      'Instant 8-second AI missed-call recovery text-back',
      'Public booking page & customer self-scheduling',
      'Mobile Field Portal (GPS navigation & job photos)',
      '1-tap mobile card & Apple Pay invoicing (0.5% flat)',
      'Live Domino\'s tracking links (/t/[token])',
      'Automated 5-star Google review booster & shield'
    ]
  },
  solo_yearly: {
    id: 'solo_yearly',
    name: 'CaptoDesk Solo (Yearly)',
    description: 'Solo Owner-Operator plan billed annually (Pay for 10 months, get 2 months FREE).',
    amount: 990.00, // 10 months * $99
    currency: 'USD',
    billingInterval: 'year',
    setupFee: 199.00,
    maxUsers: 1,
    tier: 'solo',
    features: [
      '2 Months FREE (Save $198/year)',
      '1 Owner-Operator user included',
      'Dedicated Telnyx business phone number (10DLC verified)',
      'Instant 8-second AI missed-call recovery text-back',
      'Public booking page & customer self-scheduling',
      'Mobile Field Portal (GPS navigation & job photos)',
      '1-tap mobile card & Apple Pay invoicing (0.5% flat)',
      'Live Domino\'s tracking links (/t/[token])',
      'Automated 5-star Google review booster & shield'
    ]
  },
  multi_crew: {
    id: 'multi_crew',
    name: 'CaptoDesk Multi-Crew',
    description: 'Built for growing service companies with helpers, crews, and field technicians.',
    amount: 199.00,
    currency: 'USD',
    billingInterval: 'month',
    setupFee: 199.00,
    maxUsers: 5,
    tier: 'multi_crew',
    features: [
      'Up to 5 Crew Members & Technicians included',
      'Everything in Solo, plus:',
      'Multi-crew live dispatch board & team schedule',
      'Restricted field portal for technicians (zero financial visibility)',
      'Role-based permissions (Owner, Admin, Dispatcher, Field Tech)',
      'Dynamic job assignment by crew or vehicle',
      'Priority carrier message routing',
      'Dedicated white-glove onboarding & setup call'
    ]
  },
  multi_crew_yearly: {
    id: 'multi_crew_yearly',
    name: 'CaptoDesk Multi-Crew (Yearly)',
    description: 'Multi-Crew Fleet plan billed annually (Pay for 10 months, get 2 months FREE).',
    amount: 1990.00, // 10 months * $199
    currency: 'USD',
    billingInterval: 'year',
    setupFee: 199.00,
    maxUsers: 5,
    tier: 'multi_crew',
    features: [
      '2 Months FREE (Save $398/year)',
      'Up to 5 Crew Members & Technicians included',
      'Everything in Solo, plus:',
      'Multi-crew live dispatch board & team schedule',
      'Restricted field portal for technicians (zero financial visibility)',
      'Role-based permissions (Owner, Admin, Dispatcher, Field Tech)',
      'Dynamic job assignment by crew or vehicle',
      'Priority carrier message routing',
      'Dedicated white-glove onboarding & setup call'
    ]
  },
  // Canonical default and backwards compatibility alias
  captodesk_standard: {
    id: 'captodesk_standard',
    name: 'CaptoDesk Standard',
    description: 'Complete AI receptionist, missed-call recovery, service booking, and automated field-service platform.',
    amount: 99.00,
    currency: 'USD',
    billingInterval: 'month',
    setupFee: 199.00,
    maxUsers: 1,
    tier: 'solo',
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

export const SAAS_PLAN_LIST: SaasPlan[] = [
  SAAS_PLANS.solo,
  SAAS_PLANS.solo_yearly,
  SAAS_PLANS.multi_crew,
  SAAS_PLANS.multi_crew_yearly
]

/**
 * Resolves a plan by identifier, falling back to default standard/solo plan.
 */
export function getSaasPlan(planId: string = DEFAULT_SAAS_PLAN_ID): SaasPlan {
  if (planId === 'solo' || planId === 'captodesk_solo') {
    return SAAS_PLANS.solo
  }
  if (planId === 'solo_yearly' || planId === 'captodesk_solo_yearly') {
    return SAAS_PLANS.solo_yearly
  }
  if (planId === 'multi_crew' || planId === 'captodesk_multi_crew' || planId === 'fleet') {
    return SAAS_PLANS.multi_crew
  }
  if (planId === 'multi_crew_yearly' || planId === 'captodesk_multi_crew_yearly') {
    return SAAS_PLANS.multi_crew_yearly
  }
  const plan = SAAS_PLANS[planId]
  if (!plan) {
    return SAAS_PLANS.captodesk_standard
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
