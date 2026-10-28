'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
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
  Globe, 
  Phone, 
  MessageSquare, 
  AlertCircle, 
  Filter, 
  Check, 
  Users,
  QrCode,
  Copy,
  Search,
  Smartphone,
  CheckCheck,
  Wrench,
  X
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
  contacts?: { name?: string; phone: string }
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

function getReviewStatusBadge(status: string) {
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCheck className="w-3 h-3" />
          <span>Delivered</span>
        </span>
      )
    case 'clicked':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <MousePointerClick className="w-3 h-3" />
          <span>Opened</span>
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
          <Check className="w-3 h-3" />
          <span>Sent</span>
        </span>
      )
    case 'pending':
    case 'scheduled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" />
          <span>Scheduled</span>
        </span>
      )
    case 'suppressed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
          <ShieldAlert className="w-3 h-3" />
          <span>Suppressed</span>
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-3 h-3" />
          <span>Failed</span>
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
          {status}
        </span>
      )
  }
}

export default function ReviewsPage() {
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
  const [showSettings, setShowSettings] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Direct inline Google URL configuration state (when missing)
  const [quickGoogleUrl, setQuickGoogleUrl] = useState('')
  const [savingQuickUrl, setSavingQuickUrl] = useState(false)

  // Private feedback & complaint interception state
  const [feedbackList, setFeedbackList] = useState<CustomerFeedbackItem[]>([])
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [resolvingItem, setResolvingItem] = useState<CustomerFeedbackItem | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [savingResolution, setSavingResolution] = useState(false)

  // Send single review invite state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedTrade, setSelectedTrade] = useState<string>('general')
  const [customMessage, setCustomMessage] = useState<string>(
    TRADE_REVIEW_TEMPLATES[0].template
  )
  const [sending, setSending] = useState(false)
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone: string }>>([])
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
    if (!customerId) return
    const cust = customers.find(c => c.id === customerId)
    if (cust) {
      setName(cust.name || '')
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

    // Load customers for one-off review invite lookup
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

    // Check if deep linked to private complaints tab
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('tab') === 'feedback') {
        setActiveTab('feedback')
      }
    }
  }, [loadData, loadFeedback])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings.googleReviewUrl?.trim()) {
      toast.error('Google Review URL is required before sending review invites. Please configure it below.')
      return
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid 10-digit phone number.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          phone,
          message: customMessage.trim()
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Review link sent to ${name || phone}`)
        setName('')
        setPhone('')
        loadData()
      } else {
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
        setShowSettings(false)
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
        toast.success('Complaint marked as resolved')
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

  // Interpolated preview text for the live phone preview
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

  const filteredFeedback = feedbackList.filter(item => {
    if (feedbackFilter === 'unresolved') return !item.resolved
    if (feedbackFilter === 'resolved') return item.resolved
    return true
  })

  // Delivery rate
  const deliveryRate = metrics.totalSent > 0 ? Math.round((metrics.totalDelivered / metrics.totalSent) * 100) : 0

  return (
    <div className="space-y-6">

      {/* Page Header (Senior Designer Craft Standard) */}
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
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                <AlertCircle className="w-3 h-3" />
                <span>Missing Google Review Link</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Automated Google review booster, front-door technician QR scanner, and private customer feedback interceptor.
          </p>
        </div>

        {/* Header Actions Row */}
        <div className="flex flex-wrap items-center gap-2">
          {settings.googleReviewUrl && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQrModal(true)}
                className="h-9 px-3 text-xs font-semibold border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-xs"
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                <span>Door QR Code</span>
              </Button>

              <a
                href={settings.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white transition-colors shadow-xs"
              >
                <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                <span>Test Link</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>
            </>
          )}

          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            className="h-9 px-3 text-xs font-semibold border border-slate-200 dark:border-zinc-700 bg-white hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 shadow-xs"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5 text-slate-500 dark:text-zinc-400" />
            <span>Rules &amp; Cooldown</span>
          </Button>
        </div>
      </div>

      {/* Operational Metrics Row (4 Tabular Metric Tokens) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Invites Dispatched</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{loading ? '—' : metrics.totalSent}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Post-job &amp; manual SMS</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Confirmed Deliveries</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">{loading ? '—' : metrics.totalDelivered}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 tabular-nums">{loading ? '—' : `${deliveryRate}% carrier delivery`}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Verified Clicks</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-1">{loading ? '—' : metrics.totalClicked}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 tabular-nums">{loading ? '—' : `${metrics.clickRate}% CTR to Google`}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Private Interceptions</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{feedbackLoading ? '—' : feedbackList.length}</p>
          <p className="text-[11px] mt-0.5 font-medium">
            {unresolvedCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{unresolvedCount} need follow-up</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">All complaints resolved</span>
            )}
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none bg-slate-100 dark:bg-zinc-900/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
            activeTab === 'reviews'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", activeTab === 'reviews' ? "text-amber-500 fill-amber-500" : "text-slate-400 dark:text-zinc-500")} />
          <span>Google Review Booster</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 tabular-nums">
            {requests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors relative",
            activeTab === 'feedback'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <ShieldAlert className={cn("h-3.5 w-3.5", activeTab === 'feedback' ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-zinc-500")} />
          <span>Private Complaints Interceptor</span>
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

      {/* ── TAB 1: GOOGLE REVIEW INVITES & BOOSTER ── */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">

          {/* Missing Google Review URL Warning / Quick-Add Banner */}
          {!settings.googleReviewUrl?.trim() && !loading && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-4 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Google Business Profile Review Link Not Set
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                    Customer review invitations cannot redirect to your Google profile until your review link is saved. Paste your Google Business review link below to activate automated dispatches.
                  </p>
                </div>
              </div>

              <form onSubmit={handleQuickSaveGoogleUrl} className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <Input
                  type="url"
                  placeholder="https://g.page/r/your-review-shortlink/review"
                  value={quickGoogleUrl}
                  onChange={e => setQuickGoogleUrl(e.target.value)}
                  className="h-9 text-xs bg-white dark:bg-zinc-950 border-amber-300 dark:border-amber-700/80 rounded-lg text-slate-900 dark:text-zinc-100"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingQuickUrl || !quickGoogleUrl.trim()}
                  className="h-9 px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-xs"
                >
                  {savingQuickUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                  <span>Save Review Link</span>
                </Button>
              </form>
            </div>
          )}

          {/* Quick Dispatch Bar & Live SMS Preview (Split Layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
            
            {/* Left Column: Dispatch Controls & Trade Presets (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Dispatch One-Off Review Invite</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Send an instant FTC-compliant SMS invitation directly to a customer's phone from the truck.
                </p>
              </div>

              {/* Quick Customer Picker */}
              {customers.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                    Select Existing Customer
                  </Label>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                    <select
                      aria-label="Select existing customer"
                      onChange={e => handleSelectCustomer(e.target.value)}
                      defaultValue=""
                      className="w-full text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg py-2 px-2.5 text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="" disabled>
                        Pick a customer to auto-fill name and cell phone...
                      </option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name ? `${c.name} (${c.phone})` : c.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Name & Phone Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                    Customer Name
                  </Label>
                  <Input
                    placeholder="e.g. Dana Miller"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                    Cell Phone Number
                  </Label>
                  <Input
                    placeholder="(555) 000-0000"
                    value={phone}
                    onChange={handlePhone}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {/* 21-Trade Preset Selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-500" />
                    <span>Trade Preset (21 Home Service Trades)</span>
                  </Label>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Compliant non-gating copy
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {TRADE_REVIEW_TEMPLATES.map(trade => (
                    <button
                      key={trade.id}
                      type="button"
                      onClick={() => handleSelectTrade(trade.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors shrink-0",
                        selectedTrade === trade.id
                          ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-xs font-semibold"
                          : "bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                      )}
                    >
                      {trade.shortName}
                    </button>
                  ))}
                </div>
              </div>

              {/* SMS Message Customizer */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                    SMS Message Content
                  </Label>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                    {smsCharCount} chars · {smsSegments} segment{smsSegments > 1 ? 's' : ''}
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2.5 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                  Tokens <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-slate-700 dark:text-zinc-300">{"{business_name}"}</code> and <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-slate-700 dark:text-zinc-300">{"{review_link}"}</code> are replaced automatically with your verified redirect link.
                </p>
              </div>

              {/* 48px Truck Touch Primary Button */}
              <Button
                type="button"
                onClick={handleSend}
                disabled={sending || !settings.googleReviewUrl?.trim()}
                title={!settings.googleReviewUrl?.trim() ? 'Google review link must be configured' : undefined}
                className="w-full h-12 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Dispatching Outbound SMS...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Review Invite SMS Now</span>
                  </>
                )}
              </Button>
            </div>

            {/* Right Column: Live Phone Preview Widget (5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50/70 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-4 sm:p-5">
              <div className="w-full max-w-[280px] bg-white dark:bg-zinc-900 border-4 border-slate-300 dark:border-zinc-700 rounded-[32px] p-3 shadow-md space-y-3">
                {/* Phone Notch & Header */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-medium px-2 pt-0.5">
                  <span>9:41</span>
                  <div className="w-16 h-3.5 bg-slate-200 dark:bg-zinc-800 rounded-full mx-auto" />
                  <span>5G</span>
                </div>

                <div className="text-center pb-1 border-b border-slate-100 dark:border-zinc-800">
                  <p className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 truncate">
                    {settings.businessName || 'Your Business'}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500">Verified Business SMS</p>
                </div>

                {/* SMS Bubble */}
                <div className="space-y-1">
                  <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tl-xs text-[11px] leading-relaxed shadow-xs">
                    <p>{livePreviewText}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 dark:text-zinc-500 px-1">
                    <span>Delivered</span>
                    <CheckCheck className="w-2.5 h-2.5 text-blue-500" />
                  </div>
                </div>

                {/* Micro Opt-out notice */}
                <div className="text-center pt-2">
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500">
                    Reply STOP to cancel · TCPA Compliant
                  </p>
                </div>
              </div>

              <div className="text-center mt-3">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Live Homeowner iPhone Screen Preview</span>
                </span>
              </div>
            </div>

          </div>

          {/* Outbound Review Requests Log Table */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            
            {/* Table Header Controls */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Review Requests Log
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Carrier delivery confirmations and Google link click tracking.
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
                    className="h-8 pl-8 pr-2.5 text-xs w-48 sm:w-56 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg"
                  />
                  {requestSearch && (
                    <button
                      type="button"
                      onClick={() => setRequestSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'delivered', label: 'Delivered' },
                    { id: 'clicked', label: 'Clicked' },
                    { id: 'scheduled', label: 'Scheduled' },
                    { id: 'suppressed', label: 'Suppressed' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRequestFilter(tab.id as any)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors",
                        requestFilter === tab.id
                          ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
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
                  title={requestSearch || requestFilter !== 'all' ? "No Matching Review Requests" : "No Review Requests Dispatched Yet"}
                  description={
                    requestSearch || requestFilter !== 'all'
                      ? "Try adjusting your search query or status filter."
                      : "Review requests are triggered automatically when field jobs are completed, or you can send one directly using the form above."
                  }
                  actionLabel={requestSearch ? "Clear Filter" : "Configure Rules"}
                  onAction={() => {
                    if (requestSearch) {
                      setRequestSearch('')
                      setRequestFilter('all')
                    } else {
                      setShowSettings(true)
                    }
                  }}
                />
              </div>
            ) : (
              <div>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800">
                      <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Customer</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Job Reference</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Status</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Dispatched</TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4 text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredRequests.map(req => (
                        <TableRow key={req.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                          <TableCell className="py-3 px-4">
                            <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                              {req.contacts?.name || 'Customer'}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                              {req.contacts?.phone || '—'}
                            </div>
                          </TableCell>

                          <TableCell className="py-3 px-4 text-xs text-slate-700 dark:text-zinc-300">
                            {req.jobs ? (
                              <span className="font-medium text-slate-900 dark:text-zinc-100">
                                {req.jobs.job_number} <span className="text-slate-400">·</span> {req.jobs.title}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-zinc-400 italic">One-Off Dispatch</span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 px-4">
                            {getReviewStatusBadge(req.status)}
                            {req.suppression_reason && (
                              <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">
                                {req.suppression_reason}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                            {req.sent_at ? new Date(req.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </TableCell>

                          <TableCell className="py-3 px-4 text-right font-semibold text-xs tabular-nums">
                            {req.click_count > 0 ? (
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded">
                                <MousePointerClick className="w-3 h-3" />
                                <span>{req.click_count}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-600">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Truck Card List View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredRequests.map(req => (
                    <div key={req.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                            {req.contacts?.name || 'Customer'}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                            {req.contacts?.phone || '—'}
                          </p>
                        </div>
                        {getReviewStatusBadge(req.status)}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-zinc-400">
                        {req.jobs ? (
                          <span>{req.jobs.job_number} · {req.jobs.title}</span>
                        ) : (
                          <span className="text-slate-400">One-Off Dispatch</span>
                        )}
                      </div>

                      {req.suppression_reason && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-1 rounded">
                          {req.suppression_reason}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-zinc-800">
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {req.sent_at ? new Date(req.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1 tabular-nums">
                          <MousePointerClick className="h-3 w-3 text-blue-500" />
                          <span>{req.click_count > 0 ? `${req.click_count} clicks` : '0 clicks'}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: PRIVATE COMPLAINTS & FEEDBACK INTERCEPTOR ── */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">

          {/* Operational Callout Banner */}
          <div className="border border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-4 sm:p-5 text-xs text-slate-700 dark:text-zinc-300 shadow-xs flex flex-col sm:flex-row items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                Private Negative Feedback Interceptor
              </h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                When customers rate their service <strong className="text-slate-900 dark:text-zinc-100">1, 2, or 3 stars</strong> on their live tracking link, their response is kept private and routed directly to this inbox while alerting your phone. This gives you the immediate opportunity to make things right before they post a negative review on Google.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Feedback', count: feedbackList.length },
              { id: 'unresolved', label: 'Needs Follow-Up', count: unresolvedCount },
              { id: 'resolved', label: 'Resolved & Retained', count: feedbackList.filter(f => f.resolved).length }
            ].map(filter => {
              const isActive = feedbackFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setFeedbackFilter(filter.id as any)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
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

          {/* Complaints Feed */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-bold text-xs text-slate-900 dark:text-zinc-200">Customer Complaints Log</h2>
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
                  title="No Intercepted Complaints"
                  description={
                    feedbackFilter === 'unresolved'
                      ? "Great work! All intercepted customer issues have been resolved."
                      : "When customers rate their job under 4 stars on their tracking link, their comment is routed here privately, alerting you before it reaches Google."
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
                        <div className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-3 w-3",
                                i < fb.rating
                                  ? "text-rose-500 fill-rose-500"
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
                          {fb.customer_phone}
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

                    {/* 48px Truck Touch Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-2">
                        {fb.customer_phone && (
                          <>
                            <a
                              href={`tel:${fb.customer_phone}`}
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shadow-2xs"
                            >
                              <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Call Customer</span>
                            </a>
                            <a
                              href={`sms:${fb.customer_phone}`}
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shadow-2xs"
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
                          className="h-9 px-3.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
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
                          className="h-9 px-3 text-xs font-semibold border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
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

      {/* ── TECHNICIAN FRONT-DOOR QR CODE MODAL ── */}
      <Modal
        open={showQrModal}
        onOpenChange={setShowQrModal}
        title="Technician Door QR Scanner"
        description="Show this high-contrast QR code to homeowners at their front door. Their camera scans directly to your Google review link."
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
              <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                <span>No Google Review URL</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
              {settings.businessName || 'Leave Us a Review'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
              Point your phone camera at the code above to leave an honest review on our Google Business Profile.
            </p>
          </div>

          <div className="w-full flex items-center justify-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyReviewLink}
              className="h-9 text-xs font-semibold"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              <span>{copiedLink ? 'Copied Link' : 'Copy Review URL'}</span>
            </Button>

            {settings.googleReviewUrl && (
              <a
                href={settings.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors"
              >
                <span>Test Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </Modal>

      {/* ── REVIEW AUTOMATION RULES MODAL ── */}
      <Modal
        open={showSettings}
        onOpenChange={setShowSettings}
        title="Review Automation &amp; Cooldown Rules"
        description="Configure automatic post-job review request timing and customer fatigue cooldowns."
        size="md"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
              Google Review URL
            </Label>
            <Input
              placeholder="https://g.page/r/your-google-review-link/review"
              value={settings.googleReviewUrl}
              onChange={e => setSettings({ ...settings, googleReviewUrl: e.target.value })}
              className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
            />
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
              Direct shortlink from your Google Business Profile &gt; "Ask for reviews" button.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                Delay After Job (Hours)
              </Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.delayHours}
                onChange={e => setSettings({ ...settings, delayHours: parseInt(e.target.value) || 24 })}
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Recommended: 24h</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                Customer Cooldown (Days)
              </Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={settings.cooldownDays}
                onChange={e => setSettings({ ...settings, cooldownDays: parseInt(e.target.value) || 60 })}
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Prevents review spam</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <input
              type="checkbox"
              id="reviewEnabled"
              checked={settings.reviewRequestsEnabled}
              onChange={e => setSettings({ ...settings, reviewRequestsEnabled: e.target.checked })}
              className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-600 h-4 w-4 mt-0.5"
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
              onClick={() => setShowSettings(false)}
              className="h-9 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingSettings}
              className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
            >
              {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              <span>Save Rules</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── RESOLVE COMPLAINT MODAL ── */}
      <Modal
        open={!!resolvingItem}
        onOpenChange={open => !open && setResolvingItem(null)}
        title="Resolve Customer Complaint"
        description={`Record notes on how you resolved this issue for ${resolvingItem?.customer_name || 'the customer'}.`}
        size="md"
      >
        <form onSubmit={handleResolveFeedback} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-zinc-100">Customer Feedback</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">{resolvingItem?.rating}★ Rating</span>
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
              className="h-9 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingResolution || !resolutionNotes.trim()}
              className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {savingResolution ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              <span>Mark as Resolved</span>
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
