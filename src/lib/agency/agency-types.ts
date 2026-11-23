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
    price: 149,
    slots: 3,
    costPerSlot: 49.67,
    description: 'Perfect for boutique agencies testing rapid lead recovery and dispatch on 2 to 3 trade clients.',
    features: [
      '3 Wholesale Client Capacity Slots ($49.67/slot)',
      '$0 Setup Fees (Save $597 retail)',
      'Dedicated 10DLC Local Phone Number per Client',
      'Instant Day-Zero SMS via Verified Toll-Free Bridge',
      'Automated Missed-Call AI & 5-Second Text-Back',
      'Customer Self-Scheduling & Domino\'s Live Tracker',
      'Agency Subdomain (agency.captodesk.com)',
      'Co-Branded "Powered by CaptoDesk" Footer Badge'
    ],
    highlight: false
  },
  growth_10: {
    id: 'growth_10',
    name: 'Growth 10-Pack',
    price: 399,
    slots: 10,
    costPerSlot: 39.9,
    description: 'Our most popular partner tier. Covers full home-service rosters with maximum margin and agency branding.',
    features: [
      '10 Wholesale Client Capacity Slots ($39.90/slot)',
      'All Starter Features Included',
      'Custom Agency Logo & Brand Accent Palette',
      'Free 10DLC Brand & Carrier Registrations Included',
      'Priority Carrier Line Provisioning',
      'Dedicated Partner Support Slack/Email Channel',
      'Monthly Client Revenue & Lead Attribution Reports',
      'Optional CNAME Custom Domain Add-on (+$99/mo)'
    ],
    highlight: true
  },
  scale_25: {
    id: 'scale_25',
    name: 'Scale 25+ Pack',
    price: 899,
    slots: 25,
    costPerSlot: 35.96,
    description: 'For scaling trade marketing agencies. Includes full white-labeling, custom domain, and $35/slot expansion.',
    features: [
      '25 Wholesale Client Capacity Slots ($35.96/slot)',
      'Full White-Label Portal & Zero CaptoDesk Badging',
      'Custom Domain CNAME (portal.agencyname.com)',
      '+$35/mo per additional slot beyond 25',
      'Multi-Crew Fleet Support (Solo = 1 slot, Multi-Van = 2 slots)',
      'All Growth Features Included',
      'Dedicated Technical Account Manager',
      'Unlimited Agency Team Member Logins & Roles'
    ],
    highlight: false
  },
  dominance_50: {
    id: 'dominance_50',
    name: 'Dominance 50-Pack (Legacy)',
    price: 1750,
    slots: 50,
    costPerSlot: 35.0,
    description: 'Enterprise agency wholesale capacity with dedicated IP pool, custom portal branding, and executive support.',
    features: [
      '50 Wholesale Client Capacity Slots ($35.00/slot)',
      'All Scale White-Label Features Included',
      'Dedicated High-Volume Carrier IP Pool',
      'Dedicated Partner Success Manager',
      'Custom White-Label Client Onboarding Flows & Webhooks',
      'Custom SLAs and Enterprise Telephony Routing'
    ],
    highlight: false
  }
}

// 3 Core Flagship Tiers for Public Billing & Scaling
export const AGENCY_TIERS_LIST: AgencyTierConfig[] = [
  AGENCY_TIERS_CONFIG.starter_3,
  AGENCY_TIERS_CONFIG.growth_10,
  AGENCY_TIERS_CONFIG.scale_25
]

export function isValidAgencyTier(tier?: string | null): tier is AgencyTier {
  return Boolean(tier && tier in AGENCY_TIERS_CONFIG)
}

export function getAgencyTierConfig(tier?: string | null): AgencyTierConfig {
  if (tier && tier in AGENCY_TIERS_CONFIG) {
    return AGENCY_TIERS_CONFIG[tier as AgencyTier]
  }
  return AGENCY_TIERS_CONFIG.growth_10
}

export interface AgencyBrandingConfig {
  logoUrl?: string | null
  faviconUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  portalTitle?: string | null
  hidePoweredBy?: boolean
  customDomain?: string | null
  customDomainStatus?: 'pending_dns' | 'verified' | 'failed'
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
  custom_domain?: string | null
  branding?: AgencyBrandingConfig | null
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export type SlotStatus = 'active' | 'pending_setup' | 'available'

export type ContractorLifecycleStatus =
  | 'draft'
  | 'validating'
  | 'slot_reserved'
  | 'contractor_provisioning'
  | 'phone_provisioning_required'
  | 'carrier_registration_pending'
  | 'ready_for_activation'
  | 'active'
  | 'failed'
  | 'offboarding_pending'
  | 'offboarded'
  | 'admin_review_required'

export type SlotAssignmentState =
  | 'reserved'
  | 'active'
  | 'offboarding_pending'
  | 'released'
  | 'admin_review_required'

export interface AgencySlotAllocation {
  id: string
  agency_id: string
  organization_id?: string | null
  slots_consumed: number
  van_count: number
  assignment_state: SlotAssignmentState
  assigned_at: string
  released_at?: string | null
  reason?: string | null
  acting_user_id?: string | null
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
}

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
  van_count?: number
  slots_consumed?: number
  lifecycle_status?: ContractorLifecycleStatus
  number_active?: boolean
  messaging_ready?: boolean
  messaging_route?: 'dedicated' | 'platform_toll_free_bridge'
}

export interface MarketingAttributionData {
  utm_source: string
  utm_medium?: string | null
  utm_campaign: string
  utm_content?: string | null
  utm_term?: string | null
  landing_page?: string | null
  referrer?: string | null
  first_touch_at?: string
}

export interface AgencyCampaignCost {
  id: string
  agency_id: string
  organization_id: string
  campaign_name: string
  utm_source?: string | null
  reporting_period: string
  cost_amount: number
  cost_category: 'ad_spend' | 'agency_retainer' | 'other_marketing'
  currency: string
  entry_source: string
  cost_date: string
  acting_user_id?: string | null
  created_at?: string
}

export interface AttributionReportFilter {
  period?: '30d' | '60d' | '90d' | '12m' | 'all'
  clientId?: string | 'all'
  source?: string | 'all'
  campaign?: string | 'all'
  industry?: string | 'all'
  bookingStatus?: string | 'all'
  paymentStatus?: string | 'all'
}

export interface AttributionReportSummary {
  totalBookings: number
  confirmedAppointments: number
  completedJobs: number
  totalInvoiced: number
  netCollectedRevenue: number
  totalAdSpend?: number | null
  totalRetainers?: number | null
  roas?: number | null
  roi?: number | null
}

export interface AgencyCampaignAttribution {
  utm_source: string
  utm_campaign: string
  utm_medium?: string | null
  client_name: string
  organization_id?: string
  attributed_leads: number
  bookings_count: number
  confirmed_appointments: number
  completed_jobs: number
  invoiced_revenue: number
  collected_revenue: number
  refunded_revenue: number
  net_revenue: number
  ad_spend?: number | null
  agency_retainer?: number | null
  roas?: number | null
  roi?: number | null
  conversion_rate: number
  booking_conversion_rate?: number
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
  capacity_breakdown?: {
    total_licensed_capacity: number
    active_slots_consumed: number
    pending_reserved_slots: number
    available_slots: number
    offboarding_slots: number
    admin_review_slots: number
  }
}

export const SUPPORTED_AGENCY_TRADES = [
  'plumbing',
  'hvac',
  'electrical',
  'roofing',
  'detailing',
  'general'
] as const

export type AgencyTrade = (typeof SUPPORTED_AGENCY_TRADES)[number]

export interface DeployClientRequest {
  businessName: string
  ownerName: string
  ownerCellPhone: string
  industry: AgencyTrade
  clientTier?: 'solo' | 'multi_crew'
  vanCount?: number
  city?: string
  shopPhone?: string
  timezone?: string
  googleReviewUrl?: string
  authorizeDidPurchase?: boolean
}

export interface DeployClientValidationResult {
  isValid: boolean
  validatedData?: DeployClientRequest
  error?: string
  fieldErrors?: Record<string, string>
}

export interface AgencyCheckoutSessionResult {
  success: boolean
  checkoutUrl?: string
  sessionId?: string
  simulated?: boolean
  error?: string
}

export interface OffboardClientRequest {
  organizationId: string
  transitionType?: 'release' | 'retain_phone' | 'transfer'
  releasePhoneNumber?: boolean
  reason?: string
}

export interface OffboardClientResult {
  success: boolean
  organizationId: string
  agencyId: string
  slotsReleased: number
  freedCapacity: {
    totalSlots: number
    usedSlots: number
    availableSlots: number
  }
  telephonyAction: 'released' | 'retained_by_contractor' | 'none'
  historicalRecordsPreserved: {
    appointmentsCount: number
    invoicesCount: number
    jobsCount: number
    messagesCount: number
    isDeleted: false
  }
  pendingAppointmentsCount: number
  unpaidInvoicesCount: number
  offboardedAt: string
  error?: string
}

/**
 * Multi-van fleet capacity calculator (F-AGY-05).
 * - 1 van = 1 wholesale slot
 * - 2 to 5 vans = 2 wholesale slots
 * - 6+ vans = admin review required (no arbitrary invented pricing)
 */
export function calculateRequiredSlotsForFleet(
  vanCount?: number,
  clientTier?: 'solo' | 'multi_crew'
): {
  slotsNeeded: number
  adminReviewRequired: boolean
  vanCount: number
  tier: 'solo' | 'multi_crew'
} {
  const count = typeof vanCount === 'number' && Number.isFinite(vanCount) && vanCount > 0
    ? Math.floor(vanCount)
    : (clientTier === 'multi_crew' ? 2 : 1)

  if (count >= 6) {
    return {
      slotsNeeded: 0,
      adminReviewRequired: true,
      vanCount: count,
      tier: 'multi_crew'
    }
  }

  if (count >= 2) {
    return {
      slotsNeeded: 2,
      adminReviewRequired: false,
      vanCount: count,
      tier: 'multi_crew'
    }
  }

  return {
    slotsNeeded: 1,
    adminReviewRequired: false,
    vanCount: 1,
    tier: 'solo'
  }
}

export interface ContractorEmbedDomain {
  id: string
  org_id: string
  domain: string
  is_verified: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

