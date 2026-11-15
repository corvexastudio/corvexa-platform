export type AgencyTier = 'starter_3' | 'growth_10' | 'scale_25' | 'dominance_50'

export interface AgencyTierConfig {
  id: AgencyTier
  name: string
  price: number
  slots: number
  costPerSlot: number
  description: string
  features: string[]
  highlight?: boolean
}

export const AGENCY_TIERS_CONFIG: Record<AgencyTier, AgencyTierConfig> = {
  starter_3: {
    id: 'starter_3',
    name: 'Starter 3-Pack',
    price: 129,
    slots: 3,
    costPerSlot: 43.0,
    description: 'Perfect for boutique agencies testing rapid lead recovery on 2 to 3 trade clients.',
    features: [
      '1 Slot = 1 Solo Contractor (1 Van)',
      'Multi-Van (2–5 Vans) Consumes 2 Slots',
      'Dedicated 10DLC Local Phone Numbers',
      'Automated Missed-Call Text-Back',
      'Campaign Lead & Revenue Attribution'
    ],
    highlight: false
  },
  growth_10: {
    id: 'growth_10',
    name: 'Growth 10-Pack',
    price: 349,
    slots: 10,
    costPerSlot: 34.9,
    description: 'Our most popular partner tier. Covers full home service rosters with maximum margin.',
    features: [
      'Up to 10 Active Contractor Clients',
      'All Starter Features Included',
      'Free 10DLC Brand & Carrier Setups',
      'Priority Carrier Line Provisioning',
      'Dedicated Partner Support Channel',
      'Monthly Client Performance Reports'
    ],
    highlight: true
  },
  scale_25: {
    id: 'scale_25',
    name: 'Scale 25-Pack',
    price: 699,
    slots: 25,
    costPerSlot: 27.96,
    description: 'For scaling trade marketing firms managing multi-metro HVAC and plumbing clients.',
    features: [
      'Up to 25 Active Contractor Clients',
      'All Growth Features Included',
      'Custom Agency Domain Mapping',
      'Quarterly Account Strategy Reviews',
      'Dedicated Technical Account Manager',
      'Multi-Team Member Agency Logins'
    ],
    highlight: false
  },
  dominance_50: {
    id: 'dominance_50',
    name: 'Dominance 50-Pack',
    price: 1199,
    slots: 50,
    costPerSlot: 23.98,
    description: 'Enterprise agency wholesale capacity with dedicated IP pool, custom portal branding, and executive support.',
    features: [
      'Up to 50 Active Contractor Clients',
      'All Scale Features Included',
      'Custom White-Label Portal & CNAME',
      'Dedicated High-Volume Carrier IP Pool',
      'Dedicated Partner Success Manager',
      'Unlimited Agency Team Logins & Permissions'
    ],
    highlight: false
  }
}

export const AGENCY_TIERS_LIST: AgencyTierConfig[] = Object.values(AGENCY_TIERS_CONFIG)

export function isValidAgencyTier(tier?: string | null): tier is AgencyTier {
  return Boolean(tier && tier in AGENCY_TIERS_CONFIG)
}

export function getAgencyTierConfig(tier?: string | null): AgencyTierConfig {
  if (tier && tier in AGENCY_TIERS_CONFIG) {
    return AGENCY_TIERS_CONFIG[tier as AgencyTier]
  }
  return AGENCY_TIERS_CONFIG.growth_10
}

export interface PartnerAgency {
  id: string
  name: string
  slug: string
  contact_email: string
  contact_phone?: string | null
  total_slots: number
  subscription_tier: AgencyTier | 'none' | null
  subscription_status: 'pending_subscription' | 'trial' | 'active' | 'past_due' | 'canceled'
  primary_owner_id?: string | null
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export type SlotStatus = 'active' | 'pending_setup' | 'available'

export interface AgencyClientSlot {
  slot_number: number
  organization_id?: string | null
  business_name: string
  slug?: string | null
  industry?: string | null
  phone?: string | null
  owner_name?: string | null
  owner_phone?: string | null
  is_missed_call_active: boolean
  carrier_registration_status: 'unregistered' | 'pending' | 'in_review' | 'verified' | 'rejected'
  status: SlotStatus
  month_jobs_count: number
  month_invoiced_revenue: number
  month_missed_calls_recovered: number
  public_booking_url?: string | null
  claim_url?: string | null
  created_at?: string | null
}

export interface AgencyCampaignAttribution {
  utm_source: string
  utm_campaign: string
  utm_medium?: string
  client_name: string
  bookings_count: number
  invoiced_revenue: number
  conversion_rate: number
}

export interface AgencyPortfolioOverview {
  agency: PartnerAgency
  total_slots: number
  used_slots: number
  available_slots: number
  occupancy_rate: number
  total_30d_inbound_calls: number
  total_30d_missed_calls_recovered: number
  total_30d_booked_jobs: number
  total_30d_invoiced_revenue: number
  estimated_client_retainer_roi: number
  slots: AgencyClientSlot[]
  top_lead_sources: {
    source: string
    bookings_count: number
    revenue: number
  }[]
}
