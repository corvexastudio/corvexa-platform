'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRY_LIST, getIndustryPreset } from '@/lib/constants/industries'
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
  Sparkles,
  Zap,
  Phone,
  Shield,
  Layers,
  Repeat,
  Info
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

function formatPhoneNumber(num?: string | null) {
  if (!num) return ''
  const cleaned = num.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return num
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
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [copiedNumber, setCopiedNumber] = useState(false)
  const [copiedVerizon, setCopiedVerizon] = useState(false)
  const [copiedAtt, setCopiedAtt] = useState(false)
  const [copiedTmobile, setCopiedTmobile] = useState(false)
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
    operation_mode: 'solo' as 'solo' | 'multi_crew',
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
          operation_mode: (org.operation_mode as 'solo' | 'multi_crew') || 'solo',
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

  // Save Settings Handler - uses authoritative /api/client/organization PATCH endpoint
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!orgId) return

    setSaving(true)
    setSavedSuccess(false)
    try {
      const res = await fetch('/api/client/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          operation_mode: formData.operation_mode,
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
          reactivation_max_daily: parseInt(String(formData.reactivation_max_daily), 10) || 50
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSavedSuccess(true)
        toast.success('Business settings saved and synchronized.')
        setTimeout(() => setSavedSuccess(false), 3000)
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

  const handleOpenChangePlan = (plan: { id: string; name: string; amount: number; interval?: string }) => {
    setSelectedTargetPlan(plan)
    setChangeNotes('')
    setChangePlanModalOpen(true)
  }

  const handleConfirmPlanChange = async () => {
    if (!selectedTargetPlan) return
    setSubmittingPlanChange(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_change',
          targetPlanId: selectedTargetPlan.id,
          notes: changeNotes.trim() || undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
          return
        }
        toast.success(data.message || 'Plan change processed successfully!')
        setChangePlanModalOpen(false)
        loadBilling()
      } else {
        toast.error(data.error || 'Failed to update plan.')
      }
    } catch {
      toast.error('Network error during plan change.')
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
  const tradePreset = getIndustryPreset(formData.industry)

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6 pb-20">

      {/* TOP MASTER HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Settings &amp; Business Operations
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {tradePreset.name}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage company profile, subscription billing, carrier phone lines, and homeowner payments.
          </p>
        </div>

        {activeTab !== 'billing' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" />
                Saved ✓
              </span>
            )}
            <Button
              onClick={() => handleSave()}
              disabled={saving || !canEdit}
              size="sm"
              className="h-10 sm:h-9 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs gap-1.5 cursor-pointer min-h-[48px] sm:min-h-0"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* THE 4 MASTER CONSOLIDATED SETTINGS TABS (48px Ergonomic Touch Targets) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={cn(
            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
            activeTab === 'profile'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <Building2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="truncate">Business Profile</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('billing')}
          className={cn(
            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
            activeTab === 'billing'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <CreditCard className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">Billing &amp; Plans</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('telephony')}
          className={cn(
            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
            activeTab === 'telephony'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <Smartphone className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="truncate">Phone &amp; Hardware</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('payments')}
          className={cn(
            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
            activeTab === 'payments'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <DollarSign className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate">Payments &amp; Alerts</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BUSINESS PROFILE & BRAND IDENTITY                                   */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Card 1: Company Identity */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Company &amp; Brand Identity
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Visible to customers on quotes, invoices, SMS, and public booking.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Trade Business Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Apex Plumbing & HVAC"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Primary Trade Industry</Label>
                <select
                  aria-label="Primary Trade Industry"
                  value={formData.industry}
                  onChange={e => setFormData(d => ({ ...d, industry: e.target.value }))}
                  className="w-full h-10 sm:h-9 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 px-3 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {INDUSTRY_LIST.map(ind => (
                    <option key={ind.id} value={ind.id}>{ind.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">State Contractor License #</Label>
                <Input
                  value={formData.license_number}
                  onChange={e => setFormData(d => ({ ...d, license_number: e.target.value }))}
                  placeholder="e.g. Master Plumber #MP-49102"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Company Website</Label>
                <Input
                  value={formData.website_url}
                  onChange={e => setFormData(d => ({ ...d, website_url: e.target.value }))}
                  placeholder="https://apexservices.com"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Owner Cell Phone (For Notifications &amp; Forwarding)</Label>
                <Input
                  value={formData.owner_phone}
                  onChange={e => setFormData(d => ({ ...d, owner_phone: e.target.value }))}
                  placeholder="(555) 019-2831"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono tabular-nums"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Operational Timezone</Label>
                <select
                  aria-label="Operational Timezone"
                  value={formData.timezone}
                  onChange={e => setFormData(d => ({ ...d, timezone: e.target.value }))}
                  className="w-full h-10 sm:h-9 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 px-3 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="America/New_York">Eastern Time (US &amp; Canada)</option>
                  <option value="America/Chicago">Central Time (US &amp; Canada)</option>
                  <option value="America/Denver">Mountain Time (US &amp; Canada)</option>
                  <option value="America/Phoenix">Mountain Time - Arizona (No DST)</option>
                  <option value="America/Los_Angeles">Pacific Time (US &amp; Canada)</option>
                  <option value="America/Anchorage">Alaska Time</option>
                  <option value="Pacific/Honolulu">Hawaii Time</option>
                </select>
              </div>

              <div className="md:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Field Operation Scale
                  </Label>
                  <span className="text-[10px] text-zinc-500">
                    Adapts dispatch board &amp; plan recommendations
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(d => ({ ...d, operation_mode: 'solo' }))}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all flex items-start gap-3 cursor-pointer min-h-[48px]',
                      formData.operation_mode === 'solo'
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/40'
                        : 'bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-md mt-0.5 shrink-0',
                      formData.operation_mode === 'solo' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    )}>
                      <Truck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Solo Operator (1 Truck)</span>
                        {formData.operation_mode === 'solo' && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        1 clean route, auto-assigned bookings, zero fleet clutter. Fits 1-2 person single-truck setups.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(d => ({ ...d, operation_mode: 'multi_crew' }))}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all flex items-start gap-3 cursor-pointer min-h-[48px]',
                      formData.operation_mode === 'multi_crew'
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/40'
                        : 'bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-md mt-0.5 shrink-0',
                      formData.operation_mode === 'multi_crew' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    )}>
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Multi-Crew / Fleet (2+ Trucks)</span>
                        {formData.operation_mode === 'multi_crew' && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Multi-truck dispatch swimlanes, driver routing, morning crew SMS broadcast, and fleet roster.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Legal Entity & Tax Compliance */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Legal Entity &amp; 10DLC Tax Compliance
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Required for TCR carrier registration and professional invoice footers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Legal Business Name (IRS)</Label>
                <Input
                  value={formData.legal_business_name}
                  onChange={e => setFormData(d => ({ ...d, legal_business_name: e.target.value }))}
                  placeholder="e.g. Apex Mechanical LLC"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Entity Type</Label>
                <select
                  aria-label="Entity Type"
                  value={formData.business_type}
                  onChange={e => setFormData(d => ({ ...d, business_type: e.target.value }))}
                  className="w-full h-10 sm:h-9 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 px-3 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="llc">Limited Liability Company (LLC)</option>
                  <option value="corporation">Corporation (C-Corp / S-Corp)</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2 min-h-[36px]">
                  <input
                    type="checkbox"
                    id="sole_prop"
                    checked={formData.is_sole_proprietor}
                    onChange={e => setFormData(d => ({ ...d, is_sole_proprietor: e.target.checked }))}
                    className="rounded bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 h-4 w-4 cursor-pointer"
                  />
                  <Label htmlFor="sole_prop" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium">
                    Operating as Sole Proprietor without an EIN (Uses SSN for carrier verification)
                  </Label>
                </div>

                {!formData.is_sole_proprietor && (
                  <div className="max-w-xs">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">EIN (Federal Tax ID)</Label>
                    <Input
                      value={formData.ein}
                      onChange={e => setFormData(d => ({ ...d, ein: e.target.value }))}
                      placeholder="12-3456789"
                      className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono tabular-nums"
                    />
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Physical Business &amp; Dispatch Base Address</Label>
                <Input
                  value={formData.address_street}
                  onChange={e => setFormData(d => ({ ...d, address_street: e.target.value }))}
                  placeholder="Street Address, Suite / Unit"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs mb-2"
                />

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={formData.address_city}
                    onChange={e => setFormData(d => ({ ...d, address_city: e.target.value }))}
                    placeholder="City"
                    className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                  />
                  <Input
                    value={formData.address_state}
                    onChange={e => setFormData(d => ({ ...d, address_state: e.target.value.toUpperCase() }))}
                    placeholder="State (e.g. TX)"
                    maxLength={2}
                    className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs uppercase font-mono"
                  />
                  <Input
                    value={formData.address_postal_code}
                    onChange={e => setFormData(d => ({ ...d, address_postal_code: e.target.value }))}
                    placeholder="Zip Code"
                    className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Display & Appearance */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-600" />
                Interface Theme &amp; Display
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Choose your preferred appearance across desktop and mobile screens.
              </p>
            </div>
            <ThemeSettingsSelector />
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                Settings saved!
              </span>
            )}
            <Button
              type="submit"
              disabled={saving || !canEdit}
              className="h-10 px-5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs min-h-[48px] sm:min-h-0 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              {saving ? 'Saving...' : 'Save Business Settings'}
            </Button>
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUBSCRIPTION & BILLING (CONSOLIDATED ENGINE)                        */}
      {/* ========================================================================= */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {loadingBilling ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading subscription details...</span>
            </div>
          ) : !billingData ? (
            <ErrorState title="Unable to load billing" message="Please retry." onRetry={loadBilling} />
          ) : (
            <>
              {(() => {
                const sub = billingData.subscription
                const activePlanId = (
                  sub?.plan_id || 
                  billingData.organization?.plan_id || 
                  billingData.currentPlan?.id || 
                  'free'
                ).toLowerCase()

                const isPayingActive = 
                  (sub?.status === 'active' || billingData.organization?.subscription_status === 'active') && 
                  activePlanId !== 'free'

                const isCurrentSolo = isPayingActive && (activePlanId === 'solo' || activePlanId === 'solo_yearly' || activePlanId === 'captodesk_standard')
                const isCurrentMultiCrew = isPayingActive && (activePlanId === 'multi_crew' || activePlanId === 'multi_crew_yearly' || activePlanId === 'fleet')
                const isCurrentFree = !isCurrentSolo && !isCurrentMultiCrew

                return (
                  <>
                    {/* Current Active Plan Status Banner */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Current Plan</span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                            {isCurrentMultiCrew ? 'CaptoDesk Multi-Crew' : isCurrentSolo ? 'CaptoDesk Solo' : 'Free Booking Tier'}
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            isPayingActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                          )}>
                            ● {isPayingActive ? 'Active Subscription' : 'Free Forever (Active)'}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {sub?.current_period_end ? (
                            <>Renews on <strong className="text-zinc-900 dark:text-zinc-100">{new Date(sub.current_period_end).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</strong></>
                          ) : isPayingActive ? (
                            'Billed monthly via direct card processing'
                          ) : (
                            'Free forever. No card required. Unlimited public booking link and calendar scheduling.'
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                            ${isCurrentMultiCrew ? (billingCycle === 'yearly' ? '1,990' : '199') : isCurrentSolo ? (billingCycle === 'yearly' ? '990' : '99') : '0'}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400"> / {isCurrentFree ? 'month forever' : (billingCycle === 'yearly' ? 'year' : 'month')}</span>
                        </div>

                        {isPayingActive && (
                          sub?.cancel_at_period_end ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={reactivatingSub}
                              onClick={handleReactivateSubscription}
                              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer"
                            >
                              {reactivatingSub ? 'Reactivating...' : 'Reactivate Plan'}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCancelModalOpen(true)}
                              className="h-9 text-xs border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 cursor-pointer"
                            >
                              Cancel Subscription
                            </Button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Billing Cycle Interval Switcher */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Subscription Plans</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Upgrade as your business grows. Switch to annual billing anytime to get 2 months free.</p>
                      </div>

                      <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setBillingCycle('monthly')}
                          className={cn(
                            'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[44px] sm:min-h-0',
                            billingCycle === 'monthly' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-500'
                          )}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingCycle('yearly')}
                          className={cn(
                            'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px] sm:min-h-0',
                            billingCycle === 'yearly' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-500'
                          )}
                        >
                          <span>Annual</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">2 Mo Free</span>
                        </button>
                      </div>
                    </div>

                    {/* 3-Tier Canonical Plan Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

                      {/* Card 1: Free Booking Tier */}
                      <div className={cn(
                        "rounded-xl border bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between space-y-5 shadow-2xs transition-colors",
                        isCurrentFree
                          ? "border-emerald-500/60 dark:border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10"
                          : "border-zinc-200 dark:border-zinc-800"
                      )}>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              Free Organizer
                            </span>
                            {isCurrentFree && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Current Plan
                              </span>
                            )}
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Free Booking Tier</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                              100% free booking link, unmasked customer leads, visual calendar, and job work orders.
                            </p>
                          </div>

                          <div className="flex items-baseline gap-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                              $0
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                              / month forever
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span>Setup Fee: <strong className="text-zinc-800 dark:text-zinc-200">$0.00 (Free)</strong></span>
                          </div>

                          <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>Unlimited Public Booking Link</strong> (/book/[slug])</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>100% Unmasked</strong> customer contacts</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Visual Calendar &amp; Job scheduling</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Customer Directory &amp; Service Catalog</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Before &amp; After job photos</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Native 1-tap phone SMS sharing (free)</span>
                            </li>
                          </ul>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          {isCurrentFree ? (
                            <Button disabled className="w-full h-10 sm:h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-400 font-semibold text-xs cursor-default">
                              Current Active Plan
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleOpenChangePlan({ id: 'free', name: 'Free Booking Tier', amount: 0, interval: 'month' })}
                              className="w-full h-10 sm:h-9 text-xs font-semibold border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer min-h-[48px] sm:min-h-0"
                            >
                              Downgrade to Free ($0/mo)
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Card 2: Solo Plan ($99/mo or $990/yr) */}
                      <div className={cn(
                        "rounded-xl border bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between space-y-5 shadow-2xs transition-colors",
                        isCurrentSolo
                          ? "border-blue-500/60 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10"
                          : formData.operation_mode === 'solo'
                            ? "border-blue-500/70 dark:border-blue-500/50 ring-2 ring-blue-500/30"
                            : "border-zinc-200 dark:border-zinc-800"
                      )}>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                              Solo Operator
                            </span>
                            {isCurrentSolo ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Current Plan
                              </span>
                            ) : formData.operation_mode === 'solo' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-600 text-white">
                                Recommended for 1 Truck
                              </span>
                            ) : null}
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">CaptoDesk Solo</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                              Built for 1 owner-operator running their service business from their phone.
                            </p>
                          </div>

                          <div className="flex items-baseline gap-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                              ${billingCycle === 'yearly' ? '990' : '99'}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                              / {billingCycle === 'yearly' ? 'year (2 Mo Free)' : 'month'}
                            </span>
                          </div>

                          {/* Waived Setup Fee Callout Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Setup &amp; Carrier Reg: <span className="line-through text-zinc-400 dark:text-zinc-500">$199.00</span> <strong className="text-emerald-600 dark:text-emerald-400 font-bold">$0.00 (Waived!)</strong></span>
                          </div>

                          <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>1 Dedicated Telnyx Line</strong> (10DLC verified)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>3-Second Missed Call</strong> AI Text-Back</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Two-Way SMS &amp; Homeowner Chat Hub</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Mobile Field Portal with GPS routing</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Apple Pay &amp; Digital Invoicing</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Domino&apos;s live technician tracking links</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Automated 5-star Google review booster</span>
                            </li>
                          </ul>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          {isCurrentSolo ? (
                            <Button disabled className="w-full h-10 sm:h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-400 font-semibold text-xs cursor-default">
                              Current Plan
                            </Button>
                          ) : isCurrentMultiCrew ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleOpenChangePlan({ id: billingCycle === 'yearly' ? 'solo_yearly' : 'solo', name: 'CaptoDesk Solo', amount: billingCycle === 'yearly' ? 990 : 99, interval: billingCycle })}
                              className="w-full h-10 sm:h-9 text-xs font-semibold border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer min-h-[48px] sm:min-h-0"
                            >
                              Downgrade to Solo (${billingCycle === 'yearly' ? '990/yr' : '99/mo'})
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              disabled={submittingPlanChange}
                              onClick={() => handleDirectUpgrade(billingCycle === 'yearly' ? 'solo_yearly' : 'solo')}
                              className="w-full h-10 sm:h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] sm:min-h-0"
                            >
                              {submittingPlanChange ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
                              <span>Upgrade to Solo (${billingCycle === 'yearly' ? '$990/yr' : '$99/mo'})</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Card 3: Multi-Crew Plan ($199/mo or $1,990/yr) */}
                      <div className={cn(
                        "rounded-xl border bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between space-y-5 shadow-2xs transition-colors relative",
                        isCurrentMultiCrew
                          ? "border-emerald-500/60 dark:border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10"
                          : formData.operation_mode === 'multi_crew'
                            ? "border-emerald-500/70 dark:border-emerald-500/50 ring-2 ring-emerald-500/30"
                            : "border-zinc-300 dark:border-zinc-700 ring-1 ring-zinc-200 dark:ring-zinc-800"
                      )}>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20">
                              Growing Fleet
                            </span>
                            {isCurrentMultiCrew ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Current Plan
                              </span>
                            ) : formData.operation_mode === 'multi_crew' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600 text-white">
                                Recommended for Fleet
                              </span>
                            ) : null}
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">CaptoDesk Multi-Crew</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                              For growing service businesses with helpers, field crews, and technicians.
                            </p>
                          </div>

                          <div className="flex items-baseline gap-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                              ${billingCycle === 'yearly' ? '1,990' : '199'}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                              / {billingCycle === 'yearly' ? 'year (2 Mo Free)' : 'month'}
                            </span>
                          </div>

                          {/* Waived Setup Fee Callout Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Setup &amp; Carrier Reg: <span className="line-through text-zinc-400 dark:text-zinc-500">$299.00</span> <strong className="text-emerald-600 dark:text-emerald-400 font-bold">$0.00 (Waived!)</strong></span>
                          </div>

                          <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>Up to 5 Crew Vans &amp; Technicians</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>Everything in Solo Plan</strong>, plus:</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Multi-crew live dispatch board &amp; van assignment</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>7 AM morning route SMS broadcasts to techs</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Restricted field portal (zero financial visibility)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Role permissions (Owner, Admin, Dispatch, Tech)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Live GPS Route Tracking &amp; Geofenced ETAs</span>
                            </li>
                          </ul>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          {isCurrentMultiCrew ? (
                            <Button disabled className="w-full h-10 sm:h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-400 font-semibold text-xs cursor-default">
                              Current Plan
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              disabled={submittingPlanChange}
                              onClick={() => handleDirectUpgrade(billingCycle === 'yearly' ? 'multi_crew_yearly' : 'multi_crew')}
                              className="w-full h-10 sm:h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] sm:min-h-0"
                            >
                              {submittingPlanChange ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
                              <span>Upgrade to Multi-Crew (${billingCycle === 'yearly' ? '$1,990/yr' : '$199/mo'})</span>
                            </Button>
                          )}
                        </div>
                      </div>

                    </div>
                  </>
                )
              })()}

              {/* Billing Receipts & History */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Invoices &amp; Receipts</h4>
                  <span className="text-xs text-zinc-400 font-mono">PDF Downloads Available</span>
                </div>

                {billingData.payments && billingData.payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {billingData.payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 font-mono">
                              {new Date(p.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-white">
                              {p.description || 'Monthly Subscription'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white font-mono tabular-nums">
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
                  <p className="text-xs text-zinc-400 py-4 text-center">
                    No past receipts recorded. Invoices will automatically appear after your billing cycle.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PHONE & 10DLC CARRIER HARDWARE                                      */}
      {/* ========================================================================= */}
      {activeTab === 'telephony' && (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Card 1: Dedicated Business Phone Line */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-600" />
                  Dedicated Business Phone Line (Telnyx Gateway)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  High-throughput 10DLC carrier-registered SMS and Voice gateway.
                </p>
              </div>

              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border self-start sm:self-auto",
                formData.carrier_registration_status === 'registered'
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              )}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {formData.carrier_registration_status === 'registered' ? 'A2P 10DLC Verified & Active' : 'Active Telephony Carrier'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Dedicated Number</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={formData.telnyx_phone_number ? formatPhoneNumber(formData.telnyx_phone_number) : 'Provisioning dedicated line...'}
                    className="h-10 sm:h-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono font-semibold"
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
                    className="h-10 sm:h-9 px-3 border-zinc-200 dark:border-zinc-800 text-xs shrink-0 min-h-[44px] sm:min-h-0"
                  >
                    {copiedNumber ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Live Carrier SMS Test</Label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={testingSms || !formData.owner_phone}
                  onClick={handleTestSms}
                  className="h-10 sm:h-9 w-full text-xs border-zinc-200 dark:border-zinc-800 font-medium min-h-[44px] sm:min-h-0"
                >
                  {testingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5 text-blue-600" />}
                  Dispatch Test SMS to {formData.owner_phone || 'Mobile Phone'}
                </Button>
              </div>
            </div>
          </div>

          {/* Card 2: Carrier Call Forwarding Setup */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-600" />
                Cell Carrier Call Forwarding Hardware Cheat Sheet
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Dial these codes from your phone keypad so missed calls automatically route to CaptoDesk text-back.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Verizon */}
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">Verizon Wireless</span>
                <p className="text-[11px] text-zinc-500">Dial on keypad:</p>
                <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-600 flex items-center justify-between">
                  <span>*71{cleanForwardingDigits || 'XXXXXXXXXX'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!cleanForwardingDigits) return
                      navigator.clipboard.writeText(`*71${cleanForwardingDigits}`)
                      setCopiedVerizon(true)
                      toast.success('Verizon forwarding code copied')
                      setTimeout(() => setCopiedVerizon(false), 2000)
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedVerizon ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-zinc-400 block font-mono">Deactivate: *73</span>
              </div>

              {/* AT&T */}
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">AT&amp;T</span>
                <p className="text-[11px] text-zinc-500">Dial on keypad:</p>
                <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-600 flex items-center justify-between">
                  <span>*004*{cleanForwardingDigits || 'XXXXXXXXXX'}#</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!cleanForwardingDigits) return
                      navigator.clipboard.writeText(`*004*${cleanForwardingDigits}#`)
                      setCopiedAtt(true)
                      toast.success('AT&T forwarding code copied')
                      setTimeout(() => setCopiedAtt(false), 2000)
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedAtt ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-zinc-400 block font-mono">Deactivate: ##004#</span>
              </div>

              {/* T-Mobile */}
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">T-Mobile</span>
                <p className="text-[11px] text-zinc-500">Dial on keypad:</p>
                <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-600 flex items-center justify-between">
                  <span>**61*{cleanForwardingDigits || 'XXXXXXXXXX'}#</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!cleanForwardingDigits) return
                      navigator.clipboard.writeText(`**61*${cleanForwardingDigits}#`)
                      setCopiedTmobile(true)
                      toast.success('T-Mobile forwarding code copied')
                      setTimeout(() => setCopiedTmobile(false), 2000)
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedTmobile ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-zinc-400 block font-mono">Deactivate: ##61#</span>
              </div>
            </div>

            {/* P3-003: MVNO Carrier Star-Code Guidance Notice */}
            <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold">Using a discount mobile carrier or MVNO (Mint Mobile, Visible, Cricket, Metro, Google Fi)?</span>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                  Discount mobile virtual network operators (MVNOs) may require carrier-specific forwarding star-codes or manual activation via your carrier&apos;s mobile app or customer support portal. If keypad dialing returns a carrier error, contact your wireless provider to request &quot;Conditional No-Answer Call Forwarding&quot; to your CaptoDesk phone number.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Homeowner GPS Tracking Mode */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600" />
                Live GPS &amp; En-Route Tracking Mode
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Controls what homeowners see on their live dispatch tracking link.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                onClick={() => setFormData(d => ({ ...d, tracking_mode: 'milestone' }))}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all',
                  formData.tracking_mode === 'milestone'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Milestone Status (Recommended)</span>
                  {formData.tracking_mode === 'milestone' && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Shows clear stage progression: Scheduled ➔ En Route (with ETA) ➔ Arrived. Protects technician exact GPS location while on route.
                </p>
              </div>

              <div
                onClick={() => setFormData(d => ({ ...d, tracking_mode: 'geofence' }))}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all',
                  formData.tracking_mode === 'geofence'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Live Geofenced Map</span>
                  {formData.tracking_mode === 'geofence' && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Displays live moving van pin on interactive map once within {formData.tracking_geofence_miles} miles of the homeowner address.
                </p>
              </div>
            </div>
          </div>

          {/* Card 4: Seasonal Customer Reactivation Autopilot */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-amber-600" />
                  Seasonal Customer Reactivation Autopilot
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Automatically texts past customers 60-90 days after service to win repeat tune-ups and inspections.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reactivation_enabled"
                  checked={formData.reactivation_enabled}
                  onChange={e => setFormData(d => ({ ...d, reactivation_enabled: e.target.checked }))}
                  className="rounded bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 h-4 w-4 cursor-pointer"
                />
                <Label htmlFor="reactivation_enabled" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  {formData.reactivation_enabled ? 'Active' : 'Paused'}
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Reactivation Cadence</Label>
                <select
                  aria-label="Reactivation Cadence"
                  value={formData.default_reactivation_interval_days}
                  onChange={e => setFormData(d => ({ ...d, default_reactivation_interval_days: parseInt(e.target.value, 10) }))}
                  className="w-full h-10 sm:h-9 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 px-3 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
                >
                  <option value={60}>60 Days Post-Service (Bi-Monthly)</option>
                  <option value={90}>90 Days Post-Service (Quarterly - Recommended)</option>
                  <option value={180}>180 Days Post-Service (Semi-Annual)</option>
                  <option value={365}>365 Days Post-Service (Annual Tune-Up)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Quiet Hours Enforcement</Label>
                <div className="h-10 sm:h-9 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 flex items-center text-xs text-zinc-600 dark:text-zinc-400">
                  <span>Never sends before 9:00 AM or after 7:30 PM local time</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Reactivation SMS Copy Template</Label>
                <textarea
                  rows={2}
                  value={formData.reactivation_template}
                  onChange={e => setFormData(d => ({ ...d, reactivation_template: e.target.value }))}
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-mono"
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Available tags: &#123;customer_name&#125;, &#123;business_name&#125;, &#123;booking_url&#125;
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                Settings saved!
              </span>
            )}
            <Button
              type="submit"
              disabled={saving || !canEdit}
              className="h-10 px-5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs min-h-[48px] sm:min-h-0 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              {saving ? 'Saving...' : 'Save Telephony Settings'}
            </Button>
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYMENTS & ALERTS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">

          {/* Card 1: Direct Homeowner Payment Links */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Instant Homeowner Payment Options (Zero Processing Fees)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Include direct payment links on invoices (Zelle, Venmo, Cash App, PayPal.me) with zero merchant fees.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">External Payment URL</Label>
                <Input
                  value={formData.external_payment_url}
                  onChange={e => setFormData(d => ({ ...d, external_payment_url: e.target.value }))}
                  placeholder="e.g. https://venmo.com/u/your-handle or https://paypal.me/yourcompany"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Payment Instructions on Invoices</Label>
                <textarea
                  rows={2}
                  value={formData.payment_instructions}
                  onChange={e => setFormData(d => ({ ...d, payment_instructions: e.target.value }))}
                  placeholder="e.g. Zelle payments to billing@apexplumbing.com, or make checks payable to Apex Plumbing LLC."
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-sans"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Stripe Connect Credit Card Processing */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Credit Card Processing (Stripe Connect)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Accept Visa, Mastercard, Amex, Apple Pay, and Google Pay directly online.
                </p>
              </div>

              {stripeStatus?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected &amp; Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  Not Connected
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Standard processing: 2.9% + 30¢ per successful card transaction. Daily rolling bank payouts.
              </div>

              {stripeStatus?.connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={openingDashboard}
                  onClick={handleOpenStripeDashboard}
                  className="h-10 sm:h-9 text-xs border-zinc-200 dark:border-zinc-800 font-medium min-h-[44px] sm:min-h-0"
                >
                  {openingDashboard ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                  Open Stripe Dashboard
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={connectingStripe}
                  onClick={handleConnectStripe}
                  className="h-10 sm:h-9 text-xs bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold min-h-[44px] sm:min-h-0"
                >
                  {connectingStripe ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CreditCard className="h-3.5 w-3.5 mr-1.5" />}
                  Connect Bank with Stripe
                </Button>
              )}
            </div>
          </div>

          {/* Card 3: Push Notifications & Weekly Executive Digest */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                Mobile Alerts &amp; Weekly Performance Digest
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Stay updated on missed calls, new bookings, and weekly revenue metrics.
              </p>
            </div>

            <div className="space-y-4">
              <PushNotificationSettings />

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">Monday Morning Executive Summary SMS</span>
                  <p className="text-[11px] text-zinc-500">
                    Dispatches a weekly report at 8:00 AM every Monday with jobs completed, revenue collected, and calls captured.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingDigest || !formData.owner_phone}
                  onClick={handleTestDigest}
                  className="h-10 sm:h-9 text-xs border-zinc-200 dark:border-zinc-800 font-medium shrink-0 min-h-[44px] sm:min-h-0"
                >
                  {testingDigest ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5 text-blue-600" />}
                  Send Preview SMS
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                Settings saved!
              </span>
            )}
            <Button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !canEdit}
              className="h-10 px-5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs min-h-[48px] sm:min-h-0 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              {saving ? 'Saving...' : 'Save Payment Settings'}
            </Button>
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
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Are you sure you want to schedule cancellation? You will retain access to your dedicated number and dispatch tools through your renewal date.
          </p>

          <div>
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Feedback (Optional)</Label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Tell us what we can improve..."
              className="w-full p-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              className="h-9 text-xs border-zinc-200 dark:border-zinc-800"
            >
              Keep Subscription
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={cancelingSub}
              onClick={handleCancelSubscription}
              className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {cancelingSub ? 'Canceling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* PLAN CHANGE / DOWNGRADE MODAL */}
      <Modal
        open={changePlanModalOpen}
        onOpenChange={setChangePlanModalOpen}
        title={selectedTargetPlan?.amount === 0 ? 'Downgrade to Free Booking Tier' : `Switch to ${selectedTargetPlan?.name || 'Selected Plan'}`}
        description={
          selectedTargetPlan?.amount === 0
            ? 'Your public booking link, calendar schedule, customer CRM, and job history remain 100% active.'
            : 'Review and confirm your plan change.'
        }
        size="sm"
      >
        <div className="space-y-4 py-2">
          {selectedTargetPlan?.amount === 0 ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              Your dedicated 10DLC phone line and automated text-back will be paused at the end of the current billing cycle. You will keep unlimited online customer bookings, calendar scheduling, customer CRM, and job photos with $0 monthly fee forever.
            </div>
          ) : (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              You are switching your plan to <strong>{selectedTargetPlan?.name}</strong> at <strong>${selectedTargetPlan?.amount}/{selectedTargetPlan?.interval || 'month'}</strong>.
            </p>
          )}

          <div>
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">Notes or reason (Optional)</Label>
            <textarea
              rows={2}
              value={changeNotes}
              onChange={e => setChangeNotes(e.target.value)}
              placeholder="Any details for your account change..."
              className="w-full p-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setChangePlanModalOpen(false)}
              className="h-9 text-xs border-zinc-200 dark:border-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingPlanChange}
              onClick={handleConfirmPlanChange}
              className={cn(
                "h-9 text-xs text-white font-medium",
                selectedTargetPlan?.amount === 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {submittingPlanChange ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {selectedTargetPlan?.amount === 0 ? 'Confirm Downgrade to Free' : 'Confirm Plan Change'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
