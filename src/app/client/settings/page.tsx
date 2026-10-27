'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRY_LIST } from '@/lib/constants/industries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { 
  Building2, 
  CreditCard, 
  Smartphone, 
  DollarSign, 
  PhoneCall, 
  Copy, 
  CheckCircle2, 
  ShieldCheck, 
  Send, 
  Save, 
  Loader2, 
  Check, 
  ExternalLink, 
  Palette, 
  Bell, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle,
  Truck,
  Users,
  Radio,
  FileText,
  MapPin,
  HelpCircle,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PushNotificationSettings } from '@/components/notifications/push-notification-settings'
import { ThemeSettingsSelector } from '@/components/theme-toggle'

export type SettingsTab = 'profile' | 'billing' | 'telephony' | 'payments'

interface BillingData {
  organization: {
    id: string
    name: string
    slug: string
    subscription_status: string
    plan_id?: string | null
    monthly_rate: number
    telnyx_phone_number?: string | null
    carrier_registration_status?: string | null
    legal_business_name?: string | null
    ein?: string | null
    is_sole_proprietor?: boolean | null
    address_street?: string | null
  }
  subscription: {
    id: string
    org_id: string
    plan_id: string
    status: string
    billing_interval: string
    amount: number
    currency: string
    current_period_start: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean
    canceled_at: string | null
    provider: string
  } | null
  currentPlan: {
    id: string
    name: string
    description: string
    amount: number
    currency: string
    billingInterval: string
    maxUsers: number
    tier: string
    features: string[]
  }
  availablePlans: any[]
  payments: any[]
  canManageBilling: boolean
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab State with query param mapping (maps legacy tabs 'subscription', 'display', 'retention', 'notifications' cleanly)
  const initialTab = useMemo<SettingsTab>(() => {
    const rawTab = searchParams.get('tab')
    if (rawTab === 'billing' || rawTab === 'subscription') return 'billing'
    if (rawTab === 'telephony' || rawTab === 'retention') return 'telephony'
    if (rawTab === 'payments' || rawTab === 'notifications') return 'payments'
    return 'profile'
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  const handleTabChange = (newTab: SettingsTab) => {
    setActiveTab(newTab)
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('tab', newTab)
    window.history.replaceState({}, '', currentUrl.toString())
  }

  // Base State
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('member')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copiedNumber, setCopiedNumber] = useState(false)
  const [copiedCarrier, setCopiedCarrier] = useState<string | null>(null)
  const [testingSms, setTestingSms] = useState(false)
  const [testingDigest, setTestingDigest] = useState(false)

  // Billing State
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false)
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<any | null>(null)
  const [changeNotes, setChangeNotes] = useState('')
  const [submittingPlanChange, setSubmittingPlanChange] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelingSub, setCancelingSub] = useState(false)
  const [reactivatingSub, setReactivatingSub] = useState(false)

  // Stripe Connect State
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean
    accountId?: string | null
    status: string
    chargesEnabled: boolean
    payoutsEnabled: boolean
  } | null>(null)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [openingDashboard, setOpeningDashboard] = useState(false)

  // Master Organization Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    owner_phone: '',
    telnyx_phone_number: '',
    carrier: 'Verizon',
    timezone: 'America/Chicago',
    google_review_url: '',
    legal_business_name: '',
    business_type: 'llc',
    ein: '',
    is_sole_proprietor: false,
    address_street: '',
    address_city: '',
    address_state: '',
    address_postal_code: '',
    website_url: '',
    industry: 'general',
    license_number: '',
    carrier_registration_status: 'unregistered',
    tcr_brand_id: '',
    tcr_campaign_id: '',
    weekly_digest_enabled: true,
    weekly_digest_day_of_week: 1,
    weekly_digest_hour: 8,
    external_payment_url: '',
    payment_instructions: '',
    tracking_mode: 'milestone',
    tracking_geofence_miles: 5,
    reactivation_enabled: true,
    default_reactivation_interval_days: 90,
    reactivation_cooldown_days: 30,
    reactivation_template: "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
    reactivation_quiet_hours: true,
    reactivation_max_daily: 50
  })

  // Load Base Settings
  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        setError('Authentication required to view settings.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileErr || !profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }
      setOrgId(profile.org_id)
      setUserRole(profile.role || 'member')

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single()

      if (orgErr) {
        setError('Failed to retrieve organization settings.')
      } else if (org) {
        setFormData({
          name: org.name || '',
          slug: org.slug || '',
          owner_phone: org.owner_phone || '',
          telnyx_phone_number: org.telnyx_phone_number || '',
          carrier: org.carrier || 'Verizon',
          timezone: org.timezone || 'America/Chicago',
          google_review_url: org.google_review_url || '',
          legal_business_name: org.legal_business_name || '',
          business_type: org.business_type || 'llc',
          ein: org.ein || '',
          is_sole_proprietor: org.is_sole_proprietor ?? false,
          address_street: org.address_street || '',
          address_city: org.address_city || '',
          address_state: org.address_state || '',
          address_postal_code: org.address_postal_code || '',
          website_url: org.website_url || '',
          industry: org.industry || 'general',
          license_number: org.license_number || '',
          carrier_registration_status: org.carrier_registration_status || 'unregistered',
          tcr_brand_id: org.tcr_brand_id || '',
          tcr_campaign_id: org.tcr_campaign_id || '',
          weekly_digest_enabled: org.weekly_digest_enabled ?? true,
          weekly_digest_day_of_week: org.weekly_digest_day_of_week ?? 1,
          weekly_digest_hour: org.weekly_digest_hour ?? 8,
          external_payment_url: org.external_payment_url || '',
          payment_instructions: org.payment_instructions || '',
          tracking_mode: org.tracking_mode || 'milestone',
          tracking_geofence_miles: org.tracking_geofence_miles || 5,
          reactivation_enabled: org.reactivation_enabled ?? true,
          default_reactivation_interval_days: org.default_reactivation_interval_days || 90,
          reactivation_cooldown_days: org.reactivation_cooldown_days || 30,
          reactivation_template: org.reactivation_template || "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
          reactivation_quiet_hours: org.reactivation_quiet_hours ?? true,
          reactivation_max_daily: org.reactivation_max_daily || 50
        })
      }
    } catch {
      setError('An unexpected error occurred while loading settings.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Load Billing Data
  const loadBilling = useCallback(async () => {
    setLoadingBilling(true)
    try {
      const res = await fetch('/api/client/billing')
      if (res.ok) {
        const data = await res.json()
        setBillingData(data)
        if (data.subscription?.billing_interval === 'year' || data.subscription?.plan_id?.includes('yearly')) {
          setBillingCycle('yearly')
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingBilling(false)
    }
  }, [])

  // Load Stripe Connect Status
  const loadStripeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/client/payments/connect')
      if (res.ok) {
        const data = await res.json()
        setStripeStatus(data)
      }
    } catch {
      // Non-fatal
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (activeTab === 'billing') {
      loadBilling()
    }
    if (activeTab === 'payments') {
      loadStripeStatus()
    }
  }, [activeTab, loadBilling, loadStripeStatus])

  // Save Settings Handler
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!orgId) return

    setSaving(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          owner_phone: formData.owner_phone,
          carrier: formData.carrier,
          timezone: formData.timezone,
          google_review_url: formData.google_review_url,
          legal_business_name: formData.legal_business_name,
          business_type: formData.business_type,
          ein: formData.is_sole_proprietor ? null : formData.ein,
          is_sole_proprietor: formData.is_sole_proprietor,
          address_street: formData.address_street,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_postal_code: formData.address_postal_code,
          website_url: formData.website_url,
          industry: formData.industry,
          license_number: formData.license_number,
          tracking_mode: formData.tracking_mode,
          tracking_geofence_miles: formData.tracking_geofence_miles,
          weekly_digest_enabled: formData.weekly_digest_enabled,
          weekly_digest_day_of_week: formData.weekly_digest_day_of_week,
          weekly_digest_hour: formData.weekly_digest_hour,
          external_payment_url: formData.external_payment_url,
          payment_instructions: formData.payment_instructions,
          reactivation_enabled: formData.reactivation_enabled,
          default_reactivation_interval_days: parseInt(String(formData.default_reactivation_interval_days), 10) || 90,
          reactivation_cooldown_days: parseInt(String(formData.reactivation_cooldown_days), 10) || 30,
          reactivation_template: formData.reactivation_template,
          reactivation_quiet_hours: formData.reactivation_quiet_hours,
          reactivation_max_daily: parseInt(String(formData.reactivation_max_daily), 10) || 50,
          submit_carrier_verification: true
        })
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('Settings saved and synchronized.')
      } else {
        toast.error(data.error || 'Failed to save settings.')
      }
    } catch {
      toast.error('Network error saving settings.')
    } finally {
      setSaving(false)
    }
  }

  // Plan Management Handlers
  const handleDirectUpgrade = async (targetPlanId: string) => {
    setSubmittingPlanChange(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade_plan',
          targetPlanId
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
          return
        }
        toast.success(data.message || 'Plan upgraded successfully!')
        loadBilling()
      } else {
        toast.error(data.error || 'Failed to update plan.')
      }
    } catch {
      toast.error('Network error upgrading plan.')
    } finally {
      setSubmittingPlanChange(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelingSub(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_subscription',
          reason: cancelReason.trim() || undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Subscription scheduled for cancellation at end of period.')
        setCancelModalOpen(false)
        loadBilling()
      } else {
        toast.error(data.error || 'Failed to cancel subscription.')
      }
    } catch {
      toast.error('Network error canceling subscription.')
    } finally {
      setCancelingSub(false)
    }
  }

  const handleReactivateSubscription = async () => {
    setReactivatingSub(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate_subscription' })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Subscription reactivated!')
        loadBilling()
      } else {
        toast.error(data.error || 'Failed to reactivate subscription.')
      }
    } catch {
      toast.error('Network error reactivating subscription.')
    } finally {
      setReactivatingSub(false)
    }
  }

  // Telephony Test SMS
  const handleTestSms = async () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile phone number in Business Profile first.')
      return
    }
    setTestingSms(true)
    try {
      const res = await fetch('/api/telnyx/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.owner_phone })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Test text dispatched to ${formData.owner_phone}`)
      } else {
        toast.error(data.error || 'Test SMS failed.')
      }
    } catch {
      toast.error('Network error sending test text.')
    } finally {
      setTestingSms(false)
    }
  }

  // Weekly Digest Preview
  const handleTestDigest = async () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile number first to receive the digest preview.')
      return
    }
    setTestingDigest(true)
    try {
      const res = await fetch('/api/client/weekly-digest/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.owner_phone })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Weekly executive preview sent to ${formData.owner_phone}`)
      } else {
        toast.error(data.error || 'Failed to send digest test.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setTestingDigest(false)
    }
  }

  // Stripe Connect Redirects
  const handleConnectStripe = async () => {
    setConnectingStripe(true)
    try {
      const res = await fetch('/api/client/payments/connect', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Failed to initiate Stripe onboarding.')
      }
    } catch {
      toast.error('Network error connecting Stripe.')
    } finally {
      setConnectingStripe(false)
    }
  }

  const handleOpenStripeDashboard = async () => {
    setOpeningDashboard(true)
    try {
      const res = await fetch('/api/client/payments/connect/dashboard', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.open(data.url, '_blank')
      } else {
        toast.error(data.error || 'Failed to generate Stripe dashboard link.')
      }
    } catch {
      toast.error('Network error opening Stripe dashboard.')
    } finally {
      setOpeningDashboard(false)
    }
  }

  const canEdit = userRole === 'owner' || userRole === 'client_admin' || userRole === 'super_admin'

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <ErrorState title="Settings Error" message={error} onRetry={loadSettings} />
      </div>
    )
  }

  const cleanForwardingDigits = (formData.telnyx_phone_number || '').replace(/\D/g, '')

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">

      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Settings & Operations
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage company profile, subscription billing, carrier phone lines, and homeowner payments.
          </p>
        </div>

        {activeTab !== 'billing' && (
          <Button
            onClick={() => handleSave()}
            disabled={saving || !canEdit}
            size="sm"
            className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {/* THE 4 MASTER CONSOLIDATED SETTINGS TABS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'profile'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Business Profile</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('billing')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'billing'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Billing & Plans</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('telephony')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'telephony'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Phone & Routing</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('payments')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'payments'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <DollarSign className="h-3.5 w-3.5" />
          <span>Payments & Alerts</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BUSINESS PROFILE & BRAND                                            */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Card 1: Company Identity */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Company & Brand Identity</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Visible to customers on quotes, invoices, SMS, and public booking.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Trade Business Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Apex Plumbing & HVAC"
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Primary Trade Industry</Label>
                <select
                  aria-label="Primary Trade Industry"
                  value={formData.industry}
                  onChange={e => setFormData(d => ({ ...d, industry: e.target.value }))}
                  className="w-full h-8.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {INDUSTRY_LIST.map(ind => (
                    <option key={ind.id} value={ind.id}>{ind.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">State Contractor License #</Label>
                <Input
                  value={formData.license_number}
                  onChange={e => setFormData(d => ({ ...d, license_number: e.target.value }))}
                  placeholder="e.g. Master Plumber #MP-49102"
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Company Website</Label>
                <Input
                  value={formData.website_url}
                  onChange={e => setFormData(d => ({ ...d, website_url: e.target.value }))}
                  placeholder="https://apexservices.com"
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Owner Cell Phone (For Notifications)</Label>
                <Input
                  value={formData.owner_phone}
                  onChange={e => setFormData(d => ({ ...d, owner_phone: e.target.value }))}
                  placeholder="(555) 019-2831"
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs tabular-nums"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Operational Timezone</Label>
                <select
                  aria-label="Operational Timezone"
                  value={formData.timezone}
                  onChange={e => setFormData(d => ({ ...d, timezone: e.target.value }))}
                  className="w-full h-8.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Phoenix">Mountain Time - Arizona (No DST)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="America/Anchorage">Alaska Time</option>
                  <option value="Pacific/Honolulu">Hawaii Time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Legal Entity & Tax Compliance */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Legal Entity & 10DLC Tax Compliance</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Required for TCR carrier registration and professional invoice footers.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Legal Business Name (IRS)</Label>
                <Input
                  value={formData.legal_business_name}
                  onChange={e => setFormData(d => ({ ...d, legal_business_name: e.target.value }))}
                  placeholder="e.g. Apex Mechanical LLC"
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Entity Type</Label>
                <select
                  aria-label="Entity Type"
                  value={formData.business_type}
                  onChange={e => setFormData(d => ({ ...d, business_type: e.target.value }))}
                  className="w-full h-8.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="llc">Limited Liability Company (LLC)</option>
                  <option value="corporation">Corporation (C-Corp / S-Corp)</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="sole_prop"
                    checked={formData.is_sole_proprietor}
                    onChange={e => setFormData(d => ({ ...d, is_sole_proprietor: e.target.checked }))}
                    className="rounded bg-white dark:bg-zinc-950 border-slate-300 dark:border-zinc-800 text-blue-600 h-3.5 w-3.5"
                  />
                  <Label htmlFor="sole_prop" className="text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                    Operating as Sole Proprietor without an EIN (Uses SSN for carrier verification)
                  </Label>
                </div>

                {!formData.is_sole_proprietor && (
                  <div className="max-w-xs">
                    <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">EIN (Federal Tax ID)</Label>
                    <Input
                      value={formData.ein}
                      onChange={e => setFormData(d => ({ ...d, ein: e.target.value }))}
                      placeholder="12-3456789"
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs tabular-nums"
                    />
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Physical Business Address</Label>
                <Input
                  value={formData.address_street}
                  onChange={e => setFormData(d => ({ ...d, address_street: e.target.value }))}
                  placeholder="Street Address, Suite / Unit"
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs mb-2"
                />

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={formData.address_city}
                    onChange={e => setFormData(d => ({ ...d, address_city: e.target.value }))}
                    placeholder="City"
                    className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs"
                  />
                  <Input
                    value={formData.address_state}
                    onChange={e => setFormData(d => ({ ...d, address_state: e.target.value.toUpperCase() }))}
                    placeholder="State (e.g. TX)"
                    maxLength={2}
                    className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs uppercase"
                  />
                  <Input
                    value={formData.address_postal_code}
                    onChange={e => setFormData(d => ({ ...d, address_postal_code: e.target.value }))}
                    placeholder="Zip Code"
                    className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Display & Appearance */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-zinc-800 mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Interface Theme & Display</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Choose your preferred appearance across desktop and mobile.</p>
            </div>
            <ThemeSettingsSelector />
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUBSCRIPTION & BILLING (CONSOLIDATED ENGINE)                        */}
      {/* ========================================================================= */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {loadingBilling ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading subscription details...</span>
            </div>
          ) : !billingData ? (
            <ErrorState title="Unable to load billing" message="Please retry." onRetry={loadBilling} />
          ) : (
            <>
              {/* Current Active Plan Status Banner */}
              <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Current Plan</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                      {billingData.currentPlan?.name || 'Solo Pro'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ● Active
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    {billingData.subscription?.current_period_end ? (
                      <>Renews on <strong className="text-slate-900 dark:text-zinc-100">{new Date(billingData.subscription.current_period_end).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</strong></>
                    ) : (
                      'Billed monthly via direct card processing'
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                      ${billingData.currentPlan?.amount || 79}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400"> / month</span>
                  </div>

                  {billingData.subscription?.cancel_at_period_end ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={reactivatingSub}
                      onClick={handleReactivateSubscription}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      {reactivatingSub ? 'Reactivating...' : 'Reactivate Plan'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelModalOpen(true)}
                      className="h-8 text-xs border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-rose-600"
                    >
                      Manage
                    </Button>
                  )}
                </div>
              </div>

              {/* Billing Cycle Interval Switcher */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Available Plans</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Switch tiers or save 20% with annual billing.</p>
                </div>

                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                      billingCycle === 'monthly' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1',
                      billingCycle === 'yearly' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                    )}
                  >
                    <span>Annual</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">Save 20%</span>
                  </button>
                </div>
              </div>

              {/* Plan Comparison Cards (Solid Cards, Zero AI Glows) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Card 1: Solo Pro */}
                <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Solo Pro</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Engineered for owner-operators in a single service truck.</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                      ${billingCycle === 'yearly' ? '63' : '79'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">/ month</span>
                    {billingCycle === 'yearly' && (
                      <span className="text-[11px] text-slate-400 font-mono ml-1.5">(billed $758/year)</span>
                    )}
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 dark:text-zinc-300 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>1 Dedicated 10DLC Verified Business Line</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>3-Second Missed Call Instant Text-Back</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Two-Way SMS & Homeowner Chat Hub</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Estimates, Invoices & Mobile Field Portal</span>
                    </li>
                  </ul>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={submittingPlanChange}
                    onClick={() => handleDirectUpgrade(billingCycle === 'yearly' ? 'solo_yearly' : 'solo')}
                    className="w-full h-8.5 text-xs font-semibold border-slate-200 dark:border-zinc-800"
                  >
                    Select Solo Pro
                  </Button>
                </div>

                {/* Card 2: Team & Fleet Pro */}
                <div className="rounded-xl border border-blue-500/70 dark:border-blue-900 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs relative">
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Team & Fleet Pro</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">For growing shops with multiple vans, helpers, or dispatchers.</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                      ${billingCycle === 'yearly' ? '119' : '149'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">/ month</span>
                    {billingCycle === 'yearly' && (
                      <span className="text-[11px] text-slate-400 font-mono ml-1.5">(billed $1,428/year)</span>
                    )}
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 dark:text-zinc-300 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Everything in Solo Pro</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Unlimited Technicians, Dispatchers & Vans</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Multi-Crew Dispatch Swimlanes & Reassignment</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Live GPS Route Tracking & Geofenced ETAs</span>
                    </li>
                  </ul>

                  <Button
                    type="button"
                    disabled={submittingPlanChange}
                    onClick={() => handleDirectUpgrade(billingCycle === 'yearly' ? 'multi_crew_yearly' : 'multi_crew')}
                    className="w-full h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
                  >
                    Upgrade to Fleet Pro
                  </Button>
                </div>

              </div>

              {/* Billing Receipts & History */}
              <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Invoices & Receipts</h4>
                  <span className="text-xs text-slate-400 font-mono">PDF Downloads Available</span>
                </div>

                {billingData.payments && billingData.payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {billingData.payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                              {new Date(p.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                              {p.description || 'Monthly Subscription'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white tabular-nums">
                              ${p.amount}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                                <Check className="h-3 w-3" /> Paid
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No past receipts recorded. Invoices will automatically appear after your billing cycle.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PHONE & 10DLC CARRIER ROUTING                                       */}
      {/* ========================================================================= */}
      {activeTab === 'telephony' && (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Card 1: Dedicated Business Phone Line */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Dedicated Business Phone Line</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">High-throughput 10DLC carrier-registered SMS and Voice gateway.</p>
              </div>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
                <ShieldCheck className="h-3.5 w-3.5" />
                A2P 10DLC Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Dedicated Number</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={formData.telnyx_phone_number || 'Provisioning dedicated line...'}
                    className="h-8.5 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs font-mono font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!formData.telnyx_phone_number) return
                      navigator.clipboard.writeText(formData.telnyx_phone_number)
                      setCopiedNumber(true)
                      toast.success('Phone number copied')
                      setTimeout(() => setCopiedNumber(false), 2000)
                    }}
                    className="h-8.5 px-3 border-slate-200 dark:border-zinc-800 text-xs shrink-0"
                  >
                    {copiedNumber ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Live Carrier SMS Test</Label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={testingSms || !formData.owner_phone}
                  onClick={handleTestSms}
                  className="h-8.5 w-full text-xs border-slate-200 dark:border-zinc-800 font-medium"
                >
                  {testingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1 text-slate-500" />}
                  Dispatch Test SMS to {formData.owner_phone || 'Mobile'}
                </Button>
              </div>
            </div>
          </div>

          {/* Card 2: Carrier Call Forwarding Setup */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Cell Carrier Call Forwarding Cheat Sheet</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Dial these codes from your phone keypad so missed calls automatically route to CaptoDesk text-back.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Verizon */}
              <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 block">Verizon Wireless</span>
                <p className="text-[11px] text-slate-500">Dial on keypad:</p>
                <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-600 flex items-center justify-between">
                  <span>*71{cleanForwardingDigits}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`*71${cleanForwardingDigits}`)
                      toast.success('Verizon code copied')
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">Deactivate: *73</span>
              </div>

              {/* AT&T */}
              <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 block">AT&T</span>
                <p className="text-[11px] text-slate-500">Dial on keypad:</p>
                <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-600 flex items-center justify-between">
                  <span>*004*{cleanForwardingDigits}#</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`*004*${cleanForwardingDigits}#`)
                      toast.success('AT&T code copied')
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">Deactivate: ##004#</span>
              </div>

              {/* T-Mobile */}
              <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 block">T-Mobile</span>
                <p className="text-[11px] text-slate-500">Dial on keypad:</p>
                <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-600 flex items-center justify-between">
                  <span>**61*{cleanForwardingDigits}#</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`**61*${cleanForwardingDigits}#`)
                      toast.success('T-Mobile code copied')
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">Deactivate: ##61#</span>
              </div>
            </div>
          </div>

          {/* Card 3: Homeowner GPS Tracking Mode */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Live GPS & En-Route Tracking Mode</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Controls what homeowners see on their live dispatch tracking link.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setFormData(d => ({ ...d, tracking_mode: 'milestone' }))}
                className={cn(
                  'p-3.5 rounded-xl border cursor-pointer transition-all',
                  formData.tracking_mode === 'milestone' ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20' : 'border-slate-200 dark:border-zinc-800'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Milestone Status (Recommended)</span>
                  {formData.tracking_mode === 'milestone' && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Shows clear stage progression: Scheduled ➔ En Route (with ETA) ➔ Arrived. Protects technician exact GPS location while on route.
                </p>
              </div>

              <div
                onClick={() => setFormData(d => ({ ...d, tracking_mode: 'geofence' }))}
                className={cn(
                  'p-3.5 rounded-xl border cursor-pointer transition-all',
                  formData.tracking_mode === 'geofence' ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20' : 'border-slate-200 dark:border-zinc-800'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Live Geofenced Map</span>
                  {formData.tracking_mode === 'geofence' && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Displays live moving van pin on interactive map once within {formData.tracking_geofence_miles} miles of the homeowner address.
                </p>
              </div>
            </div>
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYMENTS & ALERTS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">

          {/* Card 1: Direct Homeowner Payment Links */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Instant Homeowner Payment Options</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Include direct payment links on invoices (Zelle, Venmo, Cash App, PayPal.me) with zero merchant fees.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">External Payment URL</Label>
                <Input
                  value={formData.external_payment_url}
                  onChange={e => setFormData(d => ({ ...d, external_payment_url: e.target.value }))}
                  placeholder="e.g. https://venmo.com/u/your-handle or https://paypal.me/yourcompany"
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Payment Instructions on Invoices</Label>
                <textarea
                  rows={2}
                  value={formData.payment_instructions}
                  onChange={e => setFormData(d => ({ ...d, payment_instructions: e.target.value }))}
                  placeholder="e.g. Zelle payments to billing@apexplumbing.com, or make checks payable to Apex Plumbing LLC."
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-sans"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Stripe Connect Credit Card Processing */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Credit Card Processing (Stripe Connect)</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Accept Visa, Mastercard, Amex, Apple Pay, and Google Pay directly online.</p>
              </div>

              {stripeStatus?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected & Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  Not Connected
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-600 dark:text-zinc-400">
                Standard processing: 2.9% + 30¢ per successful card transaction. Daily rolling bank payouts.
              </div>

              {stripeStatus?.connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={openingDashboard}
                  onClick={handleOpenStripeDashboard}
                  className="h-8.5 text-xs border-slate-200 dark:border-zinc-800 font-medium"
                >
                  {openingDashboard ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
                  Open Stripe Dashboard
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={connectingStripe}
                  onClick={handleConnectStripe}
                  className="h-8.5 text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                >
                  {connectingStripe ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
                  Connect Bank with Stripe
                </Button>
              )}
            </div>
          </div>

          {/* Card 3: Push Notifications & Weekly Executive Digest */}
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Mobile Alerts & Weekly Performance Digest</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Stay updated on missed calls, new bookings, and weekly revenue metrics.</p>
            </div>

            <div className="space-y-4">
              <PushNotificationSettings />

              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 dark:text-zinc-100">Monday Morning Executive Summary SMS</span>
                  <p className="text-[11px] text-slate-500">
                    Dispatches a weekly report at 8:00 AM every Monday with jobs completed, revenue collected, and calls captured.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingDigest || !formData.owner_phone}
                  onClick={handleTestDigest}
                  className="h-8 text-xs border-slate-200 dark:border-zinc-800 font-medium shrink-0"
                >
                  {testingDigest ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1 text-slate-500" />}
                  Send Preview SMS
                </Button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* PLAN CANCEL MODAL */}
      <Modal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Subscription"
        description="Your plan will remain fully active until the end of the current billing cycle."
        size="sm"
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Are you sure you want to schedule cancellation? You will retain access to your dedicated number and dispatch tools through your renewal date.
          </p>

          <div>
            <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 block">Feedback (Optional)</Label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Tell us what we can improve..."
              className="w-full p-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              className="h-8 text-xs border-slate-200 dark:border-zinc-800"
            >
              Keep Subscription
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={cancelingSub}
              onClick={handleCancelSubscription}
              className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium"
            >
              {cancelingSub ? 'Canceling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
