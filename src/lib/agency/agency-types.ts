export type AgencyTier = 'starter_3' | 'growth_10' | 'scale_25' | 'dominance_50'

export interface PartnerAgency {
  id: string
  name: string
  slug: string
  contact_email: string
  contact_phone?: string | null
  total_slots: number
  subscription_tier: AgencyTier
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled'
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
