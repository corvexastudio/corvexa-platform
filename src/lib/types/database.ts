export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Organization {
  id: string
  name: string
  slug: string
  owner_phone?: string | null
  telnyx_phone_number?: string | null
  carrier?: string | null
  is_missed_call_active: boolean
  is_review_engine_active: boolean
  auto_reply_template: string
  after_hours_template: string
  business_hours: {
    [day: string]: {
      open: string
      close: string
      closed: boolean
    }
  }
  google_review_url?: string | null
  timezone: string
  cooldown_hours: number
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled'
  monthly_rate: number
  legal_business_name?: string | null
  business_type?: 'llc' | 'corporation' | 'partnership' | 'sole_proprietorship' | 'non_profit' | 'other' | null
  ein?: string | null
  is_sole_proprietor?: boolean
  address_street?: string | null
  address_city?: string | null
  address_state?: string | null
  address_postal_code?: string | null
  website_url?: string | null
  carrier_registration_status?: 'unregistered' | 'pending' | 'in_review' | 'verified' | 'rejected'
  tcr_brand_id?: string | null
  tcr_campaign_id?: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  org_id: string
  full_name?: string | null
  phone?: string | null
  role: 'super_admin' | 'owner' | 'dispatcher'
  created_at: string
}

export interface Contact {
  id: string
  org_id: string
  name?: string | null
  phone: string
  email?: string | null
  address?: string | null
  opt_out: boolean
  tags: string[]
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  org_id: string
  contact_id: string
  source: 'missed_call' | 'web_form' | 'manual' | 'referral'
  status: 'new' | 'contacted' | 'booked' | 'lost'
  urgency: 'low' | 'normal' | 'high' | 'emergency'
  service_needed?: string | null
  estimated_value?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
  contact?: Contact
}

export interface Call {
  id: string
  org_id: string
  contact_id?: string | null
  caller_number: string
  called_number: string
  direction: 'inbound' | 'outbound'
  status: 'missed' | 'answered' | 'busy' | 'failed' | 'rejected'
  duration_seconds: number
  telnyx_call_control_id?: string | null
  auto_reply_sent: boolean
  suppression_reason?: string | null
  created_at: string
  contact?: Contact
}

export interface Conversation {
  id: string
  org_id: string
  contact_id: string
  last_message_at: string
  last_message_preview?: string | null
  unread_count: number
  status: 'open' | 'closed' | 'archived'
  created_at: string
  contact?: Contact
  messages?: Message[]
}

export interface Message {
  id: string
  org_id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'system' | 'owner' | 'customer'
  body: string
  delivery_status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
  telnyx_message_id?: string | null
  created_at: string
}

export interface Appointment {
  id: string
  org_id: string
  contact_id: string
  title: string
  service_type?: string | null
  start_time: string
  end_time?: string | null
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string | null
  created_at: string
  contact?: Contact
}

export interface AutomationSetting {
  id: string
  org_id: string
  module_key: string
  is_enabled: boolean
  config: Record<string, any>
  created_at: string
}

export interface ActivityLog {
  id: string
  org_id: string
  event_type: string
  description: string
  metadata?: Record<string, any>
  created_at: string
}
