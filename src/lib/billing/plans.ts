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
  tier: 'free' | 'solo' | 'multi_crew' | 'fleet'
  features: string[]
}

export const DEFAULT_SAAS_PLAN_ID = 'captodesk_standard'
export const DEFAULT_SETUP_FEE = 199.00
export const DEMO_TOLL_FREE_NUMBER = '+18777713802'
export const DEMO_ORG_ID = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7'

export const SAAS_PLANS: Record<string, SaasPlan> = {
  free: {
    id: 'free',
    name: 'CaptoDesk Free',
    description: 'Free Online Booking & Field Organizer. Unlimited customer bookings, scheduling & customer management.',
    amount: 0,
    currency: 'USD',
    billingInterval: 'month',
    setupFee: 0,
    maxUsers: 1,
    tier: 'free',
    features: [
      'Unlimited public web bookings (/book/[slug])',
      'Full unmasked customer contact info',
      'Calendar & Job scheduling',
      'Customer CRM & Service catalog',
      'Before & After job photos',
      'Browser web push & in-app alerts',
      'Native 1-tap phone SMS sharing (free)'
    ]
  },
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
  SAAS_PLANS.free,
  SAAS_PLANS.solo,
  SAAS_PLANS.solo_yearly,
  SAAS_PLANS.multi_crew,
  SAAS_PLANS.multi_crew_yearly
]

/**
 * Resolves a plan by identifier, falling back to default plan.
 */
export function getSaasPlan(planId: string = DEFAULT_SAAS_PLAN_ID): SaasPlan {
  const normalized = (planId || '').toLowerCase()
  if (normalized === 'free' || normalized === 'trial_free' || normalized === 'standard_free') {
    return SAAS_PLANS.free
  }
  if (normalized === 'solo' || normalized === 'captodesk_solo') {
    return SAAS_PLANS.solo
  }
  if (normalized === 'solo_yearly' || normalized === 'captodesk_solo_yearly') {
    return SAAS_PLANS.solo_yearly
  }
  if (normalized === 'multi_crew' || normalized === 'captodesk_multi_crew' || normalized === 'fleet' || normalized === 'fleet_monthly') {
    return SAAS_PLANS.multi_crew
  }
  if (normalized === 'multi_crew_yearly' || normalized === 'captodesk_multi_crew_yearly' || normalized === 'fleet_yearly') {
    return SAAS_PLANS.multi_crew_yearly
  }
  const plan = SAAS_PLANS[planId]
  if (!plan) {
    return SAAS_PLANS.captodesk_standard
  }
  return plan
}

/**
 * Checks whether an organization is entitled to Pro outbound telecom automation
 * (missed-call recovery text-back, automated SMS confirmations, 24h SMS reminders, en route ETA SMS, review SMS).
 * Returns false on the free tier ($0/mo) and expired/inactive accounts.
 */
export function isProAutomationEntitled(org: {
  subscription_status?: string | null
  plan_id?: string | null
} | null | undefined): boolean {
  if (!org) return false
  const planId = (org.plan_id || '').toLowerCase()
  if (planId === 'free' || planId === 'trial_free' || planId === 'standard_free') {
    return false
  }
  const status = (org.subscription_status ?? 'active').toLowerCase()
  if (status === 'free' || status === 'canceled' || status === 'expired' || status === 'past_due') {
    return false
  }
  return status === 'active' || status === 'trial'
}

/**
 * Demo Toll-Free Number Isolation Guard
 * The platform demo TFN (+18777713802) must NEVER be used to send real customer SMS for client orgs.
 * It is strictly isolated to the Demo tenant (org.slug === 'demo' or DEMO_ORG_ID).
 */
export function isTollFreeNumberRestricted(
  senderPhone: string,
  org: { id?: string | null; slug?: string | null } | null | undefined
): boolean {
  if (!senderPhone) return false
  const cleanSender = senderPhone.replace(/\D/g, '')
  const cleanTfn = DEMO_TOLL_FREE_NUMBER.replace(/\D/g, '')
  if (cleanSender === cleanTfn || cleanSender === '8777713802') {
    if (!org) return true
    const isDemo = org.id === DEMO_ORG_ID || (typeof org.slug === 'string' && org.slug.toLowerCase().includes('demo'))
    return !isDemo
  }
  return false
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
