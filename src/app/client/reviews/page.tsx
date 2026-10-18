'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
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
  Activity,
  Globe,
  Phone,
  MessageSquare,
  AlertCircle,
  Filter,
  Sparkles,
  Check
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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Delivered
        </span>
      )
    case 'clicked':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Opened
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
          Sent
        </span>
      )
    case 'pending':
    case 'scheduled':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Scheduled
        </span>
      )
    case 'suppressed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-500 border border-zinc-700">
          Suppressed
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Failed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
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
    googleReviewUrl: '',
    reviewRequestsEnabled: true,
    delayHours: 24,
    cooldownDays: 60
  })
  const [requests, setRequests] = useState<ReviewRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Private feedback & complaint interception state
  const [feedbackList, setFeedbackList] = useState<CustomerFeedbackItem[]>([])
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [resolvingItem, setResolvingItem] = useState<CustomerFeedbackItem | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [savingResolution, setSavingResolution] = useState(false)

  // Send single review invite
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/reviews')
      if (res.ok) {
        const data = await res.json()
        setMetrics(data.metrics || {})
        setSettings(data.settings || {})
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
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid 10-digit phone number.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
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
      } else {
        toast.error('Failed to update settings.')
      }
    } catch {
      toast.error('Network error saving settings.')
    } finally {
      setSavingSettings(false)
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

  const filteredFeedback = feedbackList.filter(item => {
    if (feedbackFilter === 'unresolved') return !item.resolved
    if (feedbackFilter === 'resolved') return item.resolved
    return true
  })

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Reviews &amp; Reputation
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 tabular-nums">
              {requests.length} requests
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Google review automation with built-in negative feedback interception to protect your public rating.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {settings.googleReviewUrl && (
            <a
              href={settings.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white transition-colors shadow-xs"
            >
              <Globe className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <span>Google Profile</span>
            </a>
          )}

          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            className="h-8 text-xs border border-slate-200 dark:border-zinc-700 bg-white hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 shadow-xs"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5 text-slate-500 dark:text-zinc-400" />
            <span>Settings</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none bg-slate-100 dark:bg-zinc-900/60 p-1.5 rounded-xl border border-slate-200/60 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
            activeTab === 'reviews'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
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
            "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors relative",
            activeTab === 'feedback'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <ShieldAlert className={cn("h-3.5 w-3.5", activeTab === 'feedback' ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-zinc-500")} />
          <span>Private Complaints Interceptor</span>
          {unresolvedCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              <span>{unresolvedCount}</span>
              <span className="hidden sm:inline">Needs Attention</span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 tabular-nums">
              {feedbackList.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: GOOGLE REVIEW INVITES ── */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {/* Honest Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Requests Sent</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{loading ? '-' : metrics.totalSent}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Outbound SMS invites</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Delivered</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">{loading ? '-' : metrics.totalDelivered}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Confirmed network delivery</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Link Clicks</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-1">{loading ? '-' : metrics.totalClicked}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Verified redirect clicks</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Click Rate</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">{loading ? '-' : `${metrics.clickRate}%`}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Customer follow-through</p>
            </div>
          </div>

          {/* Manual Dispatch Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
            <div className="mb-3">
              <h2 className="font-semibold text-xs text-slate-900 dark:text-zinc-200">
                Dispatch One-Off Review Invite
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">
                Send an instant review invitation. Respects customer opt-outs and cooldown windows automatically.
              </p>
            </div>

            <form onSubmit={handleSend} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Input
                placeholder="Customer Name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-8.5 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-md"
              />
              <Input
                placeholder="(555) 000-0000"
                value={phone}
                onChange={handlePhone}
                className="h-8.5 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-md"
              />
              <Button
                type="submit"
                size="sm"
                disabled={sending}
                className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                <span>Send Invite</span>
              </Button>
            </form>
          </div>

          {/* Recent Requests Table */}
          <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-xs text-slate-900 dark:text-zinc-200">Review Requests Log</h2>
              <span className="text-[11px] text-slate-500 dark:text-zinc-500 tabular-nums">{requests.length} records</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                    <Skeleton className="h-4 w-36 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-28 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-16 bg-slate-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Star}
                  title="No Review Requests Yet"
                  description="Review requests will be dispatched automatically when field jobs are completed, or you can send one directly using the form above."
                  actionLabel="Review Settings"
                  onAction={() => setShowSettings(true)}
                />
              </div>
            ) : (
              <div>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200/80 dark:border-zinc-800">
                      <TableRow className="border-b border-slate-200/80 dark:border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-slate-500 dark:text-zinc-400 font-semibold text-xs py-3 px-4">Customer</TableHead>
                        <TableHead className="text-slate-500 dark:text-zinc-400 font-semibold text-xs py-3 px-4">Job Reference</TableHead>
                        <TableHead className="text-slate-500 dark:text-zinc-400 font-semibold text-xs py-3 px-4">Status</TableHead>
                        <TableHead className="text-slate-500 dark:text-zinc-400 font-semibold text-xs py-3 px-4">Date</TableHead>
                        <TableHead className="text-slate-500 dark:text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {requests.map(req => (
                        <TableRow key={req.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                          <TableCell className="py-3 px-4">
                            <div className="font-medium text-xs text-slate-900 dark:text-zinc-100">{req.contacts?.name || 'Customer'}</div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">{req.contacts?.phone || '—'}</div>
                          </TableCell>

                          <TableCell className="py-3 px-4 text-xs text-slate-700 dark:text-zinc-300">
                            {req.jobs ? (
                              <span>{req.jobs.job_number} • {req.jobs.title}</span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-500">Manual Dispatch</span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 px-4">
                            {getReviewStatusBadge(req.status)}
                            {req.suppression_reason && (
                              <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">{req.suppression_reason}</div>
                            )}
                          </TableCell>

                          <TableCell className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                            {req.sent_at ? new Date(req.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </TableCell>

                          <TableCell className="py-3 px-4 text-right font-medium text-xs text-slate-700 dark:text-zinc-300 tabular-nums">
                            {req.click_count > 0 ? (
                              <span className="text-blue-600 dark:text-blue-400 font-semibold">{req.click_count}</span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-600">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card List View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
                  {requests.map(req => (
                    <div key={req.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-xs text-slate-900 dark:text-zinc-100">{req.contacts?.name || 'Customer'}</h3>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">{req.contacts?.phone || '—'}</p>
                        </div>
                        {getReviewStatusBadge(req.status)}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {req.jobs ? (
                          <span className="text-slate-700 dark:text-zinc-300">{req.jobs.job_number} • {req.jobs.title}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500">Manual Dispatch</span>
                        )}
                      </div>

                      {req.suppression_reason && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-1 rounded">
                          {req.suppression_reason}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                        <span className="text-[11px] text-slate-500 dark:text-zinc-500">
                          {req.sent_at ? new Date(req.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
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
          {/* Explainer / Interception Banner */}
          <div className="border border-amber-200/80 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 sm:p-5 text-xs text-slate-700 dark:text-zinc-300 shadow-xs flex flex-col sm:flex-row items-start gap-3.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">
                Private Negative Feedback Interceptor
              </h2>
              <p className="text-[11.5px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                When customers rate their job <strong className="text-slate-900 dark:text-zinc-100">1, 2, or 3 stars</strong> on their live tracking link, their response is kept private and routed directly to this inbox while triggering an urgent alert to your mobile phone. This gives you the immediate opportunity to make things right before they post a public negative review on Google.
              </p>
            </div>
          </div>

          {/* Feedback Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Total Intercepted</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{feedbackLoading ? '-' : feedbackList.length}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Kept off public Google</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Needs Attention</p>
              <p className={cn("text-xl font-bold tabular-nums mt-1", unresolvedCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                {feedbackLoading ? '-' : unresolvedCount}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Awaiting owner follow-up</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Resolved &amp; Retained</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {feedbackLoading ? '-' : feedbackList.filter(f => f.resolved).length}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Customer issues fixed</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Reputation Shield</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-1">100%</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Private review barrier</p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Feedback', count: feedbackList.length },
              { id: 'unresolved', label: 'Needs Follow-Up', count: unresolvedCount },
              { id: 'resolved', label: 'Resolved', count: feedbackList.filter(f => f.resolved).length }
            ].map(filter => {
              const isActive = feedbackFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setFeedbackFilter(filter.id as any)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
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

          {/* Complaints List / Table */}
          <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-xs text-slate-900 dark:text-zinc-200">Customer Complaints Log</h2>
              <span className="text-[11px] text-slate-500 dark:text-zinc-500 tabular-nums">{filteredFeedback.length} records</span>
            </div>

            {feedbackLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                    <Skeleton className="h-4 w-36 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-48 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-4 w-16 bg-slate-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : filteredFeedback.length === 0 ? (
              <div className="p-6">
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
                      <div className="flex items-center gap-2">
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
                          <span className="ml-1 text-[11px]">{fb.rating}/5</span>
                        </div>

                        <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                          {fb.customer_name || 'Customer'}
                        </span>

                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                          {fb.customer_phone}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 tabular-nums">
                          {new Date(fb.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {fb.resolved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Resolved</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>Needs Follow-up</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quoted Feedback Text */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200 italic leading-relaxed">
                      "{fb.feedback_text}"
                    </div>

                    {/* Resolution details if resolved */}
                    {fb.resolved && fb.resolution_notes && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-0.5">
                        <span className="font-semibold text-[11px] uppercase tracking-wider block text-emerald-700 dark:text-emerald-400">
                          Resolution Notes ({fb.resolved_at ? new Date(fb.resolved_at).toLocaleDateString() : 'Recorded'}):
                        </span>
                        <p className="text-[11.5px] italic text-emerald-900 dark:text-emerald-200">
                          {fb.resolution_notes}
                        </p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-2">
                        {fb.customer_phone && (
                          <>
                            <a
                              href={`tel:${fb.customer_phone}`}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors"
                            >
                              <Phone className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              <span>Call Customer</span>
                            </a>
                            <a
                              href={`sms:${fb.customer_phone}`}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors"
                            >
                              <MessageSquare className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
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
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
                        >
                          <Check className="h-3 w-3 mr-1" />
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
                          className="h-7 text-xs border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
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

      {/* Review Automation Settings Modal */}
      <Modal
        open={showSettings}
        onOpenChange={setShowSettings}
        title="Review Automation Settings"
        description="Configure post-job automated review requests and cooldown intervals."
        size="md"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block">Google Review URL</Label>
            <Input
              placeholder="https://g.page/r/your-google-review-link/review"
              value={settings.googleReviewUrl}
              onChange={e => setSettings({ ...settings, googleReviewUrl: e.target.value })}
              className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
            />
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">Direct link to your Google Business Profile review dialog.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block">Delay After Job (Hours)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.delayHours}
                onChange={e => setSettings({ ...settings, delayHours: parseInt(e.target.value) || 24 })}
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
              />
            </div>

            <div>
              <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block">Customer Cooldown (Days)</Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={settings.cooldownDays}
                onChange={e => setSettings({ ...settings, cooldownDays: parseInt(e.target.value) || 60 })}
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="reviewEnabled"
              checked={settings.reviewRequestsEnabled}
              onChange={e => setSettings({ ...settings, reviewRequestsEnabled: e.target.checked })}
              className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-600 h-4 w-4"
            />
            <Label htmlFor="reviewEnabled" className="text-xs text-slate-700 dark:text-zinc-200 cursor-pointer">
              Automatically trigger review request when job is marked completed
            </Label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(false)}
              className="h-8 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingSettings}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {savingSettings ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              Save Settings
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolution Modal */}
      <Modal
        open={!!resolvingItem}
        onOpenChange={open => !open && setResolvingItem(null)}
        title="Resolve Customer Complaint"
        description={`Record notes on how you resolved this issue for ${resolvingItem?.customer_name || 'the customer'}.`}
        size="md"
      >
        <form onSubmit={handleResolveFeedback} className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-zinc-100">Customer Feedback</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{resolvingItem?.rating}★ Rating</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 italic">
              "{resolvingItem?.feedback_text}"
            </p>
          </div>

          <div>
            <Label className="text-xs text-slate-700 dark:text-zinc-300 mb-1 block font-medium">
              Resolution Action / Notes
            </Label>
            <textarea
              required
              rows={3}
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              placeholder="e.g. Called customer, waived dispatch fee, and scheduled technician revisit for Tuesday morning."
              className="w-full text-xs rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolvingItem(null)}
              className="h-8 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingResolution || !resolutionNotes.trim()}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {savingResolution ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              <span>Mark as Resolved</span>
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
