'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRY_LIST } from '@/lib/constants/industries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { toast } from 'sonner'
import { 
  Settings as SettingsIcon, 
  PhoneCall, 
  Copy, 
  CheckCircle2, 
  ShieldCheck, 
  Send, 
  Save, 
  Smartphone,
  Loader2,
  Check,
  CreditCard,
  ExternalLink,
  Palette,
  Building2,
  Bell,
  BarChart3,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PushNotificationSettings } from '@/components/notifications/push-notification-settings'
import { ThemeSettingsSelector } from '@/components/theme-toggle'

export default function SettingsPage() {
  const supabase = createClient()
  const [settingsTab, setSettingsTab] = useState<'profile' | 'display' | 'telephony' | 'retention' | 'payments' | 'notifications'>('profile')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab && ['profile', 'display', 'telephony', 'retention', 'payments', 'notifications'].includes(tab)) {
        setSettingsTab(tab as any)
      }
    }
  }, [])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedCarrier, setCopiedCarrier] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testingSms, setTestingSms] = useState(false)
  const [testingDigest, setTestingDigest] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('member')

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

  const [formData, setFormData] = useState({
    name: '',
    owner_phone: '',
    telnyx_phone_number: '',
    carrier: 'Verizon',
    timezone: 'America/Chicago',
    google_review_url: '',
    reactivation_enabled: true,
    default_reactivation_interval_days: 90,
    reactivation_cooldown_days: 30,
    reactivation_template: "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
    reactivation_quiet_hours: true,
    reactivation_max_daily: 50,
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
    carrier_registration_status: 'unregistered',
    tcr_brand_id: '',
    tcr_campaign_id: '',
    weekly_digest_enabled: true,
    weekly_digest_day_of_week: 1,
    weekly_digest_hour: 8,
    external_payment_url: '',
    payment_instructions: ''
  })

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
          owner_phone: org.owner_phone || '',
          telnyx_phone_number: org.telnyx_phone_number || '',
          carrier: org.carrier || 'Verizon',
          timezone: org.timezone || 'America/Chicago',
          google_review_url: org.google_review_url || '',
          reactivation_enabled: org.reactivation_enabled ?? true,
          default_reactivation_interval_days: org.default_reactivation_interval_days ?? 90,
          reactivation_cooldown_days: org.reactivation_cooldown_days ?? 30,
          reactivation_template: org.reactivation_template || "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
          reactivation_quiet_hours: org.reactivation_quiet_hours ?? true,
          reactivation_max_daily: org.reactivation_max_daily ?? 50,
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
          carrier_registration_status: org.carrier_registration_status || 'unregistered',
          tcr_brand_id: org.tcr_brand_id || '',
          tcr_campaign_id: org.tcr_campaign_id || '',
          weekly_digest_enabled: org.weekly_digest_enabled ?? true,
          weekly_digest_day_of_week: org.weekly_digest_day_of_week ?? 1,
          weekly_digest_hour: org.weekly_digest_hour ?? 8,
          external_payment_url: org.external_payment_url || '',
          payment_instructions: org.payment_instructions || ''
        })
      }
    } catch {
      setError('An unexpected error occurred while loading settings.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const loadStripeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/client/payments/connect')
      if (res.ok) {
        const json = await res.json()
        setStripeStatus(json)
      }
    } catch {
      // quiet fail
    }
  }, [])

  useEffect(() => { 
    loadSettings()
    loadStripeStatus()
  }, [loadSettings, loadStripeStatus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('connect') === 'success' || params.get('connect') === 'simulated_success') {
        toast.success('Stripe Connect onboarding completed! Payments and direct deposits are active.')
        loadStripeStatus()
        setSettingsTab('payments')
      } else if (params.get('connect') === 'refresh') {
        toast.info('Stripe verification was interrupted. Click Connect to resume.')
        setSettingsTab('payments')
      }
    }
  }, [loadStripeStatus])

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
      toast.error('Network error connecting to Stripe.')
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
        toast.error(data.error || 'Failed to open Stripe dashboard.')
      }
    } catch {
      toast.error('Network error opening dashboard.')
    } finally {
      setOpeningDashboard(false)
    }
  }

  const handleCopyNumber = () => {
    if (!formData.telnyx_phone_number) return
    navigator.clipboard.writeText(formData.telnyx_phone_number)
    setCopied(true)
    toast.success('Forwarding number copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyCarrier = (carrierKey: string, code: string) => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopiedCarrier(carrierKey)
    toast.success('Carrier activation code copied to clipboard!')
    setTimeout(() => setCopiedCarrier(null), 2000)
  }

  const canEditSettings = ['owner', 'admin', 'super_admin'].includes(userRole)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return

    if (!canEditSettings) {
      toast.error('Only organization owners and admins can update settings.')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/client/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          owner_phone: formData.owner_phone,
          carrier: formData.carrier,
          timezone: formData.timezone,
          google_review_url: formData.google_review_url,
          reactivation_enabled: formData.reactivation_enabled,
          default_reactivation_interval_days: parseInt(String(formData.default_reactivation_interval_days), 10) || 90,
          reactivation_cooldown_days: parseInt(String(formData.reactivation_cooldown_days), 10) || 30,
          reactivation_template: formData.reactivation_template,
          reactivation_quiet_hours: formData.reactivation_quiet_hours,
          reactivation_max_daily: parseInt(String(formData.reactivation_max_daily), 10) || 50,
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
          weekly_digest_enabled: formData.weekly_digest_enabled,
          weekly_digest_day_of_week: formData.weekly_digest_day_of_week,
          weekly_digest_hour: formData.weekly_digest_hour,
          external_payment_url: formData.external_payment_url,
          payment_instructions: formData.payment_instructions,
          submit_carrier_verification: true
        })
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update settings.')
      } else {
        toast.success('Settings saved successfully')
      }
    } catch {
      toast.error('Network error while saving settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTestSms = async () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile number first so we know where to send the test.')
      return
    }
    setTestingSms(true)
    try {
      const res = await fetch('/api/telnyx/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.owner_phone
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `Test text sent to ${formData.owner_phone}`)
      } else {
        toast.error(data.error || 'Test SMS failed. Verify your phone format.')
      }
    } catch {
      toast.error('Network error while dispatching test SMS.')
    } finally {
      setTestingSms(false)
    }
  }

  const handleSendTestDigest = async () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile number first in Business Profile to receive the digest.')
      return
    }
    setTestingDigest(true)
    try {
      const res = await fetch('/api/client/weekly-digest/test', {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Weekly ROI digest dispatched to your phone!')
      } else {
        toast.error(data.error || 'Failed to dispatch test digest.')
      }
    } catch {
      toast.error('Network error dispatching test digest.')
    } finally {
      setTestingDigest(false)
    }
  }

  const cleanForwardingDigits = formData.telnyx_phone_number.replace(/\D/g, '')

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Settings & Preferences
          </h1>
        </div>
        <Link
          href="/client/billing"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shrink-0"
        >
          <CreditCard className="w-4 h-4" />
          <span>SaaS Plan & Billing →</span>
        </Link>
      </div>

      {error ? (
        <ErrorState
          title="Failed to load settings"
          message={error}
          onRetry={loadSettings}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-3">
            <Skeleton className="h-5 w-40 bg-slate-200 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-64 bg-slate-100 dark:bg-zinc-800/60" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-9 w-full bg-slate-200 dark:bg-zinc-800" />
              <Skeleton className="h-9 w-full bg-slate-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Settings Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none bg-slate-100 dark:bg-zinc-900/60 p-1.5 rounded-xl border border-slate-200/60 dark:border-zinc-800">
            {[
              { id: 'profile', label: 'Business Profile', icon: Building2 },
              { id: 'display', label: 'Theme & Display', icon: Palette },
              { id: 'telephony', label: 'Telephony & Routing', icon: Smartphone },
              { id: 'retention', label: 'Retention & 10DLC', icon: ShieldCheck },
              { id: 'payments', label: 'Payments & Payouts', icon: CreditCard },
              { id: 'notifications', label: 'Alerts & Push', icon: Bell }
            ].map(t => {
              const Icon = t.icon
              const isActive = settingsTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSettingsTab(t.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-zinc-500")} />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>

          {/* ── Tab 1: Business Profile ── */}
          {settingsTab === 'profile' && (
            <form onSubmit={handleSave} className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-xs">
              <div className="pb-3 border-b border-slate-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Business Details & Operating Region
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Primary trade category, contact phone for owner notifications, and default dispatch timezone.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block font-medium">Business Name</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Reyes Plumbing"
                    className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block font-medium">Owner Cell Phone (Notifications)</Label>
                  <Input
                    value={formData.owner_phone}
                    onChange={e => setFormData(d => ({ ...d, owner_phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block font-medium">Primary Carrier</Label>
                  <select
                    aria-label="Primary Carrier"
                    value={formData.carrier}
                    onChange={e => setFormData(d => ({ ...d, carrier: e.target.value }))}
                    className="w-full h-8.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Verizon">Verizon Wireless</option>
                    <option value="AT&T">AT&amp;T</option>
                    <option value="T-Mobile">T-Mobile / Sprint</option>
                    <option value="Other">Other / Landline</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block font-medium">Timezone</Label>
                  <select
                    aria-label="Timezone"
                    value={formData.timezone}
                    onChange={e => setFormData(d => ({ ...d, timezone: e.target.value }))}
                    className="w-full h-8.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Industry / Trade Category</Label>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Manage catalog in <Link href="/client/services" className="text-blue-600 dark:text-blue-400 hover:underline">Services</Link>
                    </span>
                  </div>
                  <select
                    aria-label="Industry / Trade Category"
                    value={formData.industry}
                    onChange={e => setFormData(d => ({ ...d, industry: e.target.value }))}
                    className="w-full h-8.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {INDUSTRY_LIST.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} — {preset.badge}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                    Your primary business trade. All starter services seeded during onboarding can be freely renamed, repriced, or deleted anytime in Services.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block font-medium">Google Review URL</Label>
                  <Input
                    value={formData.google_review_url}
                    onChange={e => setFormData(d => ({ ...d, google_review_url: e.target.value }))}
                    placeholder="https://g.page/r/..."
                    className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                    Included in post-service review request text messages sent to satisfied homeowners.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                {!canEditSettings && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Read-only: Only organization owners and administrators can modify settings.
                  </p>
                )}
                <div className="ml-auto">
                  <Button
                    type="submit"
                    disabled={saving || !canEditSettings}
                    size="sm"
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-medium shadow-xs"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    <span>Save Business Profile</span>
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* ── Tab 2: Theme & Display ── */}
          {settingsTab === 'display' && (
            <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
              <div className="pb-3 border-b border-slate-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Display Theme & Appearance
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Choose your preferred interface theme. Light Theme is default and recommended for outdoor daylight and clarity.
                </p>
              </div>

              <ThemeSettingsSelector />
            </div>
          )}

          {/* ── Tab 3: Telephony & Call Forwarding ── */}
          {settingsTab === 'telephony' && (
            <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Carrier Conditional Call Forwarding
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Forward unanswered calls to your CaptoDesk dedicated number to trigger the instant text-back. Your phone still rings normally.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    {formData.telnyx_phone_number || 'Provisioning...'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyNumber}
                    className="h-7.5 px-2.5 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Carrier Dial Codes */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">Dial Code by Carrier:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Verizon */}
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 block">Verizon Wireless</span>
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-center select-all">
                        *71{cleanForwardingDigits || 'XXXXXXXXXX'}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-500">Dial code, listen for 2 beeps, hang up.</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-600">
                        To disable: <a href="tel:*73" className="underline hover:text-slate-600 dark:hover:text-zinc-400">dial *73</a>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 space-y-1.5">
                      <a
                        href={cleanForwardingDigits ? `tel:*71${cleanForwardingDigits}` : '#'}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-semibold shadow-xs transition-colors text-center",
                          cleanForwardingDigits
                            ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 pointer-events-none"
                        )}
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        <span>Tap to Dial &amp; Activate</span>
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyCarrier('verizon', `*71${cleanForwardingDigits}`)}
                        disabled={!cleanForwardingDigits}
                        className="w-full h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      >
                        {copiedCarrier === 'verizon' ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* AT&T */}
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 block">AT&amp;T</span>
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-center select-all">
                        *71{cleanForwardingDigits || 'XXXXXXXXXX'}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-500">Dial code, wait for tone, hang up.</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-600">
                        To disable: <a href="tel:*73" className="underline hover:text-slate-600 dark:hover:text-zinc-400">dial *73</a>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 space-y-1.5">
                      <a
                        href={cleanForwardingDigits ? `tel:*71${cleanForwardingDigits}` : '#'}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-semibold shadow-xs transition-colors text-center",
                          cleanForwardingDigits
                            ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 pointer-events-none"
                        )}
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        <span>Tap to Dial &amp; Activate</span>
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyCarrier('att', `*71${cleanForwardingDigits}`)}
                        disabled={!cleanForwardingDigits}
                        className="w-full h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      >
                        {copiedCarrier === 'att' ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* T-Mobile */}
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 block">T-Mobile / Sprint</span>
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-center select-all">
                        **62*{cleanForwardingDigits || 'XXXXXXXXXX'}#
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-500">Dial code with # at end, tap call.</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-600">
                        To disable: <a href="tel:%23%2362%23" className="underline hover:text-slate-600 dark:hover:text-zinc-400">dial ##62#</a>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 space-y-1.5">
                      <a
                        href={cleanForwardingDigits ? `tel:**62*${cleanForwardingDigits}%23` : '#'}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-semibold shadow-xs transition-colors text-center",
                          cleanForwardingDigits
                            ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 pointer-events-none"
                        )}
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        <span>Tap to Dial &amp; Activate</span>
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyCarrier('tmobile', `**62*${cleanForwardingDigits}#`)}
                        disabled={!cleanForwardingDigits}
                        className="w-full h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      >
                        {copiedCarrier === 'tmobile' ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test SMS Trigger */}
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Verify SMS dispatch pipeline to your cell phone ({formData.owner_phone || 'No phone set'}).
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestSms}
                  disabled={testingSms || !formData.owner_phone}
                  className="h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs"
                >
                  {testingSms ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span>Send Test SMS</span>
                </Button>
              </div>
            </div>
          )}

          {/* ── Tab 4: Retention & 10DLC ── */}
          {settingsTab === 'retention' && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Customer Reactivation Settings */}
              <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Customer Retention & Reactivation
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Automatically remind past clients when they are due for recurring seasonal maintenance.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-zinc-300 font-medium">
                    <input
                      type="checkbox"
                      checked={formData.reactivation_enabled}
                      onChange={e => setFormData(d => ({ ...d, reactivation_enabled: e.target.checked }))}
                      className="rounded bg-white dark:bg-zinc-950 border-slate-300 dark:border-zinc-800 text-blue-600 h-4 w-4"
                    />
                    <span>Reactivations Active</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">Interval (Days)</Label>
                    <Input
                      type="number"
                      min={14}
                      max={730}
                      value={formData.default_reactivation_interval_days}
                      onChange={e => setFormData(d => ({ ...d, default_reactivation_interval_days: parseInt(e.target.value, 10) || 90 }))}
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500">Days since last service</span>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">Cooldown (Days)</Label>
                    <Input
                      type="number"
                      min={7}
                      max={365}
                      value={formData.reactivation_cooldown_days}
                      onChange={e => setFormData(d => ({ ...d, reactivation_cooldown_days: parseInt(e.target.value, 10) || 30 }))}
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500">Min days between messages</span>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">Daily Dispatch Limit</Label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={formData.reactivation_max_daily}
                      onChange={e => setFormData(d => ({ ...d, reactivation_max_daily: parseInt(e.target.value, 10) || 50 }))}
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500">Max sent per day</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 font-medium">Reactivation Message Template</Label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={formData.reactivation_quiet_hours}
                        onChange={e => setFormData(d => ({ ...d, reactivation_quiet_hours: e.target.checked }))}
                        className="rounded bg-white dark:bg-zinc-950 border-slate-300 dark:border-zinc-800 text-blue-600 h-3.5 w-3.5"
                      />
                      <span>Quiet Hours (8am-8pm local)</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={formData.reactivation_template}
                    onChange={e => setFormData(d => ({ ...d, reactivation_template: e.target.value }))}
                    className="w-full rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* 10DLC Brand & Carrier Verification */}
              <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      US Carrier &amp; 10DLC Brand Verification
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Official business registration details filed with The Campaign Registry (TCR) for US SMS deliverability.
                    </p>
                  </div>

                  <div>
                    {formData.carrier_registration_status === 'verified' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        Verified Brand
                      </span>
                    ) : formData.carrier_registration_status === 'pending' || formData.carrier_registration_status === 'in_review' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                        <Loader2 className="h-3 w-3 animate-spin text-amber-600 dark:text-amber-400" />
                        Carrier Review Pending
                      </span>
                    ) : formData.carrier_registration_status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                        Verification Action Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400">
                        Not Registered
                      </span>
                    )}
                  </div>
                </div>

                {/* 10DLC Educational Explainer for Paying Members */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 leading-relaxed space-y-1">
                  <p className="font-semibold flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Missed-Call Text-Back &amp; 10DLC Registration for Paying Members</span>
                  </p>
                  <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                    US wireless carriers (Verizon, AT&amp;T, T-Mobile) require all automated business text messages to be pre-registered under the A2P 10DLC standard. During initial onboarding, these boxes were left blank so you could get started immediately. As a paying subscriber, CaptoDesk covers your 10DLC filing fees—please fill in your legal business name, Federal EIN (or Sole Prop), and business address below so your missed-call text-backs are verified and never blocked as spam.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">Legal Business Entity Name</Label>
                    <Input
                      value={formData.legal_business_name}
                      onChange={e => setFormData(d => ({ ...d, legal_business_name: e.target.value }))}
                      placeholder="e.g. Acme Plumbing LLC"
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">Business Structure</Label>
                    <select
                      aria-label="Business Structure"
                      value={formData.business_type}
                      onChange={e => setFormData(d => ({ ...d, business_type: e.target.value }))}
                      className="w-full h-8.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="llc">LLC (Limited Liability Co)</option>
                      <option value="corporation">Corporation (C-Corp / S-Corp)</option>
                      <option value="sole_proprietorship">Sole Proprietorship</option>
                      <option value="partnership">Partnership</option>
                      <option value="non_profit">Non-Profit (501c3)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-slate-700 dark:text-zinc-400 font-medium">Federal EIN / Tax ID</Label>
                      <label className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_sole_proprietor}
                          onChange={e => setFormData(d => ({ ...d, is_sole_proprietor: e.target.checked }))}
                          className="rounded bg-white dark:bg-zinc-950 border-slate-300 dark:border-zinc-800 text-blue-600 h-3 w-3"
                        />
                        <span>Sole Prop (No EIN)</span>
                      </label>
                    </div>
                    <Input
                      value={formData.is_sole_proprietor ? '' : formData.ein}
                      disabled={formData.is_sole_proprietor}
                      onChange={e => setFormData(d => ({ ...d, ein: e.target.value }))}
                      placeholder="12-3456789"
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md font-mono disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">Website / Social Profile</Label>
                    <Input
                      value={formData.website_url}
                      onChange={e => setFormData(d => ({ ...d, website_url: e.target.value }))}
                      placeholder="https://acmeplumbing.com"
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">Street Address</Label>
                    <Input
                      value={formData.address_street}
                      onChange={e => setFormData(d => ({ ...d, address_street: e.target.value }))}
                      placeholder="123 Main St, Suite 100"
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">City</Label>
                    <Input
                      value={formData.address_city}
                      onChange={e => setFormData(d => ({ ...d, address_city: e.target.value }))}
                      placeholder="Austin"
                      className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">State</Label>
                      <Input
                        maxLength={2}
                        value={formData.address_state}
                        onChange={e => setFormData(d => ({ ...d, address_state: e.target.value.toUpperCase() }))}
                        placeholder="TX"
                        className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-700 dark:text-zinc-400 mb-1 block font-medium">ZIP</Label>
                      <Input
                        maxLength={10}
                        value={formData.address_postal_code}
                        onChange={e => setFormData(d => ({ ...d, address_postal_code: e.target.value }))}
                        placeholder="78701"
                        className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                  {!canEditSettings && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      Read-only: Only organization owners and administrators can modify settings.
                    </p>
                  )}
                  <div className="ml-auto">
                    <Button
                      type="submit"
                      disabled={saving || !canEditSettings}
                      size="sm"
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-medium shadow-xs"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      <span>Save Retention & 10DLC</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* TCPA & Carrier Compliance */}
              <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-900 p-4 text-xs text-slate-600 dark:text-zinc-400 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2 text-slate-900 dark:text-zinc-200 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>A2P 10DLC & TCPA Carrier Compliance Built-In</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  When customers reply <code className="text-slate-800 dark:text-zinc-300 font-semibold bg-white dark:bg-zinc-950 px-1 py-0.5 rounded border border-slate-200 dark:border-zinc-800">STOP</code>, <code className="text-slate-800 dark:text-zinc-300 font-semibold bg-white dark:bg-zinc-950 px-1 py-0.5 rounded border border-slate-200 dark:border-zinc-800">UNSUBSCRIBE</code>, or <code className="text-slate-800 dark:text-zinc-300 font-semibold bg-white dark:bg-zinc-950 px-1 py-0.5 rounded border border-slate-200 dark:border-zinc-800">CANCEL</code>, automated SMS messages are immediately suppressed.
                </p>
              </div>
            </form>
          )}

          {/* ── Tab 5: Online Payments & Payouts (Direct Links + Stripe Connect) ── */}
          {settingsTab === 'payments' && (
            <div className="space-y-6">
              {/* Card 1: Direct Homeowner Payment Links & Instructions (Instant setup - no merchant wait) */}
              <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-zinc-800">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Direct Homeowner Payment Links &amp; Instructions
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Get paid immediately by homeowners via Square, Venmo, PayPal, or Zelle on your invoice links without waiting for merchant approval.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-full self-start sm:self-center">
                    Instant Setup
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      External Payment URL (Square, Venmo, PayPal.me, or Custom Link)
                    </label>
                    <input
                      type="url"
                      placeholder="https://square.link/u/... or https://paypal.me/yourbusiness"
                      value={formData.external_payment_url}
                      onChange={(e) => setFormData({ ...formData, external_payment_url: e.target.value })}
                      disabled={!canEditSettings}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-850 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                      When provided, customers opening your invoice at <code>/invoice/[token]</code> will see a prominent &ldquo;Pay Online Now&rdquo; button linking directly here.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Direct Payment Instructions (Zelle, Check, Cash, Wire)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g., Zelle to (512) 555-0199 or billing@yourbiz.com. Checks payable to Your Business LLC. Cash accepted on job site."
                      value={formData.payment_instructions}
                      onChange={(e) => setFormData({ ...formData, payment_instructions: e.target.value })}
                      disabled={!canEditSettings}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-850 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                      Displayed clearly on the customer&apos;s invoice and tracking screen so homeowners know exactly how to settle their bill.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !canEditSettings}
                      size="sm"
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      <span>Save Direct Payment Settings</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Card 2: Stripe Connect (Automated Payouts) */}
              <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Online Payments &amp; Direct Bank Deposits
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Accept credit card, debit card, and Apple Pay payments on invoices and live customer tracking links.
                  </p>
                </div>

                {stripeStatus?.connected ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Stripe Express Active</span>
                  </div>
                ) : stripeStatus?.status === 'pending' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Verification Pending</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-zinc-500 font-medium">
                    Not Configured
                  </span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <span className="font-semibold text-slate-900 dark:text-zinc-200 block">How Payouts Work</span>
                  <p className="text-slate-600 dark:text-zinc-400 text-[11.5px] leading-relaxed">
                    When customers pay through their live job tracker or invoice link, payments process securely through Stripe. Funds deposit automatically to your linked bank account on a rolling 2-day schedule.
                  </p>
                  <div className="pt-1 text-[11px] text-slate-500 dark:text-zinc-500 flex items-center gap-1">
                    <span>Platform fee: 0.5% facilitation per successful invoice.</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-zinc-200 block">Account Status</span>
                    <div className="mt-1 space-y-1 text-[11.5px] text-slate-600 dark:text-zinc-400">
                      <div className="flex items-center justify-between">
                        <span>Card Payments:</span>
                        <span className={stripeStatus?.chargesEnabled ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-zinc-500'}>
                          {stripeStatus?.chargesEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Bank Payouts:</span>
                        <span className={stripeStatus?.payoutsEnabled ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-zinc-500'}>
                          {stripeStatus?.payoutsEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-800/80">
                    {stripeStatus?.connected ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenStripeDashboard}
                        disabled={openingDashboard}
                        className="w-full h-8 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white font-medium flex items-center justify-center gap-1.5 border border-slate-200 dark:border-zinc-700 shadow-xs"
                      >
                        {openingDashboard ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                        )}
                        <span>Open Stripe Express Dashboard</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleConnectStripe}
                        disabled={connectingStripe || !canEditSettings}
                        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        {connectingStripe ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {stripeStatus?.status === 'pending'
                            ? 'Complete Stripe Verification'
                            : 'Connect Bank with Stripe'}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* ── Tab 6: Alerts & Push Notifications ── */}
          {settingsTab === 'notifications' && (
            <div className="space-y-6">
              <PushNotificationSettings />

              {/* Weekly Owner ROI Digest */}
              <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Weekly Owner ROI Digest
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Automated performance recap reporting recovered missed calls, jobs booked, Stripe revenue collected, and 5-star Google reviews.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                      formData.weekly_digest_enabled
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400"
                    )}>
                      <span className={cn("w-2 h-2 rounded-full", formData.weekly_digest_enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                      <span>{formData.weekly_digest_enabled ? 'Active (Mondays 8:00 AM)' : 'Disabled'}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                    <div className="space-y-0.5">
                      <Label htmlFor="weeklyDigestToggle" className="text-xs font-semibold text-slate-900 dark:text-zinc-100 cursor-pointer">
                        Automated SMS & Dashboard Digest
                      </Label>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Dispatches every Monday at 8:00 AM local time directly to {formData.owner_phone || 'your owner phone number'}.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="weeklyDigestToggle"
                      checked={formData.weekly_digest_enabled}
                      onChange={e => setFormData(d => ({ ...d, weekly_digest_enabled: e.target.checked }))}
                      className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-blue-600 h-4 w-4"
                    />
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-950/40 text-xs space-y-2">
                    <div className="font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>What's inside your weekly recap?</span>
                    </div>
                    <ul className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
                      <li>Total missed calls recovered in under 15 seconds</li>
                      <li>Number of service jobs booked &amp; estimated ticket value</li>
                      <li>Exact revenue collected via Stripe invoice &amp; deposit links</li>
                      <li>New 5-star Google review completions</li>
                    </ul>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-zinc-800">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestDigest}
                      disabled={testingDigest || !formData.owner_phone}
                      className="h-8 text-xs border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                    >
                      {testingDigest ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />}
                      <span>Send Preview to {formData.owner_phone || 'Mobile'}</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSave}
                      disabled={saving || !canEditSettings}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      <span>Save Digest Preferences</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
