'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRY_LIST, getIndustryPreset } from '@/lib/constants/industries'
import { hasDedicatedPhoneNumber, resolveSenderPhone } from '@/lib/billing/plans'
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
  Info,
  Upload,
  Trash2,
  Image as ImageIcon,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Download,
  ChevronRight,
  ArrowLeft,
  Printer,
  Receipt,
  Calendar,
  MessageSquare,
  PhoneForwarded,
  Navigation,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import { ContractorBrandAvatar } from '@/components/brand/contractor-brand-avatar'
import { cn } from '@/lib/utils'
import { PushNotificationSettings } from '@/components/notifications/push-notification-settings'
import { ThemeSettingsSelector } from '@/components/theme-toggle'
import { maskEin, canViewFullEin } from '@/lib/security/permissions'

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
  billingProvider?: string
  canManageBilling: boolean
  entitlement?: {
    isStarter?: boolean
    allowed?: boolean
    starterUsage?: {
      completedJobsCount: number
      limit: number
      remainingJobs: number
      totalRevenueEarned: number
    }
  } | null
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
  const [mobileCategoryView, setMobileCategoryView] = useState<boolean>(!searchParams.get('tab'))

  const handleTabChange = (newTab: SettingsTab) => {
    setActiveTab(newTab)
    setMobileCategoryView(false)
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('tab', newTab)
    window.history.replaceState({}, '', currentUrl.toString())
  }

  const handleReturnToHub = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Discard changes and return to Settings Hub?')) {
        handleDiscard()
        setMobileCategoryView(true)
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.delete('tab')
        window.history.replaceState({}, '', currentUrl.toString())
      }
    } else {
      setMobileCategoryView(true)
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.delete('tab')
      window.history.replaceState({}, '', currentUrl.toString())
    }
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
  const [copiedPrepaid, setCopiedPrepaid] = useState(false)
  const [copiedDeactivate, setCopiedDeactivate] = useState(false)
  const [testingSms, setTestingSms] = useState(false)
  const [testingDigest, setTestingDigest] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)

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

  const [telephonyMeta, setTelephonyMeta] = useState({
    plan_id: 'free',
    subscription_status: 'trial',
    phone_provisioning_status: ''
  })

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
    logo_url: '',
    license_number: '',
    carrier_registration_status: 'unregistered',
    tcr_brand_id: '',
    tcr_campaign_id: '',
    weekly_digest_enabled: true,
    weekly_digest_day_of_week: 1,
    weekly_digest_hour: 8,
    external_payment_url: '',
    payment_instructions: '',
    tracking_mode: 'milestone' as 'milestone' | 'geofence_live',
    tracking_geofence_miles: 5,
    reactivation_enabled: true,
    default_reactivation_interval_days: 90,
    reactivation_cooldown_days: 30,
    reactivation_template: "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
    reactivation_quiet_hours: true,
    reactivation_max_daily: 50
  })

  // Dirty State & EIN Protection Management (Phase 2 & Phase 4)
  const [initialFormData, setInitialFormData] = useState<any | null>(null)
  const [storedEinMasked, setStoredEinMasked] = useState<string>('')
  const [hasStoredEin, setHasStoredEin] = useState<boolean>(false)
  const [isEditingEin, setIsEditingEin] = useState<boolean>(false)
  const [newEinInput, setNewEinInput] = useState<string>('')
  const [revealingEin, setRevealingEin] = useState<boolean>(false)
  const [revealedEin, setRevealedEin] = useState<string | null>(null)
  const [expandedPlanFeatures, setExpandedPlanFeatures] = useState<Record<string, boolean>>({})
  const [mobilePlanTab, setMobilePlanTab] = useState<'free' | 'solo' | 'multi_crew'>('solo')
  const [showAllPlansMobile, setShowAllPlansMobile] = useState<boolean>(false)
  const [showFeatureMatrix, setShowFeatureMatrix] = useState<boolean>(false)
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null)
  const [selectedCarrier, setSelectedCarrier] = useState<'verizon' | 'att' | 'tmobile' | 'prepaid'>('verizon')
  const [testSmsModalOpen, setTestSmsModalOpen] = useState<boolean>(false)
  const [testSmsAuthorized, setTestSmsAuthorized] = useState<boolean>(false)
  const [testSmsResult, setTestSmsResult] = useState<{ success: boolean; message: string } | null>(null)
  const [previewDigestModalOpen, setPreviewDigestModalOpen] = useState<boolean>(false)

  const isDirty = useMemo(() => {
    if (!initialFormData) return false
    if (isEditingEin && newEinInput.trim().length > 0) return true
    return (Object.keys(formData) as Array<keyof typeof formData>).some(key => {
      return formData[key] !== initialFormData[key]
    })
  }, [formData, initialFormData, isEditingEin, newEinInput])

  const contractorLocalTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: formData.timezone || 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }).format(new Date())
    } catch {
      return null
    }
  }, [formData.timezone])

  const previewReactivationMessage = useMemo(() => {
    const raw = formData.reactivation_template || "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}"
    const bizName = formData.name?.trim() || 'Apex Home Services'
    const bookingUrl = `https://captodesk.com/book/${formData.slug || 'apex-services'}`
    return raw
      .replace(/{customer_name}/g, 'Sarah')
      .replace(/{business_name}/g, bizName)
      .replace(/{booking_url}/g, bookingUrl)
  }, [formData.reactivation_template, formData.name, formData.slug])

  const reactivationCharCount = useMemo(() => {
    return (formData.reactivation_template || '').length
  }, [formData.reactivation_template])

  const reactivationSmsSegments = useMemo(() => {
    const len = previewReactivationMessage.length
    if (len === 0) return 1
    return len <= 160 ? 1 : Math.ceil(len / 153)
  }, [previewReactivationMessage])

  const paymentUrlValidation = useMemo(() => {
    const url = formData.external_payment_url?.trim()
    if (!url) return { isValid: true, error: null }
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { isValid: false, error: 'URL must begin with https:// or http://' }
      }
      return { isValid: true, error: null }
    } catch {
      return { isValid: false, error: 'Please enter a complete web address (e.g. https://venmo.com/u/yourname)' }
    }
  }, [formData.external_payment_url])

  const stripeConnectionInfo = useMemo(() => {
    if (!stripeStatus) {
      return {
        status: 'not_connected',
        badgeText: 'Not Connected',
        badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
        description: 'Connect your bank account via Stripe to accept credit cards and Apple Pay directly on invoices.'
      }
    }
    if (stripeStatus.connected || (stripeStatus.chargesEnabled && stripeStatus.status === 'active')) {
      return {
        status: 'connected',
        badgeText: 'Connected & Active • Auto Payouts',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        description: 'Visa, Mastercard, Amex, Apple Pay, and Google Pay are active. Automatic 2-day rolling bank payouts.'
      }
    }
    if (stripeStatus.status === 'error') {
      return {
        status: 'error',
        badgeText: 'Connection Error',
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        description: 'An error occurred with your Stripe Connect account. Reconnecting is recommended.'
      }
    }
    if (stripeStatus.status === 'restricted' || stripeStatus.status === 'action_required') {
      return {
        status: 'action_required',
        badgeText: 'Action Required in Stripe',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        description: 'Stripe requires additional documentation to enable payouts. Please open your Stripe dashboard.'
      }
    }
    if (stripeStatus.status === 'pending' || (stripeStatus.accountId && !stripeStatus.chargesEnabled)) {
      return {
        status: 'pending',
        badgeText: 'Verification Pending with Stripe',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        description: 'Stripe is verifying your identity and bank details. Card charges will activate once verification completes.'
      }
    }
    return {
      status: 'not_connected',
      badgeText: 'Not Connected',
      badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
      description: 'Connect your bank account via Stripe to accept credit cards and Apple Pay directly on invoices.'
    }
  }, [stripeStatus])

  const handleDiscard = () => {
    if (initialFormData) {
      setFormData({ ...initialFormData })
      setIsEditingEin(false)
      setNewEinInput('')
      setRevealedEin(null)
      toast.info('Unsaved changes discarded.')
    }
  }

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const handleRevealEin = async () => {
    if (revealedEin) {
      setRevealedEin(null)
      return
    }
    setRevealingEin(true)
    try {
      const res = await fetch('/api/client/organization?reveal_ein=true')
      if (res.ok) {
        const data = await res.json()
        if (data.organization?.ein && !data.organization.ein.includes('X')) {
          setRevealedEin(data.organization.ein)
        } else {
          toast.error('Only organization owners can reveal the unmasked EIN.')
        }
      }
    } catch {
      toast.error('Failed to reveal EIN.')
    } finally {
      setRevealingEin(false)
    }
  }

  const togglePlanExpanded = (planKey: string) => {
    setExpandedPlanFeatures(prev => ({ ...prev, [planKey]: !prev[planKey] }))
  }

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

      // Authoritative read via /api/client/organization with server-side EIN masking and RBAC
      let org: any = null
      try {
        const apiRes = await fetch('/api/client/organization')
        if (apiRes.ok) {
          const apiJson = await apiRes.json()
          org = apiJson.organization
        }
      } catch {
        // Non-fatal network fallback
      }

      if (!org) {
        const { data: dbOrg, error: orgErr } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.org_id)
          .single()

        if (orgErr) {
          setError('Failed to retrieve organization settings.')
          setLoading(false)
          return
        }
        org = dbOrg
      }

      if (org) {
        setTelephonyMeta({
          plan_id: org.plan_id || 'free',
          subscription_status: org.subscription_status || 'trial',
          phone_provisioning_status: org.phone_provisioning_status || ''
        })

        const loadedTrackingMode = (org.tracking_mode === 'geofence' || org.tracking_mode === 'geofence_live') ? 'geofence_live' : 'milestone'
        const loadedFormData = {
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
          logo_url: org.logo_url || '',
          license_number: org.license_number || '',
          carrier_registration_status: org.carrier_registration_status || 'unregistered',
          tcr_brand_id: org.tcr_brand_id || '',
          tcr_campaign_id: org.tcr_campaign_id || '',
          weekly_digest_enabled: org.weekly_digest_enabled ?? true,
          weekly_digest_day_of_week: org.weekly_digest_day_of_week ?? 1,
          weekly_digest_hour: org.weekly_digest_hour ?? 8,
          external_payment_url: org.external_payment_url || '',
          payment_instructions: org.payment_instructions || '',
          tracking_mode: loadedTrackingMode as 'milestone' | 'geofence_live',
          tracking_geofence_miles: org.tracking_geofence_miles || 5,
          reactivation_enabled: org.reactivation_enabled ?? true,
          default_reactivation_interval_days: org.default_reactivation_interval_days || 90,
          reactivation_cooldown_days: org.reactivation_cooldown_days || 30,
          reactivation_template: org.reactivation_template || "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
          reactivation_quiet_hours: org.reactivation_quiet_hours ?? true,
          reactivation_max_daily: org.reactivation_max_daily || 50
        }

        setFormData(loadedFormData)
        setInitialFormData(loadedFormData)
        const masked = org.ein_masked || maskEin(org.ein) || ''
        setStoredEinMasked(masked)
        setHasStoredEin(Boolean(org.has_ein || org.ein))
        setIsEditingEin(false)
        setNewEinInput('')
        setRevealedEin(null)
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
        const activePlanId = (
          data.subscription?.plan_id || 
          data.organization?.plan_id || 
          data.currentPlan?.id || 
          'free'
        ).toLowerCase()
        if (activePlanId.includes('multi_crew') || activePlanId.includes('fleet')) {
          setMobilePlanTab('multi_crew')
        } else if (activePlanId.includes('solo') || activePlanId.includes('standard')) {
          setMobilePlanTab('solo')
        } else {
          setMobilePlanTab('free')
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

  // Logo Upload Handlers
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'].includes(file.type.toLowerCase())) {
      toast.error('Please upload a PNG, JPG, WebP, or SVG image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image exceeds 5MB limit. Please choose a smaller image.')
      return
    }

    setUploadingLogo(true)
    try {
      const data = new FormData()
      data.append('file', file)

      const res = await fetch('/api/client/organization/logo', {
        method: 'POST',
        body: data
      })

      const result = await res.json()
      if (res.ok && result.logo_url) {
        setFormData(prev => ({ ...prev, logo_url: result.logo_url }))
        toast.success('Brand logo uploaded and applied to invoices & booking page!')
      } else {
        toast.error(result.error || 'Failed to upload logo.')
      }
    } catch {
      toast.error('A network error occurred while uploading your logo.')
    } finally {
      setUploadingLogo(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleRemoveLogo = async () => {
    setRemovingLogo(true)
    try {
      const res = await fetch('/api/client/organization/logo', {
        method: 'DELETE'
      })
      if (res.ok) {
        setFormData(prev => ({ ...prev, logo_url: '' }))
        toast.success('Logo removed. Reset to trade monogram avatar.')
      } else {
        toast.error('Failed to remove logo.')
      }
    } catch {
      toast.error('Error removing logo.')
    } finally {
      setRemovingLogo(false)
    }
  }

  // Save Settings Handler - uses authoritative /api/client/organization PATCH endpoint
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!orgId) return

    setSaving(true)
    setSavedSuccess(false)
    try {
      const savePayload: Record<string, any> = {
        name: formData.name,
        operation_mode: formData.operation_mode,
        owner_phone: formData.owner_phone,
        carrier: formData.carrier,
        timezone: formData.timezone,
        google_review_url: formData.google_review_url,
        legal_business_name: formData.legal_business_name,
        business_type: formData.business_type,
        is_sole_proprietor: formData.is_sole_proprietor,
        address_street: formData.address_street,
        address_city: formData.address_city,
        address_state: formData.address_state,
        address_postal_code: formData.address_postal_code,
        website_url: formData.website_url,
        logo_url: formData.logo_url || null,
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
      }

      // Safe EIN handling (Phase 2):
      // Sole proprietor -> ein: null
      // New EIN typed by user -> validate 9 digits -> ein: newEinInput.trim()
      // Otherwise -> OMIT ein from payload to preserve authentic stored EIN in database!
      if (formData.is_sole_proprietor) {
        savePayload.ein = null
      } else if (isEditingEin && newEinInput.trim().length > 0) {
        const cleanEin = newEinInput.trim().replace(/\D/g, '')
        if (cleanEin.length !== 9) {
          toast.error('EIN must be exactly 9 digits (format: XX-XXXXXXX).')
          setSaving(false)
          return
        }
        savePayload.ein = newEinInput.trim()
      }

      const res = await fetch('/api/client/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload)
      })

      const data = await res.json()
      if (res.ok) {
        setSavedSuccess(true)
        setInitialFormData({ ...formData })
        if (isEditingEin && newEinInput.trim().length > 0) {
          setStoredEinMasked(maskEin(newEinInput.trim()) || '')
          setHasStoredEin(true)
          setIsEditingEin(false)
          setNewEinInput('')
          setRevealedEin(null)
        } else if (formData.is_sole_proprietor) {
          setStoredEinMasked('')
          setHasStoredEin(false)
          setIsEditingEin(false)
          setNewEinInput('')
          setRevealedEin(null)
        }
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
          action: 'cancel',
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
        body: JSON.stringify({ action: 'reactivate' })
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

  // Telephony Test SMS Handlers
  const handleOpenTestSmsModal = () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile phone number in Business Profile first.')
      return
    }
    setTestSmsAuthorized(false)
    setTestSmsResult(null)
    setTestSmsModalOpen(true)
  }

  const handleExecuteTestSms = async () => {
    if (!formData.owner_phone) return
    setTestingSms(true)
    setTestSmsResult(null)
    try {
      const res = await fetch('/api/telnyx/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.owner_phone })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestSmsResult({ success: true, message: `Test SMS successfully dispatched to ${formData.owner_phone}. Check your phone.` })
        toast.success(`Test text dispatched to ${formData.owner_phone}`)
      } else {
        const errorMsg = data.error || 'Test SMS could not be dispatched. Check your phone number format.'
        setTestSmsResult({ success: false, message: errorMsg })
        toast.error(errorMsg)
      }
    } catch {
      setTestSmsResult({ success: false, message: 'Network error communicating with telecom dispatch service.' })
      toast.error('Network error sending test text.')
    } finally {
      setTestingSms(false)
    }
  }

  // Weekly Digest Preview
  const handleTestDigest = async () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile number first in Business Profile.')
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
        setPreviewDigestModalOpen(false)
      } else {
        toast.error(data.error || 'Failed to send digest preview.')
      }
    } catch {
      toast.error('Network error sending digest preview.')
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

  const telephonyOrgContext = {
    telnyx_phone_number: formData.telnyx_phone_number,
    phone_provisioning_status: telephonyMeta.phone_provisioning_status,
    plan_id: telephonyMeta.plan_id,
    subscription_status: telephonyMeta.subscription_status,
  }
  const hasDedicatedLine = hasDedicatedPhoneNumber(telephonyOrgContext)
  const effectiveOutboundNumber = resolveSenderPhone(telephonyOrgContext)
  const isCarrierVerified =
    formData.carrier_registration_status === 'verified' ||
    formData.carrier_registration_status === 'registered'
  const cleanForwardingDigits = (hasDedicatedLine ? formData.telnyx_phone_number : '').replace(/\D/g, '')
  const tradePreset = getIndustryPreset(formData.industry)

  const sub = billingData?.subscription
  const activePlanId = (
    sub?.plan_id || 
    billingData?.organization?.plan_id || 
    billingData?.currentPlan?.id || 
    'free'
  ).toLowerCase()

  const isPayingActive = 
    (sub?.status === 'active' || billingData?.organization?.subscription_status === 'active') && 
    activePlanId !== 'free'

  const isCurrentSolo = isPayingActive && (activePlanId === 'solo' || activePlanId === 'solo_yearly' || activePlanId === 'captodesk_standard')
  const isCurrentMultiCrew = isPayingActive && (activePlanId === 'multi_crew' || activePlanId === 'multi_crew_yearly' || activePlanId === 'fleet')
  const isCurrentFree = !isCurrentSolo && !isCurrentMultiCrew

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
            {savedSuccess && !isDirty && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" />
                Saved ✓
              </span>
            )}
            {isDirty && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            )}
            <Button
              onClick={() => handleSave()}
              disabled={saving || !canEdit || !isDirty}
              size="sm"
              className={cn(
                "h-10 sm:h-9 px-4 text-xs font-semibold shadow-2xs gap-1.5 cursor-pointer min-h-[48px] sm:min-h-0 transition-colors",
                isDirty
                  ? "bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-500/20"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isDirty ? (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MOBILE SETUP CENTER HUB (Category Overview for Smartphone Contractors)     */}
      {/* Visible only on mobile when mobileCategoryView is true                     */}
      {/* ========================================================================= */}
      <div className={cn("space-y-3.5 md:hidden", !mobileCategoryView && "hidden")}>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Setup Assistant &amp; Configuration Hub
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Select a category below to configure your business profile, subscriptions, carrier forwarding, and payment gateways.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {/* Card 1: Business Profile */}
          <button
            type="button"
            data-hub-card="profile"
            onClick={() => handleTabChange('profile')}
            className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-500/40 dark:hover:border-blue-500/40 shadow-2xs transition-all active:scale-[0.99] cursor-pointer min-h-[48px]"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/40">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Business Profile &amp; Brand
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Identity, tax EIN, contact details, and public logo
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                {tradePreset.name}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {formData.operation_mode === 'multi_crew' ? 'Multi-Crew / Fleet' : 'Solo Operator'}
              </span>
              {hasStoredEin ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  EIN Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  Sole Proprietor
                </span>
              )}
            </div>
          </button>

          {/* Card 2: Billing & Plans */}
          <button
            type="button"
            data-hub-card="billing"
            onClick={() => handleTabChange('billing')}
            className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 shadow-2xs transition-all active:scale-[0.99] cursor-pointer min-h-[48px]"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800/40">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Subscription &amp; Plans
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Plan tiers, usage tracker, and payment receipts
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                {isCurrentMultiCrew ? 'CaptoDesk Multi-Crew ($199/mo)' : isCurrentSolo ? 'CaptoDesk Solo ($99/mo)' : 'Free 3-Job Starter Pass ($0)'}
              </span>
              {isCurrentFree && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                  {billingData?.entitlement?.starterUsage?.completedJobsCount ?? 0}/3 Free Jobs Used
                </span>
              )}
            </div>
          </button>

          {/* Card 3: Phone & Call Forwarding */}
          <button
            type="button"
            data-hub-card="telephony"
            onClick={() => handleTabChange('telephony')}
            className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-sky-500/40 dark:hover:border-sky-500/40 shadow-2xs transition-all active:scale-[0.99] cursor-pointer min-h-[48px]"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-200/60 dark:border-sky-800/40">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Phone &amp; Call Forwarding
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Carrier star codes (*71 / *72), live map, and SMS
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                {hasDedicatedLine ? formatPhoneNumber(formData.telnyx_phone_number) : 'Dedicated Line Inactive'}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
                formData.tracking_mode === 'geofence_live' 
                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
              )}>
                {formData.tracking_mode === 'geofence_live' ? 'Live Geofence Map' : 'Milestone Checkpoints'}
              </span>
            </div>
          </button>

          {/* Card 4: Payments & Alerts */}
          <button
            type="button"
            data-hub-card="payments"
            onClick={() => handleTabChange('payments')}
            className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-500/40 dark:hover:border-amber-500/40 shadow-2xs transition-all active:scale-[0.99] cursor-pointer min-h-[48px]"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-800/40">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Payments &amp; Alerts
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Stripe card payouts, Zelle/Venmo, and executive SMS
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
                stripeStatus?.connected 
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
              )}>
                {stripeStatus?.connected ? 'Stripe Active (Auto Payouts)' : 'Direct Links (Zelle/Venmo)'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                {formData.weekly_digest_enabled ? 'Monday Executive SMS Active' : 'Digest Off'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CATEGORY WORKSPACE (Hidden on mobile if mobileCategoryView is true)         */}
      {/* Always visible on desktop (hidden md:block when mobileCategoryView is true) */}
      {/* ========================================================================= */}
      <div className={cn("space-y-6", mobileCategoryView && "hidden md:block")}>
        {/* Mobile Category Header (Back button + compact category selector pills) */}
        <div className="md:hidden space-y-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleReturnToHub}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Settings</span>
            </button>

            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {activeTab === 'profile' && 'Business Profile'}
              {activeTab === 'billing' && 'Billing & Plans'}
              {activeTab === 'telephony' && 'Phone & Forwarding'}
              {activeTab === 'payments' && 'Payments & Alerts'}
            </span>
          </div>

          {/* 4 compact category selector pills for rapid switching on mobile */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              data-tab-pill="profile"
              onClick={() => handleTabChange('profile')}
              className={cn(
                "py-2 px-1 text-center rounded text-[11px] font-semibold transition-colors cursor-pointer min-h-[40px] truncate",
                activeTab === 'profile'
                  ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400"
              )}
            >
              Profile
            </button>
            <button
              type="button"
              data-tab-pill="billing"
              onClick={() => handleTabChange('billing')}
              className={cn(
                "py-2 px-1 text-center rounded text-[11px] font-semibold transition-colors cursor-pointer min-h-[40px] truncate",
                activeTab === 'billing'
                  ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400"
              )}
            >
              Billing
            </button>
            <button
              type="button"
              data-tab-pill="telephony"
              onClick={() => handleTabChange('telephony')}
              className={cn(
                "py-2 px-1 text-center rounded text-[11px] font-semibold transition-colors cursor-pointer min-h-[40px] truncate",
                activeTab === 'telephony'
                  ? "bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-2xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400"
              )}
            >
              Phone
            </button>
            <button
              type="button"
              data-tab-pill="payments"
              onClick={() => handleTabChange('payments')}
              className={cn(
                "py-2 px-1 text-center rounded text-[11px] font-semibold transition-colors cursor-pointer min-h-[40px] truncate",
                activeTab === 'payments'
                  ? "bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-2xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400"
              )}
            >
              Payments
            </button>
          </div>
        </div>

        {/* Desktop horizontal navigation tabs (Hidden on mobile) */}
        <div className="hidden md:grid md:grid-cols-4 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            data-desktop-tab="profile"
            onClick={() => handleTabChange('profile')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
              activeTab === 'profile'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            )}
          >
            <Building2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="truncate hidden sm:inline">Business Profile</span>
            <span className="truncate sm:hidden">Profile</span>
          </button>

          <button
            type="button"
            data-desktop-tab="billing"
            onClick={() => handleTabChange('billing')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
              activeTab === 'billing'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            )}
          >
            <CreditCard className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate hidden sm:inline">Billing &amp; Plans</span>
            <span className="truncate sm:hidden">Billing</span>
          </button>

          <button
            type="button"
            data-desktop-tab="telephony"
            onClick={() => handleTabChange('telephony')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
              activeTab === 'telephony'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            )}
          >
            <Smartphone className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="truncate hidden sm:inline">Phone &amp; Call Forwarding</span>
            <span className="truncate sm:hidden">Phone &amp; Forwarding</span>
          </button>

          <button
            type="button"
            data-desktop-tab="payments"
            onClick={() => handleTabChange('payments')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[48px] sm:min-h-0',
              activeTab === 'payments'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            )}
          >
            <DollarSign className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate hidden sm:inline">Payments &amp; Alerts</span>
            <span className="truncate sm:hidden">Payments</span>
          </button>
        </div>

      {/* ========================================================================= */}
      {/* TAB 1: BUSINESS PROFILE & BRAND IDENTITY (6-SECTION GUIDED ARCHITECTURE)  */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Section 1: Company Identity & Brand */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  1. Company Identity &amp; Brand
                </h2>
                <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">
                  Customer-Facing
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Your trade name, brand logo, industry preset, website, and contractor licensing.
              </p>
            </div>

            {/* Where this appears callout */}
            <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Where Customers See This Information</p>
                <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                  Your business name and logo appear on customer estimates, PDF invoices, dispatch text messages, live homeowner arrival tracking, and your online booking portal.
                </p>
              </div>
            </div>

            {/* Brand Logo & Avatar Upload Section */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <ContractorBrandAvatar
                  logoUrl={formData.logo_url}
                  name={formData.name || 'My Business'}
                  industry={formData.industry}
                  size="xl"
                  rounded="2xl"
                  className="shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {formData.logo_url ? 'Company Logo' : 'Company Monogram'}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                      formData.logo_url ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                    )}>
                      {formData.logo_url ? 'Custom Logo' : 'Auto Monogram'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
                    Square or horizontal PNG, JPG, WebP, or SVG (max 5MB). Monogram generated automatically if no logo is uploaded.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                <input
                  type="file"
                  id="logo-upload-input"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingLogo}
                  onClick={() => document.getElementById('logo-upload-input')?.click()}
                  className="flex-1 sm:flex-none h-10 sm:h-9 text-xs font-semibold gap-1.5 border-zinc-300 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 cursor-pointer min-h-[44px] sm:min-h-0"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      <span>{formData.logo_url ? 'Replace Logo' : 'Upload Brand Logo'}</span>
                    </>
                  )}
                </Button>

                {formData.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={removingLogo}
                    onClick={handleRemoveLogo}
                    className="h-10 sm:h-9 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer min-h-[44px] sm:min-h-0"
                    title="Remove logo and use trade monogram"
                  >
                    {removingLogo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Trade Business Name *
                </Label>
                <Input
                  required
                  value={formData.name}
                  onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Apex Plumbing & HVAC"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
                <p className="text-[10px] text-zinc-500 mt-1">The public brand name homeowners recognize on caller ID, invoices, and quotes.</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Primary Trade Industry
                </Label>
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
                <p className="text-[10px] text-zinc-500 mt-1">Configures industry-specific price books, templates, and seasonal follow-up defaults.</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Company Website
                </Label>
                <Input
                  value={formData.website_url}
                  onChange={e => setFormData(d => ({ ...d, website_url: e.target.value }))}
                  placeholder="https://apexservices.com"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Linked in estimate headers, invoice footers, and online booking confirmation.</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  State Contractor License #
                </Label>
                <Input
                  value={formData.license_number}
                  onChange={e => setFormData(d => ({ ...d, license_number: e.target.value }))}
                  placeholder="e.g. Master Plumber #MP-49102"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Printed in invoice footers and quote contracts for state regulatory compliance.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Legal and Tax Details */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  2. Legal &amp; Tax Details
                </h2>
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                  Compliance &amp; W-9
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Official entity registration, Federal Tax ID, and dispatch headquarters address.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Confidential business compliance records used strictly for carrier 10DLC brand registration, Stripe merchant verification, and official W-9 tax reporting. Never exposed publicly to homeowners.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Legal Business Name (IRS / State Charter)
                </Label>
                <Input
                  value={formData.legal_business_name}
                  onChange={e => setFormData(d => ({ ...d, legal_business_name: e.target.value }))}
                  placeholder="e.g. Apex Mechanical LLC"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Exact name registered on state articles of incorporation or LLC filings.</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Entity Type
                </Label>
                <select
                  aria-label="Entity Type"
                  value={formData.business_type}
                  onChange={e => {
                    const val = e.target.value
                    setFormData(d => ({
                      ...d,
                      business_type: val,
                      is_sole_proprietor: val === 'sole_proprietorship' ? true : d.is_sole_proprietor
                    }))
                  }}
                  className="w-full h-10 sm:h-9 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 px-3 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="llc">Limited Liability Company (LLC)</option>
                  <option value="corporation">Corporation (C-Corp / S-Corp)</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                </select>
                <p className="text-[10px] text-zinc-500 mt-1">Determines 10DLC carrier trust score criteria and IRS tax category.</p>
              </div>

              {/* Sole Proprietor & EIN Section */}
              <div className="md:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                <div className="flex items-start gap-2.5 min-h-[36px]">
                  <input
                    type="checkbox"
                    id="sole_prop"
                    checked={formData.is_sole_proprietor}
                    onChange={e => setFormData(d => ({ ...d, is_sole_proprietor: e.target.checked }))}
                    className="rounded bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 h-4 w-4 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <Label htmlFor="sole_prop" className="text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer font-semibold block">
                      Operating as a Sole Proprietor without an EIN
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Sole proprietors without employees can register for business texting and banking using the owner's SSN directly with carriers and Stripe. No EIN is required.
                    </p>
                  </div>
                </div>

                {!formData.is_sole_proprietor && (
                  <div className="max-w-md space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                        EIN (Federal Employer Identification Number)
                      </Label>
                      {hasStoredEin && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                          <Lock className="w-2.5 h-2.5" /> Protected On File
                        </span>
                      )}
                    </div>

                    {hasStoredEin && !isEditingEin ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 sm:h-9 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-mono text-sm sm:text-xs">
                          <span className="text-zinc-900 dark:text-zinc-100 font-bold tracking-wider">
                            {revealedEin || storedEinMasked}
                          </span>
                          {(userRole === 'owner' || userRole === 'super_admin') && (
                            <button
                              type="button"
                              onClick={handleRevealEin}
                              disabled={revealingEin}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer min-h-[40px] px-1"
                            >
                              {revealingEin ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : revealedEin ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Hide</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Reveal</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingEin(true)
                              setNewEinInput('')
                            }}
                            className="h-10 sm:h-9 text-xs border-zinc-200 dark:border-zinc-800 shrink-0 cursor-pointer min-h-[44px] sm:min-h-0"
                          >
                            Update EIN
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Input
                            value={newEinInput}
                            onChange={e => setNewEinInput(e.target.value)}
                            placeholder="12-3456789"
                            maxLength={10}
                            className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono tabular-nums"
                          />
                          {hasStoredEin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setIsEditingEin(false)
                                setNewEinInput('')
                              }}
                              className="h-10 sm:h-9 text-xs shrink-0 cursor-pointer min-h-[44px] sm:min-h-0"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Format: 9 digits (XX-XXXXXXX). Strictly confidential and masked after save.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Physical Business Address */}
              <div className="md:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Physical Business &amp; Dispatch Base Address
                </Label>
                <Input
                  value={formData.address_street}
                  onChange={e => setFormData(d => ({ ...d, address_street: e.target.value }))}
                  placeholder="Street Address, Suite / Unit"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />

                <div className="space-y-2">
                  <Input
                    value={formData.address_city}
                    onChange={e => setFormData(d => ({ ...d, address_city: e.target.value }))}
                    placeholder="City"
                    className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                      className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono tabular-nums sm:col-span-2"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Origin headquarters for service territory calculation and geofenced arrival radius.</p>
              </div>
            </div>
          </div>

          {/* Section 3: Business Contact Information */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-sky-600" />
                  3. Business Contact Information
                </h2>
                <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full border border-sky-200/60 dark:border-sky-800/40">
                  Telephony Separation
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Clearly distinguishes your personal cell phone from your public homeowner line.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Owner Personal Mobile */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                    Owner Cell Phone (Private Alerts)
                  </Label>
                  <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                    Confidential
                  </span>
                </div>
                <Input
                  value={formData.owner_phone}
                  onChange={e => setFormData(d => ({ ...d, owner_phone: e.target.value }))}
                  placeholder="(555) 019-2831"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs font-mono tabular-nums"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Your personal smartphone. Receives instant missed-call texts, emergency booking alerts, and Monday 8:00 AM summaries. Never shared with homeowners.
                </p>
              </div>

              {/* Dedicated Business Line (Protected Read-Only) */}
              <div className="p-4 rounded-xl border border-sky-200/80 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-sky-950 dark:text-sky-100 block">
                    Dedicated Business Line (Public)
                  </Label>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    isCarrierVerified 
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200" 
                      : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 border-sky-200"
                  )}>
                    {isCarrierVerified ? '10DLC Carrier Registered' : 'Registration Pending'}
                  </span>
                </div>
                <div className="h-10 sm:h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-sky-200 dark:border-sky-800 flex items-center justify-between font-mono text-sm sm:text-xs">
                  <span className="font-bold text-sky-950 dark:text-sky-100">
                    {hasDedicatedLine ? formatPhoneNumber(formData.telnyx_phone_number) : 'Platform Toll-Free Line'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTabChange('telephony')}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer min-h-[40px] px-1 font-medium"
                  >
                    <span>Manage</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-sky-900/80 dark:text-sky-300/80 leading-relaxed">
                  Homeowners call and text this number. Caller ID shows your brand. Managed securely in the Phone &amp; Call Forwarding tab to prevent accidental line overwrites.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Operating Preferences & Schedule */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  4. Operating Preferences &amp; Schedule
                </h2>
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                  Scheduling Engine
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Operational timezone, quiet hours, and customer review collection.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Operational Timezone
                  </Label>
                  {contractorLocalTime && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                      <Clock className="w-3 h-3 text-blue-500" />
                      Local: {contractorLocalTime}
                    </span>
                  )}
                </div>
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
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Downstream impact: Sets online booking arrival slots, triggers morning 7:00 AM dispatch text, enforces customer quiet hours (8:00 AM to 8:00 PM), and aligns Monday weekly summaries.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Google Review Page URL
                </Label>
                <Input
                  value={formData.google_review_url}
                  onChange={e => setFormData(d => ({ ...d, google_review_url: e.target.value }))}
                  placeholder="https://g.page/r/your-handle/review"
                  className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Sent automatically in post-service review request text messages after invoices are paid. Directs homeowners straight to your Google Business Profile.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Field Operation Mode */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  5. Field Operation Mode
                </h2>
                <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">
                  Dispatch Structure
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure your dispatch board for a solo operator or a multi-truck crew.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setFormData(d => ({ ...d, operation_mode: 'solo' }))}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 cursor-pointer min-h-[48px]',
                  formData.operation_mode === 'solo'
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/30'
                    : 'bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                <div className={cn(
                  'p-2 rounded-lg mt-0.5 shrink-0',
                  formData.operation_mode === 'solo' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                )}>
                  <Truck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Solo Operator (1 Truck)</span>
                    {formData.operation_mode === 'solo' && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Single dispatch route with auto-assigned bookings. Optimized for 1 to 2 person owner-operator setups without complex crew management.
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    Included on Starter Pass &amp; Solo ($99/mo)
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData(d => ({ ...d, operation_mode: 'multi_crew' }))}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 cursor-pointer min-h-[48px]',
                  formData.operation_mode === 'multi_crew'
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/30'
                    : 'bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                <div className={cn(
                  'p-2 rounded-lg mt-0.5 shrink-0',
                  formData.operation_mode === 'multi_crew' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                )}>
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Multi-Crew / Fleet (2+ Trucks)</span>
                    {formData.operation_mode === 'multi_crew' && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Multi-truck dispatch calendar, crew assignments, driver routing, technician field mobile access, and morning SMS schedule broadcasts.
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Included on Multi-Crew Tier ($199/mo)
                  </span>
                </div>
              </button>
            </div>

            {/* Non-destructive safe mode switching safeguard */}
            <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Safe Non-Destructive Mode Switching</p>
                <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                  Switching between Solo and Multi-Crew only changes your calendar and dispatch interface views. Staff members, service vans, assignments, and job history are never deleted.
                </p>
              </div>
            </div>
          </div>

          {/* Section 6: Interface Appearance & Theme */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600" />
                  6. Interface Appearance &amp; Theme
                </h2>
                <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/40">
                  Device Preference
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Choose Light, Dark, or System Preference across your smartphone and desktop screens.
              </p>
            </div>

            <ThemeSettingsSelector />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Automatically saved to your device and synchronized across your sessions.
            </p>
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
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Current Plan</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                              {isCurrentMultiCrew ? 'CaptoDesk Multi-Crew' : isCurrentSolo ? 'CaptoDesk Solo' : 'Free 3-Job Starter Pass'}
                            </span>
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                              isPayingActive && !sub?.cancel_at_period_end
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : isPayingActive && sub?.cancel_at_period_end
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            )}>
                              ● {isPayingActive ? (sub?.cancel_at_period_end ? 'Cancels at Period End' : 'Active Subscription') : 'Free Starter Pass Active'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Good Standing
                            </span>
                          </div>

                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            {sub?.current_period_end ? (
                              sub?.cancel_at_period_end ? (
                                <>Cancellation scheduled: Access to your dedicated line and dispatch automations continues until <strong className="text-zinc-900 dark:text-zinc-100">{new Date(sub.current_period_end).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</strong>. No recurring charges will occur.</>
                              ) : (
                                <>Renews on <strong className="text-zinc-900 dark:text-zinc-100">{new Date(sub.current_period_end).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</strong> via direct card processing.</>
                              )
                            ) : isPayingActive ? (
                              'Billed monthly via direct card processing.'
                            ) : (
                              'Process your first 3 customer jobs with full dispatch, card invoicing, and automated review requests. Customer bookings and appointments are 100% free and unlimited.'
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                              ${isCurrentMultiCrew ? (billingCycle === 'yearly' ? '1,990' : '199') : isCurrentSolo ? (billingCycle === 'yearly' ? '990' : '99') : '0'}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400"> / {isCurrentFree ? 'first 3 jobs ($0 fees)' : (billingCycle === 'yearly' ? 'year' : 'month')}</span>
                          </div>

                          {isPayingActive && (
                            sub?.cancel_at_period_end ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={reactivatingSub}
                                onClick={handleReactivateSubscription}
                                className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer flex items-center gap-1.5"
                              >
                                {reactivatingSub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                <span>{reactivatingSub ? 'Reactivating...' : 'Reactivate Plan'}</span>
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

                      {/* Starter Pass 3-Job Usage Tracker */}
                      {isCurrentFree && (
                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                              Starter Pass Job Allowance
                            </span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-100 font-bold">
                              {billingData?.entitlement?.starterUsage?.completedJobsCount ?? 0} of {billingData?.entitlement?.starterUsage?.limit ?? 3} Free Jobs Completed
                            </span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-200 dark:border-zinc-700/60">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.round(((billingData?.entitlement?.starterUsage?.completedJobsCount ?? 0) / (billingData?.entitlement?.starterUsage?.limit ?? 3)) * 100))}%` }}
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>{billingData?.entitlement?.starterUsage?.remainingJobs ?? 3} free completed jobs remaining before choosing a paid plan.</span>
                            {billingData?.entitlement?.starterUsage?.totalRevenueEarned ? (
                              <span className="font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                                ${(billingData.entitlement.starterUsage.totalRevenueEarned / 100).toFixed(2)} revenue earned
                              </span>
                            ) : null}
                          </div>
                          <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Completed jobs only:</strong> Only finalized customer jobs count against your pass. Public online bookings, quote estimates, and calendar scheduling are 100% free and unlimited forever.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Billing Cycle Interval Switcher */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Subscription Plans &amp; Pricing</h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Upgrade as your business grows. Switch to annual billing anytime to get 2 months free.</p>
                        </div>

                        <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setBillingCycle('monthly')}
                            className={cn(
                              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[44px] sm:min-h-0',
                              billingCycle === 'monthly' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            )}
                          >
                            Monthly Billing
                          </button>
                          <button
                            type="button"
                            onClick={() => setBillingCycle('yearly')}
                            className={cn(
                              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px] sm:min-h-0',
                              billingCycle === 'yearly' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            )}
                          >
                            <span>Annual</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">2 Mo Free</span>
                          </button>
                        </div>
                      </div>

                      {billingCycle === 'yearly' && (
                        <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-150">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span><strong>Annual Savings Applied:</strong> Pay for 10 months and get 2 full months free. Save $198/year on Solo Pro or $398/year on Multi-Crew Fleet.</span>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">17% Savings</span>
                        </div>
                      )}
                    </div>

                    {/* Mobile Segmented Selector (Mobile-First Plan Deck) */}
                    <div className="space-y-3 lg:hidden">
                      <div className="flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
                        <button
                          type="button"
                          onClick={() => setMobilePlanTab('free')}
                          className={cn(
                            "flex-1 py-2 px-1 text-center rounded-lg text-xs font-bold transition-all min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            mobilePlanTab === 'free'
                              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                          )}
                        >
                          <span className="flex items-center gap-1">
                            Starter
                            {isCurrentFree && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">$0</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobilePlanTab('solo')}
                          className={cn(
                            "flex-1 py-2 px-1 text-center rounded-lg text-xs font-bold transition-all min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            mobilePlanTab === 'solo'
                              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                          )}
                        >
                          <span className="flex items-center gap-1">
                            Solo Pro
                            {isCurrentSolo && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">${billingCycle === 'yearly' ? '990/yr' : '99/mo'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobilePlanTab('multi_crew')}
                          className={cn(
                            "flex-1 py-2 px-1 text-center rounded-lg text-xs font-bold transition-all min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            mobilePlanTab === 'multi_crew'
                              ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                          )}
                        >
                          <span className="flex items-center gap-1">
                            Multi-Crew
                            {isCurrentMultiCrew && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">${billingCycle === 'yearly' ? '1,990/yr' : '199/mo'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-zinc-500 text-[11px]">
                          {mobilePlanTab === 'free' ? 'Showing Starter Pass' : mobilePlanTab === 'solo' ? 'Showing Solo Pro' : 'Showing Multi-Crew Fleet'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAllPlansMobile(prev => !prev)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer flex items-center gap-1"
                        >
                          {showAllPlansMobile ? 'Show Single Plan Focus' : 'Compare All 3 Stacked'}
                        </button>
                      </div>
                    </div>

                    {/* 3-Tier Canonical Plan Cards Deck */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

                      {/* Card 1: Free Starter Pass */}
                      <div className={cn(
                        "rounded-xl border bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between space-y-5 shadow-2xs transition-colors",
                        isCurrentFree
                          ? "border-emerald-500/60 dark:border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10"
                          : "border-zinc-200 dark:border-zinc-800",
                        !showAllPlansMobile && mobilePlanTab !== 'free' && "hidden lg:flex"
                      )}>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Starter Pass
                            </span>
                            {isCurrentFree && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Current Plan
                              </span>
                            )}
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Free 3-Job Starter Pass</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                              Complete your first 3 customer jobs 100% free with automated dispatch, Stripe card invoicing, and Google reviews.
                            </p>
                          </div>

                          <div className="flex items-baseline gap-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                              $0
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                              / first 3 jobs ($0 platform fees)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span>Setup Fee: <strong className="text-zinc-800 dark:text-zinc-200">$0.00 (Free)</strong></span>
                          </div>

                          <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>First 3 completed jobs 100% free</strong> ($0 fees)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>Unlimited Public Booking Link</strong> (book.captodesk.com/your-name)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>100% Unmasked</strong> customer contacts</span>
                            </li>
                            <div className={cn("space-y-2 pt-1", !expandedPlanFeatures['free'] && "hidden lg:block")}>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Visual Calendar &amp; Job dispatch scheduling</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Customer Directory &amp; Service Catalog</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Mobile field portal &amp; Before/After photos</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Digital invoicing &amp; on-site card checkout</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Automated Google review booster</span>
                              </li>
                            </div>
                          </ul>
                          <button
                            type="button"
                            onClick={() => togglePlanExpanded('free')}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1 cursor-pointer lg:hidden"
                          >
                            {expandedPlanFeatures['free'] ? (
                              <>Show fewer features <ChevronUp className="w-3.5 h-3.5" /></>
                            ) : (
                              <>Show all 8 features <ChevronDown className="w-3.5 h-3.5" /></>
                            )}
                          </button>
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
                              onClick={() => handleOpenChangePlan({ id: 'free', name: 'Free 3-Job Starter Pass', amount: 0, interval: 'month' })}
                              className="w-full h-10 sm:h-9 text-xs font-semibold border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer min-h-[48px] sm:min-h-0"
                            >
                              Downgrade to Free Starter Pass ($0)
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
                            : "border-zinc-200 dark:border-zinc-800",
                        !showAllPlansMobile && mobilePlanTab !== 'solo' && "hidden lg:flex"
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
                              / {billingCycle === 'yearly' ? 'year (Save $198/yr)' : 'month'}
                            </span>
                          </div>

                          {/* Waived Setup Fee Callout Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Carrier Registration: <span className="line-through text-zinc-400 dark:text-zinc-500">$199.00</span> <strong className="text-emerald-600 dark:text-emerald-400 font-bold">$0 (Waived)</strong></span>
                          </div>

                          <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>1 Dedicated Business Line</strong> (Carrier verified 10DLC)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span><strong>Instant Auto-Reply</strong> Missed Call Text</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Two-Way SMS &amp; Homeowner Chat Hub</span>
                            </li>
                            <div className={cn("space-y-2 pt-1", !expandedPlanFeatures['solo'] && "hidden lg:block")}>
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
                                <span>Live homeowner arrival map (Real-time GPS tracking)</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Automated 5-star Google review booster</span>
                              </li>
                            </div>
                          </ul>
                          <button
                            type="button"
                            onClick={() => togglePlanExpanded('solo')}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1 cursor-pointer lg:hidden"
                          >
                            {expandedPlanFeatures['solo'] ? (
                              <>Show fewer features <ChevronUp className="w-3.5 h-3.5" /></>
                            ) : (
                              <>Show all 7 features <ChevronDown className="w-3.5 h-3.5" /></>
                            )}
                          </button>
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
                              <span>Upgrade to Solo ({billingCycle === 'yearly' ? '$990/yr' : '$99/mo'})</span>
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
                            : "border-zinc-300 dark:border-zinc-700 ring-1 ring-zinc-200 dark:ring-zinc-800",
                        !showAllPlansMobile && mobilePlanTab !== 'multi_crew' && "hidden lg:flex"
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
                              / {billingCycle === 'yearly' ? 'year (Save $398/yr)' : 'month'}
                            </span>
                          </div>

                          {/* Waived Setup Fee Callout Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Carrier Registration: <span className="line-through text-zinc-400 dark:text-zinc-500">$299.00</span> <strong className="text-emerald-600 dark:text-emerald-400 font-bold">$0 (Waived)</strong></span>
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
                            <div className={cn("space-y-2 pt-1", !expandedPlanFeatures['multi_crew'] && "hidden lg:block")}>
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
                            </div>
                          </ul>
                          <button
                            type="button"
                            onClick={() => togglePlanExpanded('multi_crew')}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1 cursor-pointer lg:hidden"
                          >
                            {expandedPlanFeatures['multi_crew'] ? (
                              <>Show fewer features <ChevronUp className="w-3.5 h-3.5" /></>
                            ) : (
                              <>Show all 7 features <ChevronDown className="w-3.5 h-3.5" /></>
                            )}
                          </button>
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
                              <span>Upgrade to Multi-Crew ({billingCycle === 'yearly' ? '$1,990/yr' : '$199/mo'})</span>
                            </Button>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Detailed Plan Feature Comparison Matrix Accordion */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setShowFeatureMatrix(prev => !prev)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            Compare All Plan Features &amp; Entitlements
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <span>{showFeatureMatrix ? 'Hide Details' : 'View Comparison'}</span>
                          {showFeatureMatrix ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {showFeatureMatrix && (
                        <div className="p-4 pt-0 border-t border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[500px]">
                            <thead>
                              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                                <th className="py-2.5 px-3">Capability</th>
                                <th className="py-2.5 px-3">Starter Pass ($0)</th>
                                <th className="py-2.5 px-3 text-blue-600">Solo Pro ($99/mo)</th>
                                <th className="py-2.5 px-3 text-emerald-600">Multi-Crew ($199/mo)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-[11px]">
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Operator Accounts</td>
                                <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">1 Owner</td>
                                <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">1 Owner-Operator</td>
                                <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">Up to 5 Crew Techs</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Completed Jobs Included</td>
                                <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">3 Free Jobs ($0)</td>
                                <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">Unlimited</td>
                                <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">Unlimited</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Public Online Booking Link</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">100% Free &amp; Unlimited</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">100% Free &amp; Unlimited</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">100% Free &amp; Unlimited</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Dedicated Business Phone Line</td>
                                <td className="py-2.5 px-3 text-zinc-500">Shared Toll-Free Line</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">1 Dedicated Line (10DLC)</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">1 Dedicated Line (10DLC)</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Instant Missed-Call Auto-Reply</td>
                                <td className="py-2.5 px-3 text-zinc-500">Shared Trial Route</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Under 5s Text-Back</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Under 5s Text-Back</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Mobile Field Portal with GPS</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Included</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Included</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Included</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Live Homeowner Arrival Map</td>
                                <td className="py-2.5 px-3 text-zinc-500">Milestone Tracker</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Real-Time GPS Map</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Real-Time GPS Map</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Multi-Crew Dispatch Board</td>
                                <td className="py-2.5 px-3 text-zinc-500">Solo 1 Truck</td>
                                <td className="py-2.5 px-3 text-zinc-500">Solo 1 Truck</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Van Routing &amp; Board</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">7 AM Daily Route SMS Broadcasts</td>
                                <td className="py-2.5 px-3 text-zinc-500">Not Included</td>
                                <td className="py-2.5 px-3 text-zinc-500">Not Included</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Automated Daily SMS</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Technician Privacy Shield</td>
                                <td className="py-2.5 px-3 text-zinc-500">Not Included</td>
                                <td className="py-2.5 px-3 text-zinc-500">Not Included</td>
                                <td className="py-2.5 px-3 text-emerald-600 font-semibold">Zero Financial Access</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Carrier 10DLC Registration Fee</td>
                                <td className="py-2.5 px-3 text-zinc-500">$0.00</td>
                                <td className="py-2.5 px-3 font-semibold text-emerald-600">$0 (Waived $199)</td>
                                <td className="py-2.5 px-3 font-semibold text-emerald-600">$0 (Waived $299)</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">Annual Discount</td>
                                <td className="py-2.5 px-3 text-zinc-500">N/A ($0 forever)</td>
                                <td className="py-2.5 px-3 font-semibold text-emerald-600">Save $198/yr (2 Mo Free)</td>
                                <td className="py-2.5 px-3 font-semibold text-emerald-600">Save $398/yr (2 Mo Free)</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}

              {/* Billing Receipts & History */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      Invoices &amp; Receipts
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Review previous platform subscription charges and download receipts.
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">PDF Downloads Available</span>
                </div>

                {billingData.payments && billingData.payments.length > 0 ? (
                  <>
                    <div className="overflow-x-auto hidden md:block">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-400 uppercase text-[10px] font-bold">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3">Amount</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {billingData.payments.map((p: any) => (
                            <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                              <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 font-mono">
                                {new Date(p.payment_date || p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-white">
                                {p.notes || p.description || 'Monthly SaaS Subscription'}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white font-mono tabular-nums">
                                ${p.amount ? Number(p.amount).toFixed(2) : '0.00'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                                  <Check className="h-3 w-3" /> Paid
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setViewingReceipt(p)}
                                  className="h-7 px-2.5 text-[11px] border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 cursor-pointer"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2.5 md:hidden">
                      {billingData.payments.map((p: any) => (
                        <div key={p.id} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                              {p.notes || p.description || 'Monthly SaaS Subscription'}
                            </span>
                            <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 tabular-nums">
                              ${p.amount ? Number(p.amount).toFixed(2) : '0.00'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="font-mono">
                              {new Date(p.payment_date || p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                                <Check className="h-3 w-3" /> Paid
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingReceipt(p)}
                                className="h-8 px-2 text-[11px] border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 min-h-[36px]"
                              >
                                View Receipt
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <Receipt className="w-6 h-6 text-zinc-400" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No past receipts recorded. Invoices will automatically appear after your billing cycle completes.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BUSINESS PHONE & CALL FORWARDING                                     */}
      {/* ========================================================================= */}
      {activeTab === 'telephony' && (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Card 1: Active Business Phone Line & Routing */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-600" />
                  Active Business Phone Line
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Your outbound caller ID, automated missed-call text-back, and customer messaging line.
                </p>
              </div>

              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border self-start sm:self-auto",
                hasDedicatedLine
                  ? isCarrierVerified
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
              )}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {hasDedicatedLine
                  ? (isCarrierVerified ? 'Dedicated Line • 10DLC Verified' : 'Dedicated Line • Active')
                  : 'Shared Platform Toll-Free (3-Job Starter Pass)'}
              </span>
            </div>

            {/* Prominent Active Number Box */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                    {hasDedicatedLine ? 'Dedicated Business Number (Exclusive Direct Route)' : 'Active Outbound Route (CaptoDesk Verified Toll-Free)'}
                  </span>
                  <div className="text-xl sm:text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {formatPhoneNumber(effectiveOutboundNumber)}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {hasDedicatedLine
                      ? 'Customers see this verified local number on Caller ID, automated text-back, appointment reminders, and invoice links.'
                      : 'During your 3-job free trial, all outbound SMS dispatch reliably through this verified toll-free line. No carrier setup required.'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(effectiveOutboundNumber)
                    setCopiedNumber(true)
                    toast.success('Business phone number copied')
                    setTimeout(() => setCopiedNumber(false), 2000)
                  }}
                  className="h-11 sm:h-10 px-4 border-zinc-200 dark:border-zinc-800 text-xs font-semibold shrink-0 min-h-[44px] flex items-center gap-2"
                >
                  {copiedNumber ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-zinc-500" />}
                  {copiedNumber ? 'Copied Number!' : 'Copy Phone Number'}
                </Button>
              </div>
            </div>

            {/* 4-Item Telephony Capability Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Outbound SMS</span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Active • Tier-1 Telecom
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  High-speed carrier delivery for reminders, estimates, and receipts.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Missed-Call Auto-Reply</span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Active (&lt;5s Trigger)
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Instantly sends booking link whenever an incoming call is missed.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Inbound Calling</span>
                </div>
                <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                  {formData.owner_phone ? formatPhoneNumber(formData.owner_phone) : 'Mobile Unset'}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Customers call your personal cell directly; missed calls forward to text-back.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">10DLC Carrier Status</span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> {isCarrierVerified ? 'Verified & Registered' : 'Platform Trust Route'}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Registered with AT&amp;T, Verizon, and T-Mobile to ensure zero spam-filtering.
                </p>
              </div>
            </div>

            {/* Trial vs Dedicated Phone Line Comparison Card */}
            {!hasDedicatedLine && (
              <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Starter Pass vs Dedicated Local Number
                    </h3>
                    <p className="text-xs text-blue-900/90 dark:text-blue-300/90 leading-relaxed">
                      You are currently using the <strong>Free Starter Pass</strong> with CaptoDesk&apos;s verified shared toll-free line. You have 3 free completed jobs included with $0 platform fees.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveTab('billing')}
                    className="h-9 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0 min-h-[44px] sm:min-h-0"
                  >
                    View Solo Pro
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-blue-200/60 dark:border-blue-900/40">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block mb-0.5">Shared Toll-Free Line (Current)</span>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Zero setup required. Outbound SMS dispatches from +1 (877) 771-3802. Inbound customer calls ring your normal mobile number.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-blue-200/60 dark:border-blue-900/40">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block mb-0.5">Dedicated Local DID (Solo &amp; Fleet)</span>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Provisions your own exclusive local business number with matching area code. Enables carrier call forwarding (*71) directly from your phone.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Guided Carrier Call Forwarding Setup */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <PhoneForwarded className="w-4 h-4 text-emerald-600" />
                Carrier Call Forwarding Setup
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Route missed or declined calls from your personal cell phone to CaptoDesk automated text-back.
              </p>
            </div>

            {/* How Conditional Call Forwarding Works Callout */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                How Conditional Call Forwarding Works
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                <strong>Will my personal phone stop ringing?</strong> No. Your cell phone rings normally for every incoming call. Only when you are busy on another job, decline a call, or let it ring through does your carrier route the caller to CaptoDesk to trigger the instant text-back. Answered calls never forward.
              </p>
            </div>

            {/* Carrier Selector Pills (44px min height for touch ergonomics) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Select Your Mobile Cellular Carrier:
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'verizon', name: 'Verizon Wireless' },
                  { id: 'att', name: 'AT&T' },
                  { id: 'tmobile', name: 'T-Mobile' },
                  { id: 'prepaid', name: 'Prepaid / MVNO' }
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCarrier(c.id as any)}
                    className={cn(
                      "h-12 sm:h-11 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center text-center cursor-pointer min-h-[44px]",
                      selectedCarrier === c.id
                        ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Carrier Instructions Panel */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-4">
              
              {/* Verizon Panel */}
              {selectedCarrier === 'verizon' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Verizon Wireless Setup Instructions</h4>
                      <p className="text-[11px] text-zinc-500">Feature: Conditional Call Forwarding (No Answer / Busy)</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                      Star Code *71
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Step 1: Activate Forwarding</Label>
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                        *71{cleanForwardingDigits || 'XXXXXXXXXX'}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!cleanForwardingDigits}
                        onClick={() => {
                          if (!cleanForwardingDigits) return
                          navigator.clipboard.writeText(`*71${cleanForwardingDigits}`)
                          setCopiedVerizon(true)
                          toast.success('Verizon activation code copied (*71)')
                          setTimeout(() => setCopiedVerizon(false), 2000)
                        }}
                        className="h-10 px-4 text-xs font-semibold border-zinc-200 dark:border-zinc-700 shrink-0 min-h-[44px]"
                      >
                        {copiedVerizon ? <Check className="h-4 w-4 text-emerald-600 mr-1.5" /> : <Copy className="h-4 w-4 text-zinc-500 mr-1.5" />}
                        {copiedVerizon ? 'Copied Code!' : 'Copy Activation Code'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Open your phone app, dial <strong>*71{cleanForwardingDigits || '[Your Dedicated DID]'}</strong> on the keypad, press Call, wait for 2 confirmation beeps, then hang up.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Step 2: Deactivation Code (When on Vacation)</Label>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">*73</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText('*73')
                          setCopiedDeactivate(true)
                          toast.success('Deactivation code *73 copied')
                          setTimeout(() => setCopiedDeactivate(false), 2000)
                        }}
                        className="h-8 px-2 text-xs min-h-[36px]"
                      >
                        {copiedDeactivate ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 mr-1" />}
                        {copiedDeactivate ? 'Copied *73' : 'Copy *73'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* AT&T Panel */}
              {selectedCarrier === 'att' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">AT&amp;T Mobility Setup Instructions</h4>
                      <p className="text-[11px] text-zinc-500">Feature: Call Forwarding When Unanswered / Busy</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                      Star Code *004*
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Step 1: Activate Forwarding</Label>
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                        *004*{cleanForwardingDigits || 'XXXXXXXXXX'}#
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!cleanForwardingDigits}
                        onClick={() => {
                          if (!cleanForwardingDigits) return
                          navigator.clipboard.writeText(`*004*${cleanForwardingDigits}#`)
                          setCopiedAtt(true)
                          toast.success('AT&T activation code copied (*004*)')
                          setTimeout(() => setCopiedAtt(false), 2000)
                        }}
                        className="h-10 px-4 text-xs font-semibold border-zinc-200 dark:border-zinc-700 shrink-0 min-h-[44px]"
                      >
                        {copiedAtt ? <Check className="h-4 w-4 text-emerald-600 mr-1.5" /> : <Copy className="h-4 w-4 text-zinc-500 mr-1.5" />}
                        {copiedAtt ? 'Copied Code!' : 'Copy Activation Code'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Open your phone app, dial <strong>*004*{cleanForwardingDigits || '[Your Dedicated DID]'}#</strong> on the keypad, press Call, wait for the carrier prompt, then tap Dismiss.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Step 2: Deactivation Code (When on Vacation)</Label>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">##004#</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText('##004#')
                          setCopiedDeactivate(true)
                          toast.success('Deactivation code ##004# copied')
                          setTimeout(() => setCopiedDeactivate(false), 2000)
                        }}
                        className="h-8 px-2 text-xs min-h-[36px]"
                      >
                        {copiedDeactivate ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 mr-1" />}
                        {copiedDeactivate ? 'Copied ##004#' : 'Copy ##004#'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* T-Mobile Panel */}
              {selectedCarrier === 'tmobile' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">T-Mobile &amp; Metro Setup Instructions</h4>
                      <p className="text-[11px] text-zinc-500">Feature: Call Forwarding When No Answer</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                      Star Code **61*
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Step 1: Activate Forwarding</Label>
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                        **61*{cleanForwardingDigits || 'XXXXXXXXXX'}#
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!cleanForwardingDigits}
                        onClick={() => {
                          if (!cleanForwardingDigits) return
                          navigator.clipboard.writeText(`**61*${cleanForwardingDigits}#`)
                          setCopiedTmobile(true)
                          toast.success('T-Mobile activation code copied (**61*)')
                          setTimeout(() => setCopiedTmobile(false), 2000)
                        }}
                        className="h-10 px-4 text-xs font-semibold border-zinc-200 dark:border-zinc-700 shrink-0 min-h-[44px]"
                      >
                        {copiedTmobile ? <Check className="h-4 w-4 text-emerald-600 mr-1.5" /> : <Copy className="h-4 w-4 text-zinc-500 mr-1.5" />}
                        {copiedTmobile ? 'Copied Code!' : 'Copy Activation Code'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Open your phone app, dial <strong>**61*{cleanForwardingDigits || '[Your Dedicated DID]'}#</strong> on the keypad, press Call, wait for the network confirmation banner, then hang up.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Step 2: Deactivation Code (When on Vacation)</Label>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">##61#</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText('##61#')
                          setCopiedDeactivate(true)
                          toast.success('Deactivation code ##61# copied')
                          setTimeout(() => setCopiedDeactivate(false), 2000)
                        }}
                        className="h-8 px-2 text-xs min-h-[36px]"
                      >
                        {copiedDeactivate ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 mr-1" />}
                        {copiedDeactivate ? 'Copied ##61#' : 'Copy ##61#'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Prepaid / MVNO Panel */}
              {selectedCarrier === 'prepaid' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Prepaid &amp; MVNO Carrier Instructions</h4>
                    <p className="text-[11px] text-zinc-500">Mint Mobile, Visible, Cricket Wireless, Metro, Google Fi, Consumer Cellular</p>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                    <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      Many prepaid carriers disable star-code MMI dialing and instead require enabling call forwarding inside their smartphone app:
                    </p>
                    <ul className="space-y-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 list-disc list-inside">
                      <li><strong>Visible:</strong> Dial *71{cleanForwardingDigits || '[Your Dedicated DID]'} or open Visible App &gt; Account &gt; Call Forwarding.</li>
                      <li><strong>Cricket:</strong> Dial *004*{cleanForwardingDigits || '[Your Dedicated DID]'}# or open the myCricket mobile app.</li>
                      <li><strong>Mint Mobile:</strong> Open Mint App &gt; Settings &gt; Call Forwarding, or dial **61*{cleanForwardingDigits || '[Your Dedicated DID]'}#.</li>
                      <li><strong>Google Fi:</strong> Open Google Fi App &gt; Phone Settings &gt; Call Forwarding &gt; Add your CaptoDesk number.</li>
                    </ul>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Forwarding Target: {formatPhoneNumber(effectiveOutboundNumber)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(cleanForwardingDigits || effectiveOutboundNumber)
                          setCopiedPrepaid(true)
                          toast.success('Forwarding target number copied')
                          setTimeout(() => setCopiedPrepaid(false), 2000)
                        }}
                        className="h-9 px-3 text-xs font-semibold min-h-[36px]"
                      >
                        {copiedPrepaid ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 text-zinc-500 mr-1" />}
                        {copiedPrepaid ? 'Copied Number!' : 'Copy Target Number'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3-Step Verification Checklist */}
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  How to Confirm Call Forwarding is Active (3-Step Checklist)
                </span>
                <ol className="text-[11px] text-emerald-900/90 dark:text-emerald-300/90 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Dial the activation star-code above from your cell phone keypad and press Call.</li>
                  <li>Listen for the carrier confirmation tone (1-3 quick beeps or voice prompt) and hang up.</li>
                  <li>Have a friend or secondary phone call your mobile number and decline the call. Verify your secondary phone receives the CaptoDesk automated text-back within 5-10 seconds!</li>
                </ol>
              </div>

              {/* Safety Notice: Copying does not activate */}
              <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Important Carrier Notice:</span>
                  <p className="text-amber-800/90 dark:text-amber-400/90 leading-relaxed">
                    Copying or viewing these instructions does not activate forwarding on your cellular carrier. You must manually dial the code on your phone keypad to activate routing on Verizon, AT&amp;T, or T-Mobile.
                  </p>
                </div>
              </div>

              {/* Dedicated Line Note for Starter Pass */}
              {!hasDedicatedLine && (
                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>
                    Call forwarding star codes require a dedicated business DID. Upgrade to Solo Pro to provision your local number.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('billing')}
                    className="h-8 px-3 text-xs font-semibold shrink-0"
                  >
                    View Plans
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Telecom Deliverability & Carrier SMS Test */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                Live Carrier SMS Deliverability Test
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Verify outbound telecom routing from CaptoDesk to your mobile handset over cellular networks.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                    Registered Destination Handset
                  </span>
                  <div className="text-base font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {formData.owner_phone ? formatPhoneNumber(formData.owner_phone) : 'No mobile number configured'}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Strictly bound to your registered owner mobile phone for security and anti-abuse compliance.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenTestSmsModal}
                  disabled={testingSms || !formData.owner_phone}
                  className="h-11 sm:h-10 px-4 text-xs font-bold border-zinc-200 dark:border-zinc-800 shrink-0 min-h-[44px] flex items-center gap-2"
                >
                  {testingSms ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Send className="h-4 w-4 text-blue-600" />}
                  Test Carrier SMS Deliverability
                </Button>
              </div>

              {/* Feedback Alert if Test Run */}
              {testSmsResult && (
                <div className={cn(
                  "p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in duration-150",
                  testSmsResult.success
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200"
                )}>
                  {testSmsResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-semibold block">
                      {testSmsResult.success ? 'Carrier Test Dispatched Successfully' : 'Carrier Dispatch Notice'}
                    </span>
                    <p className="leading-relaxed text-[11px]">{testSmsResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Homeowner Dispatch Tracking Mode */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600" />
                Homeowner Dispatch Tracking Mode
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Controls what customers see on their live dispatch tracking link when a technician taps &quot;En Route&quot;.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Mode 1: Milestone Status */}
              <div
                onClick={() => setFormData(d => ({ ...d, tracking_mode: 'milestone' }))}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all space-y-2',
                  formData.tracking_mode === 'milestone'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Milestone Status</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Recommended for Privacy
                    </span>
                  </div>
                  {formData.tracking_mode === 'milestone' && <Check className="h-4 w-4 text-blue-600" />}
                </div>

                <div className="p-2 rounded-lg bg-zinc-100/70 dark:bg-zinc-900 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>Scheduled</span>
                  <span>➔</span>
                  <span className="font-bold text-blue-600">En Route (ETA)</span>
                  <span>➔</span>
                  <span>Arrived</span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Homeowners receive real-time stage updates and arrival estimates while keeping your exact vehicle location 100% private.
                </p>

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <strong>Privacy Advantage:</strong> Protects technician privacy when traveling between multiple jobs, running supply errands, or stopping for fuel. No live GPS pin is displayed.
                </div>
              </div>

              {/* Mode 2: Live Geofenced Map */}
              <div
                onClick={() => setFormData(d => ({ ...d, tracking_mode: 'geofence_live' }))}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all space-y-2',
                  formData.tracking_mode === 'geofence_live'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Live Geofenced Map</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      Live Proximity Pin
                    </span>
                  </div>
                  {formData.tracking_mode === 'geofence_live' && <Check className="h-4 w-4 text-blue-600" />}
                </div>

                <div className="p-2 rounded-lg bg-zinc-100/70 dark:bg-zinc-900 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>Vehicle Proximity:</span>
                  <span className="font-bold text-blue-600">{formData.tracking_geofence_miles || 5} Mile Radius</span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Displays an interactive map with your vehicle pin once the technician enters within proximity of the homeowner&apos;s property.
                </p>

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <strong>Driver Privacy Guarantee:</strong> Continuous GPS is strictly suppressed until the driver enters the proximity radius. Tracking links automatically expire upon job completion.
                </div>
              </div>
            </div>

            {/* Geofence Radius Selector (when Live Geofenced Map active) */}
            {formData.tracking_mode === 'geofence_live' && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Proximity Activation Radius:
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { miles: 3, label: '3 Miles (Urban / Dense)' },
                    { miles: 5, label: '5 Miles (Suburban - Recommended)' },
                    { miles: 10, label: '10 Miles (Rural / Extended)' }
                  ].map((rad) => (
                    <button
                      key={rad.miles}
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, tracking_geofence_miles: rad.miles }))}
                      className={cn(
                        "h-10 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer min-h-[44px]",
                        (formData.tracking_geofence_miles || 5) === rad.miles
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 shadow-xs"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      {rad.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card 5: Seasonal Customer Reactivation Autopilot */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-2xs">
            <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-amber-600" />
                  Seasonal Customer Reactivation Autopilot
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Automatically texts past customers 60-90 days after service to win repeat tune-ups, filter replacements, and safety inspections.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <input
                  type="checkbox"
                  id="reactivation_enabled"
                  checked={formData.reactivation_enabled}
                  onChange={e => setFormData(d => ({ ...d, reactivation_enabled: e.target.checked }))}
                  className="rounded bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 h-5 w-5 cursor-pointer min-h-[20px]"
                />
                <Label htmlFor="reactivation_enabled" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                  {formData.reactivation_enabled ? 'Autopilot Active' : 'Autopilot Paused'}
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
                  className="w-full h-11 sm:h-10 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 px-3 focus:outline-none focus:border-blue-500 cursor-pointer font-mono min-h-[44px]"
                >
                  <option value={60}>60 Days Post-Service (Bi-Monthly Tune-Up)</option>
                  <option value={90}>90 Days Post-Service (Quarterly - Recommended)</option>
                  <option value={180}>180 Days Post-Service (Semi-Annual Maintenance)</option>
                  <option value={365}>365 Days Post-Service (Annual Safety Inspection)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">TCPA Quiet-Hours Safeguard</Label>
                <div className="h-11 sm:h-10 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 flex items-center text-xs text-zinc-600 dark:text-zinc-400 gap-2 min-h-[44px]">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Never sends before 9:00 AM or after 7:30 PM in your timezone</span>
                </div>
              </div>

              {/* Customer Eligibility Rules Checklist */}
              <div className="sm:col-span-2 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Automatic Eligibility Safeguards:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Dispatches only to past completed job customers.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Automatically skipped if active booking or pending estimate exists.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Suppressed if customer replied STOP (TCPA compliance).</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>30-day cooldown period prevents repeated messaging.</span>
                  </div>
                </div>
              </div>

              {/* SMS Copy Template Editor */}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Reactivation SMS Copy Template</Label>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {reactivationCharCount} chars • {reactivationSmsSegments} SMS segment{reactivationSmsSegments > 1 ? 's' : ''}
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={formData.reactivation_template}
                  onChange={e => setFormData(d => ({ ...d, reactivation_template: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-mono leading-relaxed"
                />

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-zinc-500 mr-1">Insert Tags:</span>
                  {[
                    { tag: '{customer_name}', label: 'Customer Name' },
                    { tag: '{business_name}', label: 'Business Name' },
                    { tag: '{booking_url}', label: 'Booking URL' }
                  ].map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => {
                        setFormData(d => ({
                          ...d,
                          reactivation_template: `${d.reactivation_template} ${t.tag}`
                        }))
                      }}
                      className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono cursor-pointer transition-colors"
                    >
                      {t.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Interactive Smartphone Preview Bubble */}
              <div className="sm:col-span-2 p-4 rounded-xl bg-zinc-100/70 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                  <span className="font-semibold flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                    Customer Smartphone SMS Preview
                  </span>
                  <span>Today 9:15 AM</span>
                </div>

                <div className="max-w-md bg-blue-600 text-white rounded-2xl rounded-br-xs px-3.5 py-2.5 text-xs shadow-xs leading-relaxed font-sans">
                  {previewReactivationMessage}
                </div>

                <span className="text-[10px] text-zinc-400 block pt-1">
                  Preview substitutes &quot;Sarah&quot; as sample customer and &quot;{formData.name || 'Apex Home Services'}&quot; as your business name.
                </span>
              </div>
            </div>
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYMENTS & ALERTS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-8">

          {/* ======================================================================= */}
          {/* GROUP 1: CUSTOMER PAYMENT METHODS                                       */}
          {/* ======================================================================= */}
          <div className="space-y-5">
            <div className="flex items-start sm:items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-0 shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  1. Customer Payment Methods
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Configure how homeowners pay invoices. Online Stripe card processing automates reconciliation; direct payment links require manual accounting.
                </p>
              </div>
            </div>

            {/* Card 1A: Stripe Connect Credit Card Processing */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    Online Card Processing (Stripe Connect)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Accept Visa, Mastercard, American Express, Apple Pay, and Google Pay on customer invoices.
                  </p>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${stripeConnectionInfo.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    stripeConnectionInfo.status === 'connected' ? 'bg-emerald-500 animate-pulse' :
                    stripeConnectionInfo.status === 'pending' || stripeConnectionInfo.status === 'action_required' ? 'bg-amber-500 animate-pulse' :
                    stripeConnectionInfo.status === 'error' ? 'bg-rose-500' : 'bg-zinc-400'
                  }`} />
                  {stripeConnectionInfo.badgeText}
                </span>
              </div>

              {/* Status explanation */}
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {stripeConnectionInfo.description}
              </p>

              {/* Automatic Invoice Reconciliation Callout */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Automatic Invoice Reconciliation &amp; Daily Bank Payouts
                  </p>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                    Online credit and debit card payments processed through Stripe automatically mark invoices as Paid in real time, trigger instant digital receipts to the homeowner, and deposit funds to your bank account on a 2-day rolling schedule (2.9% + 30¢).
                  </p>
                </div>
              </div>

              {/* Verified Pricing & Entitlements Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-medium">Standard Card Fee</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">2.9% + 30¢</span>
                  <span className="text-[10px] text-zinc-500 block">per successful card</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-medium">CaptoDesk Platform Fee</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">$0.00 / Free</span>
                  <span className="text-[10px] text-zinc-500 block">no hidden markup</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-medium">Bank Transfer Cadence</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">2-Day Rolling</span>
                  <span className="text-[10px] text-zinc-500 block">direct to checking</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-medium">Mobile Wallets</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">Apple &amp; Google Pay</span>
                  <span className="text-[10px] text-zinc-500 block">1-tap instant checkout</span>
                </div>
              </div>

              {/* Connected Account Metadata (if available) */}
              {stripeStatus?.accountId && (
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400">Connected Account:</span>
                    <code className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {stripeStatus.accountId}
                    </code>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${stripeStatus.chargesEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      Charges: <strong className={stripeStatus.chargesEnabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{stripeStatus.chargesEnabled ? 'Enabled' : 'Restricted'}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${stripeStatus.payoutsEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      Payouts: <strong className={stripeStatus.payoutsEnabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{stripeStatus.payoutsEnabled ? 'Enabled' : 'Restricted'}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {stripeConnectionInfo.status === 'connected'
                    ? 'Manage your payout schedules, bank accounts, and tax reporting in Stripe Express.'
                    : 'Connect with Stripe to begin accepting credit cards and mobile wallets on your customer invoices.'}
                </div>

                {stripeConnectionInfo.status === 'connected' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={openingDashboard}
                    onClick={handleOpenStripeDashboard}
                    className="h-11 sm:h-9 text-xs border-zinc-200 dark:border-zinc-800 font-semibold min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                  >
                    {openingDashboard ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                    Open Stripe Express Dashboard
                  </Button>
                ) : stripeConnectionInfo.status === 'action_required' || stripeConnectionInfo.status === 'pending' ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={openingDashboard}
                    onClick={handleOpenStripeDashboard}
                    className="h-11 sm:h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                  >
                    {openingDashboard ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                    Complete Verification in Stripe
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={connectingStripe}
                    onClick={handleConnectStripe}
                    className="h-11 sm:h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                  >
                    {connectingStripe ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CreditCard className="h-3.5 w-3.5 mr-1.5" />}
                    Connect Bank with Stripe
                  </Button>
                )}
              </div>
            </div>

            {/* Card 1B: Direct Homeowner Payment Methods */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-2xs">
              <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Direct Payment Methods (Zelle, Venmo, Cash App, Cash, Check)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Include direct external payment links and remittance instructions on invoices with zero merchant processing fees.
                </p>
              </div>

              {/* Manual Reconciliation Required Alert */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-950 dark:text-amber-100">
                    Manual Reconciliation Required for Direct Links
                  </p>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    Zelle, Venmo, Cash App, PayPal.me, Cash, and Check payments deposit 100% of funds directly to your accounts with $0 platform fees. However, CaptoDesk cannot verify external bank or app deposits automatically. You must manually open the invoice in CaptoDesk and record payment when funds arrive.
                  </p>
                </div>
              </div>

              {/* Quick Preset Buttons for Mobile Contractors */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Quick-Fill Payment Link Presets:</span>
                  {formData.external_payment_url && (
                    <button
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, external_payment_url: '' }))}
                      className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium"
                    >
                      Clear URL
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.external_payment_url.startsWith('https://venmo.com/u/')) {
                        setFormData(d => ({ ...d, external_payment_url: 'https://venmo.com/u/' }))
                      }
                    }}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Venmo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.external_payment_url.startsWith('https://cash.app/$')) {
                        setFormData(d => ({ ...d, external_payment_url: 'https://cash.app/$' }))
                      }
                    }}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Cash App
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.external_payment_url.startsWith('https://paypal.me/')) {
                        setFormData(d => ({ ...d, external_payment_url: 'https://paypal.me/' }))
                      }
                    }}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    PayPal.me
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.payment_instructions.includes('Zelle')) {
                        const base = formData.payment_instructions ? `${formData.payment_instructions}\n` : ''
                        setFormData(d => ({ ...d, payment_instructions: `${base}Zelle: Send payments to ${formData.owner_phone || 'your phone'} or billing@yourdomain.com. Include invoice # in memo.` }))
                      }
                    }}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    + Zelle Note
                  </button>
                </div>
              </div>

              {/* Form Input 1: External Payment URL with Live Validation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    External Payment Web Link (Venmo, Cash App, PayPal.me)
                  </Label>
                  {formData.external_payment_url ? (
                    paymentUrlValidation.isValid ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valid Link Format
                      </span>
                    ) : (
                      <span className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Invalid URL Format
                      </span>
                    )
                  ) : null}
                </div>
                <Input
                  value={formData.external_payment_url}
                  onChange={e => setFormData(d => ({ ...d, external_payment_url: e.target.value }))}
                  placeholder="e.g. https://venmo.com/u/your-handle or https://cash.app/$yourtag"
                  className={`h-11 sm:h-9 bg-white dark:bg-zinc-950 text-sm sm:text-xs min-h-[44px] sm:min-h-0 ${
                    formData.external_payment_url && !paymentUrlValidation.isValid
                      ? 'border-rose-400 dark:border-rose-600 focus-visible:ring-rose-500'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                />
                {!paymentUrlValidation.isValid && paymentUrlValidation.error && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    {paymentUrlValidation.error}
                  </p>
                )}
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Optional: Homeowners clicking this link on digital invoices are redirected directly to your app to complete payment.
                </p>
              </div>

              {/* Form Input 2: Payment Instructions on Invoices */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Payment Instructions on Invoices (Zelle, Check, Cash)
                  </Label>
                  <span className="text-[10px] text-zinc-400">
                    {(formData.payment_instructions || '').length} characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={formData.payment_instructions}
                  onChange={e => setFormData(d => ({ ...d, payment_instructions: e.target.value }))}
                  placeholder="e.g. Zelle payments to billing@apexservices.com. Checks payable to Apex Home Services LLC. Please reference invoice # on check memo."
                  className="w-full p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Printed prominently at the bottom of customer invoices and online payment portals.
                </p>
              </div>

              {/* Live Customer-Facing Invoice Screen Preview */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Homeowner Mobile Screen Preview
                  </span>
                  <span className="text-[11px] text-zinc-400">What your customer sees</span>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800 text-xs">
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                        {formData.name || 'Apex Home Services'}
                      </span>
                      <span className="text-[10px] text-zinc-500">Invoice #INV-1042</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block">Amount Due</span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">$275.00</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Option 1: Stripe Card / Apple Pay (if connected) */}
                    {stripeConnectionInfo.status === 'connected' ? (
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Pay with Card or Apple Pay</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                          Instant Auto-Receipt
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-zinc-400" />
                          Card Payments
                        </span>
                        <span className="text-[10px] text-zinc-400">Not connected</span>
                      </div>
                    )}

                    {/* Option 2: External Payment Link */}
                    {formData.external_payment_url && paymentUrlValidation.isValid ? (
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {formData.external_payment_url.includes('venmo') ? 'Pay via Venmo' :
                             formData.external_payment_url.includes('cash.app') ? 'Pay via Cash App' :
                             formData.external_payment_url.includes('paypal') ? 'Pay via PayPal' : 'Pay via Direct App'}
                          </span>
                        </div>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-0.5">
                          Direct App <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    ) : null}

                    {/* Payment Instructions Box */}
                    {formData.payment_instructions ? (
                      <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Remittance Instructions:
                        </span>
                        <p className="text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {formData.payment_instructions}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 text-center italic">
                        No custom payment instructions provided. Enter instructions above to guide check and Zelle payments.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* GROUP 2: OWNER NOTIFICATIONS & BUSINESS REPORTS                         */}
          {/* ======================================================================= */}
          <div className="space-y-5 pt-2">
            <div className="flex items-start sm:items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  2. Owner Notifications &amp; Business Reports
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Configure instant mobile push alerts for customer activity and schedule your Monday morning executive business summary.
                </p>
              </div>
            </div>

            {/* Card 2A: Device Push Alerts Component */}
            <PushNotificationSettings />

            {/* Card 2B: Monday Morning Executive Summary SMS */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    Monday Morning Executive Summary SMS
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Dispatches a weekly performance digest every Monday morning to keep you informed on jobs, revenue, and caller recoveries.
                  </p>
                </div>

                {/* Accessible Full-Width / Full-Touch Switch Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.weekly_digest_enabled}
                  onClick={() => setFormData(d => ({ ...d, weekly_digest_enabled: !d.weekly_digest_enabled }))}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors min-h-[44px] sm:min-h-0 shrink-0 ${
                    formData.weekly_digest_enabled
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${formData.weekly_digest_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                  {formData.weekly_digest_enabled ? 'Active • Mondays 8:00 AM' : 'Summary Paused'}
                </button>
              </div>

              {/* Schedule and Recipient Delivery Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                    Automated Schedule
                  </span>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Every Monday at 8:00 AM Local Time
                  </div>
                  <span className="text-[11px] text-zinc-500 block">
                    Calculated in your business timezone ({formData.timezone || 'America/Chicago'}).
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                    Target Recipient Phone
                  </span>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    {formData.owner_phone ? formatPhoneNumber(formData.owner_phone) : 'Mobile phone not configured'}
                  </div>
                  <span className="text-[11px] text-zinc-500 block">
                    {formData.owner_phone ? 'Direct SMS text message delivery.' : 'Add your number in Business Profile.'}
                  </span>
                </div>
              </div>

              {/* Safety Guarantee Notice */}
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Automated Safety Guarantee</p>
                  <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                    CaptoDesk will NEVER send a real summary when saving settings or opening this page. Automated dispatches execute strictly on Monday mornings. To verify formatting right now, use the preview button below.
                  </p>
                </div>
              </div>

              {/* Weekly Digest Metrics Included */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Metrics Calculated in Weekly Digest:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-zinc-800 dark:text-zinc-200">Completed jobs &amp; gross revenue</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2">
                    <PhoneCall className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-zinc-800 dark:text-zinc-200">Missed calls recovered via SMS</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-zinc-800 dark:text-zinc-200">5-star Google review invitations</span>
                  </div>
                </div>
              </div>

              {/* Preview Action Row */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                <div className="text-[11px] text-zinc-500">
                  Confirm how the Monday morning summary appears on your mobile handset before live dispatch.
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!formData.owner_phone}
                  onClick={() => setPreviewDigestModalOpen(true)}
                  className="h-11 sm:h-9 text-xs border-zinc-200 dark:border-zinc-800 font-semibold shrink-0 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                  Send Monday Summary Preview
                </Button>
              </div>
            </div>
          </div>

        </div>
      )}
      </div>

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
        title={selectedTargetPlan?.amount === 0 ? 'Downgrade to Free Starter Pass' : `Switch to ${selectedTargetPlan?.name || 'Selected Plan'}`}
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
              Your dedicated business phone line and automated text-back will be paused at the end of the current billing cycle. You will keep your Free Starter Pass with unlimited online customer bookings, calendar scheduling, customer CRM, and job photos with $0 platform fees.
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

      {/* RECEIPT / INVOICE MODAL */}
      <Modal
        open={Boolean(viewingReceipt)}
        onOpenChange={(open) => {
          if (!open) setViewingReceipt(null)
        }}
        title="Payment Receipt & Tax Invoice"
        description="Official CaptoDesk subscription transaction record."
        size="md"
      >
        {viewingReceipt && (
          <div className="space-y-5 py-2">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    CaptoDesk Technologies, Inc.
                  </h4>
                  <p className="text-[11px] text-zinc-500">Subscription &amp; Platform Billing</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3 text-emerald-600" /> Paid
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase font-bold block">Billed To</span>
                  <strong className="text-zinc-800 dark:text-zinc-200 block truncate">
                    {billingData?.organization?.legal_business_name || billingData?.organization?.name || formData.name || 'Account Owner'}
                  </strong>
                  {billingData?.organization?.ein && (
                    <span className="text-[11px] text-zinc-500 font-mono block">EIN: {billingData.organization.ein}</span>
                  )}
                  {billingData?.organization?.address_street && (
                    <span className="text-[11px] text-zinc-500 block">{billingData.organization.address_street}</span>
                  )}
                </div>

                <div>
                  <span className="text-zinc-400 text-[10px] uppercase font-bold block">Payment Details</span>
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono block">
                    Date: {new Date(viewingReceipt.payment_date || viewingReceipt.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono block truncate">
                    Ref: {viewingReceipt.provider_payment_reference || viewingReceipt.id}
                  </span>
                  <span className="text-[11px] text-zinc-500 block capitalize">
                    Gateway: {viewingReceipt.provider || billingData?.billingProvider || 'Card Processing'}
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-200/80 dark:border-zinc-800 pt-3">
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                    {viewingReceipt.notes || viewingReceipt.description || 'Monthly SaaS Subscription'}
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                    ${viewingReceipt.amount ? Number(viewingReceipt.amount).toFixed(2) : '0.00'} {viewingReceipt.currency || 'USD'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-t border-zinc-200/60 dark:border-zinc-800/60 mt-2 pt-2 font-bold">
                  <span className="text-zinc-900 dark:text-zinc-100">Total Paid</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                    ${viewingReceipt.amount ? Number(viewingReceipt.amount).toFixed(2) : '0.00'} {viewingReceipt.currency || 'USD'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingReceipt(null)}
                className="h-9 text-xs border-zinc-200 dark:border-zinc-800"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
                className="h-9 text-xs bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* CARRIER TEST SMS AUTHORIZATION MODAL */}
      <Modal
        open={testSmsModalOpen}
        onOpenChange={setTestSmsModalOpen}
        title="Confirm Carrier SMS Deliverability Test"
        description="Dispatches a real carrier test text message to verify routing and telecom deliverability."
        size="md"
      >
        <div className="space-y-4 py-2">
          {/* Target & Sender Information */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Recipient Handset:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {formData.owner_phone ? formatPhoneNumber(formData.owner_phone) : 'Unset'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2">
              <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Outbound Sender Route:</span>
              <div className="text-right">
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 block">
                  {formatPhoneNumber(effectiveOutboundNumber)}
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  {hasDedicatedLine ? 'Dedicated Local Line (Direct Route)' : 'CaptoDesk Verified Toll-Free'}
                </span>
              </div>
            </div>
          </div>

          {/* Cellular Network Disclosure */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Live Carrier Network Dispatch</span>
              <p className="text-[11px] text-blue-900/90 dark:text-blue-300/90 leading-relaxed">
                This test dispatches an authentic SMS over Tier-1 cellular carrier routes (via Telnyx) to verify carrier delivery, handset reception, and 10DLC registration. Standard mobile carrier text rates may apply to your cellular plan.
              </p>
            </div>
          </div>

          {/* Explicit User Authorization */}
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="test_sms_auth"
              checked={testSmsAuthorized}
              onChange={e => setTestSmsAuthorized(e.target.checked)}
              className="rounded bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 h-4 w-4 cursor-pointer mt-0.5 shrink-0"
            />
            <Label htmlFor="test_sms_auth" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer leading-relaxed">
              I authorize CaptoDesk to send a live carrier test SMS to my mobile number (<strong>{formatPhoneNumber(formData.owner_phone)}</strong>).
            </Label>
          </div>

          {/* Session Result Feedback */}
          {testSmsResult && (
            <div className={cn(
              "p-3 rounded-lg border text-xs flex items-start gap-2",
              testSmsResult.success
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                : "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200"
            )}>
              {testSmsResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <p className="leading-relaxed text-[11px]">{testSmsResult.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestSmsModalOpen(false)}
              className="h-10 sm:h-9 text-xs border-zinc-200 dark:border-zinc-800 min-h-[44px] sm:min-h-0"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!testSmsAuthorized || testingSms}
              onClick={handleExecuteTestSms}
              className="h-10 sm:h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[44px] sm:min-h-0 flex items-center gap-1.5"
            >
              {testingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {testingSms ? 'Dispatching Test SMS...' : 'Authorize & Send Test SMS'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MONDAY SUMMARY PREVIEW CONFIRMATION MODAL */}
      <Modal
        open={previewDigestModalOpen}
        onOpenChange={setPreviewDigestModalOpen}
        title="Send Monday Summary Preview"
        description="Verify formatting and SMS delivery of your weekly executive performance digest."
        size="sm"
      >
        <div className="space-y-4 py-2">
          {/* Recipient info box */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Target Recipient:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                {formData.owner_phone ? formatPhoneNumber(formData.owner_phone) : 'Unset'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Scheduled Delivery:</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Mondays 8:00 AM ({formData.timezone || 'America/Chicago'})
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                Immediate Sample Simulation
              </p>
              <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                This preview sends simulated performance data to your mobile phone right now to verify carrier delivery. Live digests run strictly on Monday mornings without manual intervention.
              </p>
            </div>
          </div>

          {/* Simulated SMS Message Preview */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
              Sample Text Message:
            </span>
            <div className="p-3 rounded-lg bg-zinc-900 text-zinc-100 text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-inner border border-zinc-800">
              {`[CaptoDesk Weekly Summary]\n${formData.name || 'Apex Home Services'} - Week of Nov 17\n• Completed Jobs: 6 ($4,850 rev)\n• Calls Captured: 14 (3 recovered via SMS)\n• Google Reviews: 2 new 5-star ratings\nLog in: captodesk.com/client`}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewDigestModalOpen(false)}
              className="h-10 sm:h-9 text-xs border-zinc-200 dark:border-zinc-800 min-h-[44px] sm:min-h-0"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={testingDigest || !formData.owner_phone}
              onClick={handleTestDigest}
              className="h-10 sm:h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[44px] sm:min-h-0 flex items-center gap-1.5"
            >
              {testingDigest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {testingDigest ? 'Dispatching Preview SMS...' : 'Dispatch Preview SMS'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* STICKY BOTTOM SAVE BAR FOR MOBILE (Phase 4) - Elevated above h-16 mobile navigation bar */}
      {isDirty && activeTab !== 'billing' && (
        <div className="fixed bottom-16 inset-x-0 z-50 p-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-xl flex items-center justify-between gap-3 sm:hidden animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              Unsaved changes
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              className="h-10 px-3 text-xs border-zinc-200 dark:border-zinc-700 min-h-[44px]"
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !canEdit}
              size="sm"
              className="h-10 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[44px]"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
