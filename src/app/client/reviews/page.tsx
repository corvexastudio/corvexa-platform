'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/context/workspace-context'
import { FoundMoneyUnlockModal } from '@/components/billing/found-money-unlock-modal'
import { 
  Star, 
  Send, 
  ExternalLink, 
  Loader2, 
  MousePointerClick, 
  CheckCircle2, 
  Settings, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  Phone, 
  MessageSquare, 
  AlertCircle, 
  Check, 
  Users,
  QrCode,
  Copy,
  Search,
  Smartphone,
  CheckCheck,
  Wrench,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  RefreshCw,
  Plus
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { TRADE_REVIEW_TEMPLATES, type TradeReviewTemplate } from '@/lib/constants/trade-review-templates'
import { formatCustomerName } from '@/lib/booking/customer-input-formatter'
import { formatNationalUs } from '@/lib/telephony/phone-normalizer'

interface ReviewRequestItem {
  id: string
  token: string
  google_review_url: string
  status: 'pending' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'clicked' | 'suppressed'
  delivery_status: string
  sent_at?: string
  clicked_at?: string
  click_count: number
  suppression_reason?: string
  contacts?: { name?: string; phone: string; opt_out?: boolean }
  jobs?: { job_number: string; title: string }
  created_at: string
}

interface CustomerFeedbackItem {
  id: string
  org_id: string
  job_id?: string
  contact_id?: string
  rating: number
  feedback_text: string
  customer_name?: string
  customer_phone?: string
  resolved: boolean
  resolved_at?: string
  resolution_notes?: string
  created_at: string
  updated_at?: string
}

interface CustomerItem {
  id: string
  name: string
  phone: string
  opt_out?: boolean
}

function getReviewStatusBadge(status: string) {
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCheck className="w-3 h-3" />
          <span>Delivered</span>
        </span>
      )
    case 'clicked':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <MousePointerClick className="w-3 h-3" />
          <span>Opened</span>
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
          <Check className="w-3 h-3" />
          <span>Sent</span>
        </span>
      )
    case 'pending':
    case 'scheduled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" />
          <span>Scheduled</span>
        </span>
      )
    case 'suppressed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
          <ShieldAlert className="w-3 h-3" />
          <span>Suppressed</span>
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-3 h-3" />
          <span>Failed</span>
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
          {status}
        </span>
      )
  }
}

function formatSuppressionReason(reason?: string): string {
  if (!reason) return 'Invitation suppressed by rule.'
  const lower = reason.toLowerCase()
  if (lower.includes('cooldown')) return 'Customer was already contacted within the 60-day cooldown window.'
  if (lower.includes('opt_out') || lower.includes('opted_out') || lower.includes('opted out')) return 'Customer has opted out of promotional SMS messages.'
  if (lower.includes('invalid_phone') || lower.includes('phone')) return 'Customer phone number is invalid or not SMS-capable.'
  if (lower.includes('starter_limit') || lower.includes('starter pass')) return 'Starter Pass free-job limit reached. Paid plan required.'
  if (lower.includes('quiet_hours')) return 'Held until morning 8:05 AM local time (TCPA quiet hours compliance).'
  if (lower.includes('disabled')) return 'Review automations are currently disabled in settings.'
  if (lower.includes('cancelled')) return 'The linked job was cancelled.'
  return reason
}

// 5-Category Organization for 22 Trade Presets
const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All Trades' },
  { id: 'general', label: 'General' },
  { id: 'mechanical', label: 'Mechanical' },
  { id: 'exterior', label: 'Exterior' },
  { id: 'finishes', label: 'Finishes' },
  { id: 'specialty', label: 'Specialty' }
] as const

type TemplateCategoryType = typeof TEMPLATE_CATEGORIES[number]['id']

function mapTradeToCategoryGroup(cat: string): TemplateCategoryType {
  const c = cat.toLowerCase()
  if (c === 'universal' || c === 'general') return 'general'
  if (c === 'mechanical') return 'mechanical'
  if (c === 'exterior' || c === 'outdoor') return 'exterior'
  if (c === 'finishes' || c === 'structure') return 'finishes'
  return 'specialty'
}

export default function ReviewsPage() {
  const { operationMode } = useWorkspace()
  const [showFoundMoneyModal, setShowFoundMoneyModal] = useState(false)
  const [gatedCustomerName, setGatedCustomerName] = useState<string>('Customer')
  const [activeTab, setActiveTab] = useState<'reviews' | 'feedback'>('reviews')
  const [metrics, setMetrics] = useState({
    totalSent: 0,
    totalDelivered: 0,
    totalClicked: 0,
    totalSuppressed: 0,
    clickRate: 0
  })
  const [settings, setSettings] = useState({
    businessName: 'Our Service Team',
    googleReviewUrl: '',
    reviewRequestsEnabled: true,
    delayHours: 24,
    cooldownDays: 60
  })
  const [requests, setRequests] = useState<ReviewRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Quick Google URL configuration state (when missing)
  const [quickGoogleUrl, setQuickGoogleUrl] = useState('')
  const [savingQuickUrl, setSavingQuickUrl] = useState(false)

  // Direct Customer Feedback state
  const [feedbackList, setFeedbackList] = useState<CustomerFeedbackItem[]>([])
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [resolvingItem, setResolvingItem] = useState<CustomerFeedbackItem | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [savingResolution, setSavingResolution] = useState(false)

  // Focused Request Detail Modal
  const [selectedRequest, setSelectedRequest] = useState<ReviewRequestItem | null>(null)

  // Focused Send Review Invitation Drawer / Modal
  const [showSendModal, setShowSendModal] = useState(false)
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [customerOptOut, setCustomerOptOut] = useState<boolean | undefined>(undefined)

  // Trade Template Selector State
  const [selectedTrade, setSelectedTrade] = useState<string>('general')
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<TemplateCategoryType>('all')
  const [templateSearchQuery, setTemplateSearchQuery] = useState('')
  const [customMessage, setCustomMessage] = useState<string>(
    TRADE_REVIEW_TEMPLATES[0].template
  )
  const [showPhonePreviewOnMobile, setShowPhonePreviewOnMobile] = useState(false)
  const [sending, setSending] = useState(false)

  // Customer List
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // Request list filter & search
  const [requestFilter, setRequestFilter] = useState<'all' | 'delivered' | 'clicked' | 'scheduled' | 'suppressed'>('all')
  const [requestSearch, setRequestSearch] = useState('')

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId)
    if (!customerId) {
      setName('')
      setPhone('')
      setCustomerOptOut(undefined)
      return
    }
    const cust = customers.find(c => c.id === customerId)
    if (cust) {
      setName(cust.name || '')
      setCustomerOptOut(cust.opt_out)
      const digits = (cust.phone || '').replace(/\D/g, '')
      const match = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/)
      if (match) {
        setPhone(`(${match[1]}) ${match[2]}-${match[3]}`)
      } else {
        setPhone(cust.phone || '')
      }
    }
  }

  const handleSelectTrade = (tradeId: string) => {
    setSelectedTrade(tradeId)
    const found = TRADE_REVIEW_TEMPLATES.find(t => t.id === tradeId)
    if (found) {
      setCustomMessage(found.template)
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/reviews')
      if (res.ok) {
        const data = await res.json()
        setMetrics(data.metrics || {})
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            ...data.settings
          }))
          setQuickGoogleUrl(data.settings.googleReviewUrl || '')
        }
        setRequests(data.requests || [])
      } else if (res.status === 403) {
        const err = await res.json().catch(() => ({}))
        if (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization')) {
          window.location.href = '/client/onboarding'
          return
        }
      }
    } catch (err) {
      console.error('Error fetching review data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/client/feedback')
      if (res.ok) {
        const data = await res.json()
        setFeedbackList(data.feedback || [])
        setUnresolvedCount(data.unresolvedCount || 0)
      }
    } catch (err) {
      console.error('Error fetching customer feedback:', err)
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    loadFeedback()

    // Load customer contacts for review invite lookup
    setLoadingCustomers(true)
    fetch('/api/client/customers?limit=100')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.customers) {
          setCustomers(data.customers.filter((c: any) => c.phone))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCustomers(false))

    // Handle deep linked tabs
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('tab') === 'feedback') {
        setActiveTab('feedback')
      }
    }
  }, [loadData, loadFeedback])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!settings.googleReviewUrl?.trim()) {
      toast.error('Google Review URL is required before sending review invites. Please configure it below.')
      return
    }
    const cleanDigits = phone.replace(/\D/g, '')
    if (cleanDigits.length < 10) {
      toast.error('Enter a valid 10-digit cell phone number.')
      return
    }
    if (customerOptOut) {
      toast.error('This customer has opted out of SMS messages and cannot receive review invitations.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim() || 'Valued Customer', 
          phone,
          message: customMessage.trim()
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Review invitation sent to ${name.trim() || phone}`)
        setName('')
        setPhone('')
        setSelectedCustomerId('')
        setCustomerOptOut(undefined)
        setShowSendModal(false)
        loadData()
      } else {
        if (res.status === 402 || data.upgradeRequired) {
          setGatedCustomerName(name.trim() || 'Customer')
          setShowFoundMoneyModal(true)
          return
        }
        toast.error(data.error || 'Failed to dispatch review invite.')
      }
    } catch {
      toast.error('Network error dispatching invite.')
    } finally {
      setSending(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await fetch('/api/client/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast.success('Review automation settings updated')
        setShowSettingsModal(false)
        loadData()
      } else {
        toast.error('Failed to update settings.')
      }
    } catch {
      toast.error('Network error saving settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleQuickSaveGoogleUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickGoogleUrl.trim()) {
      toast.error('Please enter a valid Google review link.')
      return
    }
    setSavingQuickUrl(true)
    try {
      const res = await fetch('/api/client/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleReviewUrl: quickGoogleUrl.trim() }),
      })
      if (res.ok) {
        toast.success('Google Review URL saved successfully')
        setSettings(s => ({ ...s, googleReviewUrl: quickGoogleUrl.trim() }))
        loadData()
      } else {
        toast.error('Failed to save Google review URL.')
      }
    } catch {
      toast.error('Network error saving Google review URL.')
    } finally {
      setSavingQuickUrl(false)
    }
  }

  const handleResolveFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingItem) return
    setSavingResolution(true)
    try {
      const res = await fetch('/api/client/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolvingItem.id,
          resolved: true,
          resolutionNotes: resolutionNotes.trim()
        })
      })
      if (res.ok) {
        toast.success('Customer feedback marked as resolved')
        setResolvingItem(null)
        setResolutionNotes('')
        loadFeedback()
      } else {
        toast.error('Failed to update feedback resolution.')
      }
    } catch {
      toast.error('Network error updating feedback.')
    } finally {
      setSavingResolution(false)
    }
  }

  const handleCopyReviewLink = () => {
    if (!settings.googleReviewUrl) return
    navigator.clipboard.writeText(settings.googleReviewUrl)
    setCopiedLink(true)
    toast.success('Google Review link copied to clipboard')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Interpolated preview text for phone preview
  const livePreviewText = useMemo(() => {
    const businessName = settings.businessName || 'Our Service Team'
    const previewUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/preview` : 'https://app.captodesk.com/r/preview'
    return customMessage
      .replace(/\{business_name\}|\{\{business_name\}\}/g, businessName)
      .replace(/\{review_link\}|\{review_url\}|\{\{review_link\}\}|\{\{review_url\}\}/g, previewUrl)
  }, [customMessage, settings.businessName])

  const smsCharCount = livePreviewText.length
  const smsSegments = Math.ceil(smsCharCount / 160) || 1

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Status filter
      if (requestFilter === 'delivered' && req.status !== 'delivered' && req.status !== 'clicked') return false
      if (requestFilter === 'clicked' && req.status !== 'clicked' && !(req.click_count > 0)) return false
      if (requestFilter === 'scheduled' && req.status !== 'scheduled' && req.status !== 'pending') return false
      if (requestFilter === 'suppressed' && req.status !== 'suppressed') return false

      // Search filter
      if (requestSearch.trim()) {
        const query = requestSearch.toLowerCase()
        const customerName = (req.contacts?.name || '').toLowerCase()
        const customerPhone = (req.contacts?.phone || '').toLowerCase()
        const jobNumber = (req.jobs?.job_number || '').toLowerCase()
        const jobTitle = (req.jobs?.title || '').toLowerCase()
        if (!customerName.includes(query) && !customerPhone.includes(query) && !jobNumber.includes(query) && !jobTitle.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [requests, requestFilter, requestSearch])

  const filteredFeedback = useMemo(() => {
    return feedbackList.filter(item => {
      if (feedbackFilter === 'unresolved') return !item.resolved
      if (feedbackFilter === 'resolved') return item.resolved
      return true
    })
  }, [feedbackList, feedbackFilter])

  // Filtered trade templates for drawer
  const filteredTemplates = useMemo(() => {
    return TRADE_REVIEW_TEMPLATES.filter(template => {
      // Category filter
      if (templateCategoryFilter !== 'all') {
        const group = mapTradeToCategoryGroup(template.category)
        if (group !== templateCategoryFilter) return false
      }
      // Search filter
      if (templateSearchQuery.trim()) {
        const q = templateSearchQuery.toLowerCase()
        return (
          template.name.toLowerCase().includes(q) ||
          template.shortName.toLowerCase().includes(q) ||
          template.template.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [templateCategoryFilter, templateSearchQuery])

  // Filtered customers for selector
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers
    const q = customerSearchQuery.toLowerCase()
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    )
  }, [customers, customerSearchQuery])

  // Delivery rate
  const deliveryRate = metrics.totalSent > 0 ? Math.round((metrics.totalDelivered / metrics.totalSent) * 100) : 0

  return (
    <div className="space-y-6">

      {/* Page Header (Mobile-First Polish) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Reviews &amp; Reputation
            </h1>

            {settings.googleReviewUrl ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Google Profile Linked</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <AlertCircle className="w-3 h-3" />
                <span>Missing Google Review Link</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Collect verified Google reviews and handle direct customer feedback.
          </p>
        </div>

        {/* Header Actions Row */}
        <div className="flex flex-wrap items-center gap-2">
          {settings.googleReviewUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQrModal(true)}
              className="h-10 px-3.5 text-xs font-semibold border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-xs cursor-pointer min-h-[44px]"
            >
              <QrCode className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
              <span>QR Code &amp; Link</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsModal(true)}
            className="h-10 px-3.5 text-xs font-semibold border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-xs cursor-pointer min-h-[44px]"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5 text-slate-500 dark:text-zinc-400" />
            <span>Rules &amp; Cooldown</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowSendModal(true)}
            disabled={!settings.googleReviewUrl?.trim()}
            className="h-10 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            <span>Send Review Invite</span>
          </Button>
        </div>
      </div>

      {/* Operational Metrics Row (4 Tabular Metric Tokens) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-3.5 shadow-xs">
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Invitations Sent</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{loading ? '-' : metrics.totalSent}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">Post-job &amp; manual SMS</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-3.5 shadow-xs">
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Carrier Delivered</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">{loading ? '-' : metrics.totalDelivered}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 tabular-nums truncate">{loading ? '-' : `${deliveryRate}% carrier delivery`}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-3.5 shadow-xs">
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Verified Clicks</p>
          <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-1">{loading ? '-' : metrics.totalClicked}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 tabular-nums truncate">{loading ? '-' : `${metrics.clickRate}% CTR to Google`}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-3.5 shadow-xs">
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Direct Customer Feedback</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{feedbackLoading ? '-' : feedbackList.length}</p>
          <p className="text-[10px] sm:text-[11px] mt-0.5 font-medium truncate">
            {unresolvedCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{unresolvedCount} need follow-up</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">All feedback resolved</span>
            )}
          </p>
        </div>
      </div>

      {/* Google Review Setup Banner / Status Card */}
      {!settings.googleReviewUrl?.trim() && !loading ? (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Google Business Review Link Required
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                Review invitation messages include a verified redirect link pointing directly to your Google Business Profile. Add your review link to unlock automated and one-off review dispatches.
              </p>
              <div className="pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                <span>1. Open Google Business Profile</span>
                <span>•</span>
                <span>2. Tap "Ask for reviews"</span>
                <span>•</span>
                <span>3. Paste your short link below</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleQuickSaveGoogleUrl} className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <Input
              type="url"
              placeholder="https://g.page/r/your-review-shortlink/review"
              value={quickGoogleUrl}
              onChange={e => setQuickGoogleUrl(e.target.value)}
              className="h-10 text-xs bg-white dark:bg-zinc-950 border-amber-300 dark:border-amber-700/80 rounded-lg text-slate-900 dark:text-zinc-100"
            />
            <Button
              type="submit"
              size="sm"
              disabled={savingQuickUrl || !quickGoogleUrl.trim()}
              className="h-10 px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-xs cursor-pointer min-h-[44px]"
            >
              {savingQuickUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              <span>Save Review Link</span>
            </Button>
          </form>
        </div>
      ) : settings.googleReviewUrl ? (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                Active Google Destination: <span className="font-mono text-slate-600 dark:text-zinc-400 font-normal">{settings.googleReviewUrl}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Customers tapping review links on tracking pages or SMS are forwarded here.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyReviewLink}
              className="h-8 px-2.5 text-[11px] font-semibold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
            >
              {copiedLink ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1 text-slate-400" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </Button>

            <a
              href={settings.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white transition-colors"
            >
              <span>Test</span>
              <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
            </a>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-1"
            >
              Edit
            </button>
          </div>
        </div>
      ) : null}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none bg-slate-100 dark:bg-zinc-900/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[40px]",
            activeTab === 'reviews'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", activeTab === 'reviews' ? "text-amber-500 fill-amber-500" : "text-slate-400 dark:text-zinc-500")} />
          <span>Google Review Invites</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 tabular-nums">
            {requests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors relative cursor-pointer min-h-[40px]",
            activeTab === 'feedback'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <ShieldAlert className={cn("h-3.5 w-3.5", activeTab === 'feedback' ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-zinc-500")} />
          <span>Direct Customer Feedback</span>
          {unresolvedCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              <span>{unresolvedCount}</span>
              <span className="hidden sm:inline">Urgent</span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 tabular-nums">
              {feedbackList.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: GOOGLE REVIEW INVITES & HISTORY */}
      {activeTab === 'reviews' && (
        <div className="space-y-5">

          {/* Quick Send Banner for Mobile (prominently visible) */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 shadow-2xs">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Send Review Invitation</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Dispatch an SMS invite with your verified Google review link and trade message.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setShowSendModal(true)}
              disabled={!settings.googleReviewUrl?.trim()}
              className="min-h-[44px] px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              <span>Send Invite</span>
            </Button>
          </div>

          {/* Outbound Review Requests History Card */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            
            {/* Filter and Search Bar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Review Invitations Feed
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Carrier delivery tracking, suppression audits, and Google link clicks.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search customer, phone, job..."
                    value={requestSearch}
                    onChange={e => setRequestSearch(e.target.value)}
                    className="h-9 pl-8 pr-2.5 text-xs w-48 sm:w-56 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100"
                  />
                  {requestSearch && (
                    <button
                      type="button"
                      onClick={() => setRequestSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                  {[
                    { id: 'all', label: 'All', count: requests.length },
                    { id: 'delivered', label: 'Delivered', count: requests.filter(r => r.status === 'delivered' || r.status === 'clicked').length },
                    { id: 'clicked', label: 'Clicked', count: requests.filter(r => r.status === 'clicked' || r.click_count > 0).length },
                    { id: 'scheduled', label: 'Scheduled', count: requests.filter(r => r.status === 'scheduled' || r.status === 'pending').length },
                    { id: 'suppressed', label: 'Suppressed', count: requests.filter(r => r.status === 'suppressed').length }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRequestFilter(tab.id as any)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[32px]",
                        requestFilter === tab.id
                          ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      {tab.label}
                      <span className="ml-1 opacity-70 tabular-nums">({tab.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                    <Skeleton className="h-4 w-36 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-28 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-16 bg-slate-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Star}
                  title={requestSearch || requestFilter !== 'all' ? "No Matching Review Invitations" : "No Review Invitations Sent Yet"}
                  description={
                    requestSearch || requestFilter !== 'all'
                      ? "Try adjusting your search query or status filter."
                      : "Review invitations are dispatched automatically when field jobs are completed, or you can send one directly using the Send Review Invite button above."
                  }
                  actionLabel={requestSearch ? "Clear Filter" : "Send First Invite"}
                  onAction={() => {
                    if (requestSearch) {
                      setRequestSearch('')
                      setRequestFilter('all')
                    } else {
                      setShowSendModal(true)
                    }
                  }}
                />
              </div>
            ) : (
              <div>
                {/* Desktop Table View (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800">
                      <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Customer</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Job Reference</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Status</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Dispatched</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4 text-center">Google Clicks</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredRequests.map(req => (
                        <TableRow 
                          key={req.id} 
                          onClick={() => setSelectedRequest(req)}
                          className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                        >
                          <TableCell className="py-3 px-4">
                            <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                              {formatCustomerName(req.contacts?.name) || 'Customer'}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                              {req.contacts?.phone ? formatNationalUs(req.contacts.phone) : '-'}
                            </div>
                          </TableCell>

                          <TableCell className="py-3 px-4 text-xs text-slate-700 dark:text-zinc-300">
                            {req.jobs ? (
                              <span className="font-medium text-slate-900 dark:text-zinc-100">
                                {req.jobs.job_number} <span className="text-slate-400">·</span> {req.jobs.title}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-zinc-400 italic">One-Off Invite</span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 px-4">
                            {getReviewStatusBadge(req.status)}
                            {req.suppression_reason && (
                              <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5 truncate max-w-xs" title={req.suppression_reason}>
                                {req.suppression_reason}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                            {req.sent_at ? new Date(req.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                          </TableCell>

                          <TableCell className="py-3 px-4 text-center font-semibold text-xs tabular-nums">
                            {req.click_count > 0 ? (
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded">
                                <MousePointerClick className="w-3 h-3" />
                                <span>{req.click_count}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-600">0</span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 px-4 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedRequest(req)
                              }}
                              className="h-8 px-2.5 text-xs border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Touch Cards (< 768px) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredRequests.map(req => {
                    const phoneDisplay = req.contacts?.phone ? formatNationalUs(req.contacts.phone) : '-'
                    return (
                      <div 
                        key={req.id} 
                        className="p-3.5 sm:p-4 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">
                              {formatCustomerName(req.contacts?.name) || 'Customer'}
                            </h3>
                            {req.contacts?.phone ? (
                              <a
                                href={`tel:${req.contacts.phone}`}
                                className="text-[11px] text-blue-600 dark:text-blue-400 font-mono font-semibold tabular-nums hover:underline flex items-center gap-1 mt-0.5"
                                title="Call customer"
                              >
                                <Smartphone className="h-3 w-3" />
                                <span>{phoneDisplay}</span>
                              </a>
                            ) : (
                              <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">-</p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {getReviewStatusBadge(req.status)}
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-zinc-400 flex flex-wrap items-center gap-1.5">
                          {req.jobs ? (
                            <span className="font-medium text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px]">
                              Job #{req.jobs.job_number} : {req.jobs.title}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">One-Off Invite</span>
                          )}
                        </div>

                        {req.suppression_reason && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-1 rounded-md">
                            {formatSuppressionReason(req.suppression_reason)}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-zinc-800">
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums block">
                              {req.sent_at ? new Date(req.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending dispatch'}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1 tabular-nums">
                              <MousePointerClick className="h-3 w-3 text-blue-500" />
                              <span>{req.click_count > 0 ? `${req.click_count} verified Google click${req.click_count > 1 ? 's' : ''}` : '0 clicks'}</span>
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRequest(req)}
                            className="min-h-[44px] px-3.5 text-xs font-semibold border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 cursor-pointer"
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: DIRECT CUSTOMER FEEDBACK */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          
          {/* Feedback Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Feedback', count: feedbackList.length },
              { id: 'unresolved', label: 'Needs Follow-up', count: unresolvedCount },
              { id: 'resolved', label: 'Resolved', count: feedbackList.filter(f => f.resolved).length }
            ].map(filter => {
              const isActive = feedbackFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setFeedbackFilter(filter.id as any)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer min-h-[38px]",
                    isActive
                      ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-xs"
                      : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <span>{filter.label}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full tabular-nums",
                    isActive ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900" : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                  )}>
                    {filter.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Feedback Feed */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-bold text-xs text-slate-900 dark:text-zinc-200">Customer Feedback &amp; Recovery Log</h2>
              <span className="text-[11px] text-slate-500 dark:text-zinc-500 tabular-nums">{filteredFeedback.length} records</span>
            </div>

            {feedbackLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                    <Skeleton className="h-4 w-36 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-48 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-16 bg-slate-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : filteredFeedback.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ShieldCheck}
                  title="No Direct Feedback Issues"
                  description={
                    feedbackFilter === 'unresolved'
                      ? "Great work! All direct customer feedback issues have been resolved."
                      : "When customers submit feedback on their tracking page, their comment is routed here directly for owner follow-up."
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredFeedback.map(fb => (
                  <div key={fb.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Star Rating Badge */}
                        <div className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-3 w-3",
                                i < fb.rating
                                  ? "text-amber-500 fill-amber-500"
                                  : "text-slate-200 dark:text-zinc-700"
                              )}
                            />
                          ))}
                          <span className="ml-1 text-[11px] font-mono">{fb.rating}/5</span>
                        </div>

                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {fb.customer_name || 'Customer'}
                        </span>

                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                          {fb.customer_phone ? formatNationalUs(fb.customer_phone) : '-'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 tabular-nums">
                          {new Date(fb.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {fb.resolved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Resolved</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>Needs Follow-up</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quoted Feedback Text */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200 italic leading-relaxed">
                      "{fb.feedback_text}"
                    </div>

                    {/* Resolution details if resolved */}
                    {fb.resolved && fb.resolution_notes && (
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-0.5">
                        <span className="font-bold text-[11px] uppercase tracking-wider block text-emerald-700 dark:text-emerald-400">
                          Resolution Action ({fb.resolved_at ? new Date(fb.resolved_at).toLocaleDateString() : 'Recorded'}):
                        </span>
                        <p className="text-[11.5px] italic text-emerald-900 dark:text-emerald-200">
                          {fb.resolution_notes}
                        </p>
                      </div>
                    )}

                    {/* Touch Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-2">
                        {fb.customer_phone && (
                          <>
                            <a
                              href={`tel:${fb.customer_phone}`}
                              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shadow-2xs"
                            >
                              <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Call Customer</span>
                            </a>
                            <a
                              href={`sms:${fb.customer_phone}`}
                              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shadow-2xs"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Send SMS</span>
                            </a>
                          </>
                        )}
                      </div>

                      {!fb.resolved ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setResolvingItem(fb)
                            setResolutionNotes('')
                          }}
                          className="min-h-[44px] px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                          <span>Mark Resolved</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResolvingItem(fb)
                            setResolutionNotes(fb.resolution_notes || '')
                          }}
                          className="min-h-[44px] px-3.5 text-xs font-semibold border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          <span>Edit Notes</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── SEND REVIEW INVITATION DRAWER / MODAL ── */}
      <Modal
        open={showSendModal}
        onOpenChange={setShowSendModal}
        title="Send Review Invitation"
        description="Dispatch a direct review invitation SMS with your verified Google review link."
        size="lg"
      >
        <div className="space-y-4 py-1">

          {/* Step 1: Customer Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>1. Select Recipient</span>
              </Label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('existing')
                    setName('')
                    setPhone('')
                    setCustomerOptOut(undefined)
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer",
                    customerMode === 'existing'
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                  )}
                >
                  Existing Customer
                </button>
                <span className="text-slate-300 dark:text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('new')
                    setSelectedCustomerId('')
                    setName('')
                    setPhone('')
                    setCustomerOptOut(undefined)
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer",
                    customerMode === 'new'
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                  )}
                >
                  New Recipient
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search existing customer contacts..."
                    value={customerSearchQuery}
                    onChange={e => setCustomerSearchQuery(e.target.value)}
                    className="h-9 pl-8 pr-2.5 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <select
                  aria-label="Select existing customer"
                  value={selectedCustomerId}
                  onChange={e => handleSelectCustomer(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg py-2.5 px-3 text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">
                    Choose a customer contact to auto-populate phone...
                  </option>
                  {filteredCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name ? `${c.name} (${formatNationalUs(c.phone)})` : formatNationalUs(c.phone)}
                      {c.opt_out ? ' [OPTED OUT]' : ''}
                    </option>
                  ))}
                </select>

                {customerOptOut && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2 rounded-lg flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>This customer has opted out of SMS messages and cannot receive review invitations.</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Recipient Name and Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Customer Name
                </Label>
                <Input
                  placeholder="e.g. Dana Miller"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-10 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Cell Phone (SMS)
                </Label>
                <Input
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={handlePhone}
                  className="h-10 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Trade Template Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-blue-500" />
                <span>2. Trade Message Preset (22 Trades)</span>
              </Label>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Industry-tested copy
              </span>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTemplateCategoryFilter(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[30px]",
                    templateCategoryFilter === cat.id
                      ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Template Buttons Carousel / Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-950/50">
              {filteredTemplates.map(trade => {
                const isSelected = selectedTrade === trade.id
                return (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => handleSelectTrade(trade.id)}
                    className={cn(
                      "p-2 text-left rounded-md text-xs border transition-colors cursor-pointer min-h-[44px] flex flex-col justify-center",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs font-semibold"
                        : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-blue-400"
                    )}
                  >
                    <span className="font-bold text-[11px] truncate block">{trade.shortName}</span>
                    <span className={cn("text-[9.5px] truncate block", isSelected ? "text-blue-100" : "text-slate-400 dark:text-zinc-500")}>
                      {trade.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 3: Message Editor & Live Preview */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                3. SMS Message Content
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                  {smsCharCount} chars · {smsSegments} segment{smsSegments > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPhonePreviewOnMobile(p => !p)}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>{showPhonePreviewOnMobile ? 'Hide Phone' : 'Preview Phone'}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2.5 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 dark:text-zinc-500">
              Tokens <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-slate-700 dark:text-zinc-300">{"{business_name}"}</code> and <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-slate-700 dark:text-zinc-300">{"{review_link}"}</code> are dynamically replaced with your company name and tracking redirect URL.
            </p>
          </div>

          {/* Collapsible Phone Preview on Mobile / Drawer */}
          {showPhonePreviewOnMobile && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-blue-500" />
                  <span>iPhone Message Preview</span>
                </span>
                <span className="font-mono text-[9px]">9:41 AM · 5G</span>
              </div>
              <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tl-xs text-[11px] leading-relaxed shadow-xs">
                {livePreviewText}
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-zinc-500 px-1">
                <span>Reply STOP to cancel (TCPA Compliant)</span>
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                  <CheckCheck className="w-2.5 h-2.5" />
                  <span>Delivered</span>
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSendModal(false)}
              className="h-11 px-4 text-xs border-slate-200 dark:border-zinc-800 cursor-pointer min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={sending || !settings.googleReviewUrl?.trim() || !phone || phone.replace(/\D/g, '').length < 10 || !!customerOptOut}
              className="min-h-[48px] px-6 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer rounded-xl"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  <span>Dispatching Outbound SMS...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  <span>Send Review Invite SMS Now</span>
                </>
              )}
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── FOCUSED REVIEW REQUEST DETAIL MODAL ── */}
      <Modal
        open={!!selectedRequest}
        onOpenChange={open => !open && setSelectedRequest(null)}
        title="Review Invitation Details"
        description="Delivery confirmation, suppression details, and click history."
        size="md"
      >
        {selectedRequest && (
          <div className="space-y-4 py-1">
            {/* Customer Header */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  {formatCustomerName(selectedRequest.contacts?.name) || 'Customer'}
                </h3>
                {getReviewStatusBadge(selectedRequest.status)}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
                <span className="font-mono tabular-nums">
                  {selectedRequest.contacts?.phone ? formatNationalUs(selectedRequest.contacts.phone) : 'No phone'}
                </span>
                {selectedRequest.jobs && (
                  <span className="text-slate-400">
                    Job #{selectedRequest.jobs.job_number} : {selectedRequest.jobs.title}
                  </span>
                )}
              </div>

              {selectedRequest.contacts?.phone && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
                  <a
                    href={`tel:${selectedRequest.contacts.phone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 hover:bg-slate-50"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`sms:${selectedRequest.contacts.phone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400 hover:bg-slate-50"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>SMS</span>
                  </a>
                </div>
              )}
            </div>

            {/* Suppression or Status Details */}
            {selectedRequest.suppression_reason && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Suppression Reason</span>
                </div>
                <p className="leading-relaxed">
                  {formatSuppressionReason(selectedRequest.suppression_reason)}
                </p>
              </div>
            )}

            {/* Delivery Timeline & Link Clicks */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Dispatched</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 tabular-nums">
                  {selectedRequest.sent_at ? new Date(selectedRequest.sent_at).toLocaleString() : 'Not dispatched yet'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Google Clicks</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums flex items-center gap-1">
                  <MousePointerClick className="w-3.5 h-3.5" />
                  <span>{selectedRequest.click_count || 0} clicks</span>
                </span>
              </div>
            </div>

            {/* Verified Redirect Token */}
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Public Redirect URL (/r/[token])
              </span>
              <p className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/r/${selectedRequest.token}` : `/r/${selectedRequest.token}`}
              </p>
            </div>

            {/* Close button */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRequest(null)}
                className="h-10 px-4 text-xs border-slate-200 dark:border-zinc-800 min-h-[44px]"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── AUTOMATION RULES & COOLDOWN SETTINGS MODAL ── */}
      <Modal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        title="Review Automation &amp; Cooldown Rules"
        description="Configure your Google Business review link, post-job triggers, and customer contact frequency."
        size="md"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Google Business Review URL
            </Label>
            <Input
              type="url"
              required
              placeholder="https://g.page/r/your-review-shortlink/review"
              value={settings.googleReviewUrl}
              onChange={e => setSettings({ ...settings, googleReviewUrl: e.target.value })}
              className="h-10 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 rounded-lg"
            />
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              In Google Business Profile, click "Ask for reviews" and copy the link.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Post-Job Send Delay (Hours)
              </Label>
              <Input
                type="number"
                min={1}
                max={72}
                value={settings.delayHours}
                onChange={e => setSettings({ ...settings, delayHours: parseInt(e.target.value) || 24 })}
                className="h-10 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Hours after job completion</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Customer Cooldown (Days)
              </Label>
              <Input
                type="number"
                min={7}
                max={180}
                value={settings.cooldownDays}
                onChange={e => setSettings({ ...settings, cooldownDays: parseInt(e.target.value) || 60 })}
                className="h-10 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Prevents review solicitation fatigue</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <input
              type="checkbox"
              id="reviewEnabled"
              checked={settings.reviewRequestsEnabled}
              onChange={e => setSettings({ ...settings, reviewRequestsEnabled: e.target.checked })}
              className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-600 h-4 w-4 mt-0.5 cursor-pointer"
            />
            <Label htmlFor="reviewEnabled" className="text-xs text-slate-700 dark:text-zinc-300 cursor-pointer leading-relaxed">
              <strong>Automatically trigger review invitation</strong> when a job is marked completed in the field schedule.
            </Label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsModal(false)}
              className="h-10 px-4 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingSettings}
              className="h-10 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white min-h-[44px] cursor-pointer"
            >
              {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              <span>Save Rules</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── TECHNICIAN FRONT-DOOR & RECEIPT QR CODE MODAL ── */}
      <Modal
        open={showQrModal}
        onOpenChange={setShowQrModal}
        title="Customer Review QR Code"
        description="Have customers scan this QR code on-site to open your Google review link directly."
        size="md"
      >
        <div className="space-y-4 py-2 flex flex-col items-center text-center">
          <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-md">
            {settings.googleReviewUrl ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(settings.googleReviewUrl)}`}
                alt="Google Review QR Code"
                width={260}
                height={260}
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <span className="text-xs">No Review URL Configured</span>
              </div>
            )}
          </div>

          <div className="w-full space-y-2">
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Show this QR code on your phone while on-site, print it for truck magnets, or print on leave-behind invoices.
            </p>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyReviewLink}
                className="min-h-[44px] px-4 text-xs font-semibold border-slate-200 dark:border-zinc-800"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Review Link'}</span>
              </Button>

              <a
                href={settings.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
              >
                <span>Open in Google</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── RESOLVE CUSTOMER COMPLAINT MODAL ── */}
      <Modal
        open={!!resolvingItem}
        onOpenChange={open => !open && setResolvingItem(null)}
        title="Resolve Customer Feedback"
        description={`Record notes on how you resolved this issue for ${resolvingItem?.customer_name || 'the customer'}.`}
        size="md"
      >
        <form onSubmit={handleResolveFeedback} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-zinc-100">Customer Feedback</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">{resolvingItem?.rating}★ Rating</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 italic">
              "{resolvingItem?.feedback_text}"
            </p>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
              Resolution Action / Follow-Up Notes
            </Label>
            <textarea
              required
              rows={3}
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              placeholder="e.g. Called customer, waived trip diagnostic fee, and scheduled technician revisit for Tuesday morning."
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolvingItem(null)}
              className="h-10 px-4 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingResolution || !resolutionNotes.trim()}
              className="h-10 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white min-h-[44px] cursor-pointer"
            >
              {savingResolution ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              <span>Mark as Resolved</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mobile Floating Action Button */}
      {activeTab === 'reviews' && (
        <button
          type="button"
          onClick={() => setShowSendModal(true)}
          disabled={!settings.googleReviewUrl?.trim()}
          className="fixed bottom-20 right-4 lg:hidden z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-3 rounded-full shadow-lg shadow-blue-600/30 font-semibold text-xs tracking-wide transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
          aria-label="Send Review Invite"
        >
          <Send className="h-4 w-4" />
          <span>Send Invite</span>
        </button>
      )}

      {/* Found Money Finish-Line Paywall Modal */}
      <FoundMoneyUnlockModal
        isOpen={showFoundMoneyModal}
        onClose={() => setShowFoundMoneyModal(false)}
        customerName={gatedCustomerName}
        amountDue={250}
        operationMode={operationMode === 'multi_crew' ? 'multi_crew' : 'solo'}
        onSuccess={loadData}
      />

    </div>
  )
}
