'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  PhoneMissed, 
  MessageSquare, 
  CalendarCheck, 
  FileCheck, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  Briefcase, 
  CreditCard, 
  RefreshCw,
  PhoneCall,
  Calendar,
  FileText,
  Star,
  MapPin,
  TrendingUp,
  Target,
  Plus,
  Sparkles,
  Truck,
  Navigation,
  Phone,
  Play,
  Loader2,
  Link2,
  Check,
  ExternalLink,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { EnRouteModal } from '@/components/jobs/en-route-modal'
import { createClient } from '@/lib/supabase/client'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/page-header'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AttentionItem, 
  OperationalMetrics, 
  OutcomeMetrics, 
  JobTodayItem, 
  RecentCallItem, 
  TimeRange 
} from '@/lib/dashboard/dashboard-service'
import { useQuery } from '@tanstack/react-query'
import { useWorkspace } from '@/lib/context/workspace-context'
import { BookingShareBar } from '@/components/booking/booking-share-bar'
import { PracticeJobCard } from '@/components/jobs/practice-job-card'
import { FirstBookingCelebrationModal } from '@/components/billing/first-booking-celebration-modal'
import { isPracticeJob } from '@/lib/jobs/practice-job'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const { orgId, orgName, orgSlug, subscriptionStatus, planId, role, userFullName } = useWorkspace()
  const [period, setPeriod] = useState<TimeRange>('30d')
  const [dismissedPracticeIds, setDismissedPracticeIds] = useState<string[]>([])
  const [enRouteModalOpen, setEnRouteModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [celebrationModal, setCelebrationModal] = useState<{
    open: boolean
    type: 'booking' | 'missed_call'
    isInteractiveTest?: boolean
  }>({ open: false, type: 'booking', isInteractiveTest: false })

  const isPayingCustomer = Boolean(
    (planId && !['free', 'trial'].includes(planId.toLowerCase())) ||
    (subscriptionStatus && ['active', 'paid', 'solo', 'crew'].includes(subscriptionStatus.toLowerCase()) && (planId || '').toLowerCase() !== 'free')
  )

  const [bookingShareDismissed, setBookingShareDismissed] = useState<boolean>(true)
  const [bookingCopied, setBookingCopied] = useState<boolean>(false)
  const [dismissedAttentionIds, setDismissedAttentionIds] = useState<string[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined' && orgId) {
      const dismissed = localStorage.getItem(`captodesk_booking_share_dismissed_${orgId}`) === 'true'
      setBookingShareDismissed(dismissed)
    }
  }, [orgId])

  const handleDismissBookingBar = () => {
    if (typeof window !== 'undefined' && orgId) {
      localStorage.setItem(`captodesk_booking_share_dismissed_${orgId}`, 'true')
    }
    setBookingShareDismissed(true)
    toast.success('Booking share banner dismissed from Today.')
  }

  const isCaptoDesk = typeof window !== 'undefined'
    ? window.location.hostname.includes('captodesk.com')
    : (process.env.NEXT_PUBLIC_APP_URL || '').includes('captodesk.com')

  const bookingUrl = isCaptoDesk
    ? `https://book.captodesk.com/${orgSlug || 'contractor'}`
    : `${(typeof window !== 'undefined' && window.location?.origin ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')).replace(/\/$/, '')}/book/${orgSlug || 'contractor'}`

  const handleCopyBookingUrl = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setBookingCopied(true)
      toast.success('Public booking link copied to clipboard!')
      setTimeout(() => setBookingCopied(false), 2500)
    } catch {
      toast.error('Failed to copy booking link.')
    }
  }

  const handleDismissAttentionItem = (id: string) => {
    setDismissedAttentionIds(prev => [...prev, id])
  }

  const handleAttentionActionClick = (id: string) => {
    setDismissedAttentionIds(prev => [...prev, id])
  }

  const { data, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const reqHeaders: Record<string, string> = {}
      if (session?.access_token) {
        reqHeaders['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch(`/api/client/dashboard?period=${period}`, { 
        headers: reqHeaders,
        credentials: 'include'
      })
      if (!res.ok) {
        if (res.status === 403) {
          const err = await res.json().catch(() => ({}))
          if (err.error?.includes('technician') || err.error?.includes('lacks permission')) {
            router.replace('/client/field')
            return {}
          }
          if (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization')) {
            router.replace('/client/onboarding')
            return {}
          }
        }
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load dashboard metrics')
      }
      return res.json()
    },
    staleTime: 60 * 1000
  })

  const attentionQueue: AttentionItem[] = data?.attentionQueue || []

  // Urgent attention items (missed calls, unread customer messages, new leads, urgent bookings)
  const visibleAttentionItems = attentionQueue.filter(item => {
    if (dismissedAttentionIds.includes(item.id)) return false
    return ['message', 'missed_call', 'lead', 'appointment'].includes(item.category)
  })
  const operations: OperationalMetrics | null = data?.operations || null
  const outcomes: OutcomeMetrics | null = data?.outcomes || null
  const jobsToday: JobTodayItem[] = data?.jobsToday || []
  const recentCalls: RecentCallItem[] = data?.recentCalls || []
  const loading = isLoading
  const error = isError ? (queryError?.message || 'Failed to load dashboard metrics.') : null

  const canViewFinancials = data?.permissions?.canViewFinancials ?? (role === 'owner' || role === 'admin' || role === 'super_admin')
  const canViewInvoices = data?.permissions?.canViewInvoices ?? (role === 'owner' || role === 'admin' || role === 'super_admin')
  const canViewQuotes = data?.permissions?.canViewQuotes ?? (role === 'owner' || role === 'admin' || role === 'super_admin')

  // Trigger Milestones on Free Tier — ONLY after an achievement is reached (First Booking or Missed Call Recovery)
  useEffect(() => {
    if (isLoading || !data) return
    const isFree = (planId || '').toLowerCase() === 'free' || (subscriptionStatus || '').toLowerCase() === 'free'
    if (!isFree || !orgId) return

    // Achievement 1: First customer booking milestone
    const totalBookings = outcomes?.bookingsFromCaptoDesk?.totalBookings ?? 0
    const bookedCount = data?.trialStatus?.bookedCount ?? 0
    const effectiveBookings = Math.max(totalBookings, bookedCount)

    if (effectiveBookings >= 1) {
      const bookingSeenKey = `captodesk_milestone_booking_seen_${orgId}`
      const legacyKey = `captodesk_first_booking_milestone_seen_${orgId}`
      const hasSeen = typeof window !== 'undefined' ? (localStorage.getItem(bookingSeenKey) || localStorage.getItem(legacyKey)) : 'true'
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setCelebrationModal({ open: true, type: 'booking', isInteractiveTest: false })
        }, 750)
        return () => clearTimeout(timer)
      }
    }

    // Achievement 2: Missed call text back milestone (real calls received/handled)
    const missedCalls = outcomes?.recoveredConversations?.totalMissedCalls ?? 0
    const missedCallsRecovered = operations?.missedCallsRecovered ?? 0
    const recentCallsCount = recentCalls?.length ?? 0
    const effectiveCalls = Math.max(missedCalls, missedCallsRecovered, recentCallsCount)

    if (effectiveCalls >= 1) {
      const missedCallSeenKey = `captodesk_milestone_missed_call_seen_${orgId}`
      const hasSeen = typeof window !== 'undefined' ? localStorage.getItem(missedCallSeenKey) : 'true'
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setCelebrationModal({ open: true, type: 'missed_call', isInteractiveTest: false })
        }, 750)
        return () => clearTimeout(timer)
      }
    }
  }, [isLoading, data, planId, subscriptionStatus, outcomes, operations, recentCalls, orgId])

  const handleCloseCelebrationModal = () => {
    if (orgId && typeof window !== 'undefined') {
      if (celebrationModal.type === 'booking') {
        localStorage.setItem(`captodesk_milestone_booking_seen_${orgId}`, 'true')
        localStorage.setItem(`captodesk_first_booking_milestone_seen_${orgId}`, 'true')
      } else {
        localStorage.setItem(`captodesk_milestone_missed_call_seen_${orgId}`, 'true')
      }
    }
    setCelebrationModal(prev => ({ ...prev, open: false }))
  }

  // Solo Owner & Field Operations: Determine active/upcoming job for today's route
  const nonPracticeJobs = jobsToday.filter(j => !isPracticeJob(j))
  const activeJob =
    nonPracticeJobs.find(j => j.status === 'in_progress') ||
    nonPracticeJobs.find(j => j.status === 'arrived') ||
    nonPracticeJobs.find(j => j.status === 'en_route') ||
    nonPracticeJobs.find(j => j.status === 'scheduled' || j.status === 'confirmed') ||
    null

  const allCompletedToday =
    nonPracticeJobs.length > 0 &&
    nonPracticeJobs.every(j => j.status === 'completed' || j.status === 'cancelled')

  const enRouteJobPayload = activeJob ? {
    id: activeJob.id,
    job_number: activeJob.jobNumber,
    title: activeJob.title,
    contact: {
      name: activeJob.customerName,
      phone: activeJob.customerPhone || '',
      address: activeJob.address || null
    },
    technician_name: activeJob.technicianName && activeJob.technicianName !== 'Unassigned' ? activeJob.technicianName : (userFullName || 'Lead Technician'),
    assigned_profile: { full_name: activeJob.technicianName },
    tracking_token: activeJob.trackingToken || null
  } : null

  const handleConfirmEnRoute = async ({
    technicianName,
    etaMinutes,
    notifyCustomer
  }: {
    technicianName: string
    etaMinutes: number
    notifyCustomer: boolean
  }) => {
    if (!activeJob) return
    try {
      const res = await fetch(`/api/client/jobs/${activeJob.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'en_route',
          technicianName,
          etaMinutes,
          notifyCustomer
        })
      })
      const result = await res.json()
      if (res.ok && result.success) {
        toast.success(
          notifyCustomer
            ? `🚗 On my way! Customer notified with ~${etaMinutes}m ETA & tracking link.`
            : 'Job marked en route.'
        )
        await refetch()
      } else {
        toast.error(result.error || 'Failed to update status to en route.')
      }
    } catch {
      toast.error('Network error updating status.')
    }
  }

  const handleTimestampAction = async (action: 'arrived' | 'started' | 'completed') => {
    if (!activeJob) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/client/jobs/${activeJob.id}/timestamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const result = await res.json()
      if (res.ok && result.success) {
        if (action === 'arrived') {
          toast.success('📍 Marked arrived on-site! Customer notified.')
        } else if (action === 'started') {
          toast.success('▶️ Started work on-site! Job is now in progress.')
        } else if (action === 'completed') {
          toast.success('✅ Job completed! Draft invoice generated automatically.')
        }
        await refetch()
      } else {
        toast.error(result.error || 'Failed to update job status.')
      }
    } catch {
      toast.error('Network error updating job.')
    } finally {
      setActionLoading(false)
    }
  }

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date())

  const getAttentionMeta = (category: AttentionItem['category']) => {
    switch (category) {
      case 'missed_call':
        return {
          label: 'Missed Call',
          variant: 'danger' as const,
          icon: PhoneMissed
        }
      case 'lead':
        return {
          label: 'New Lead',
          variant: 'info' as const,
          icon: Target
        }
      case 'message':
        return {
          label: 'Unread Inquiry',
          variant: 'info' as const,
          icon: MessageSquare
        }
      case 'quote':
        return {
          label: 'Expiring Estimate',
          variant: 'warning' as const,
          icon: FileText
        }
      case 'appointment':
        return {
          label: 'Booking Request',
          variant: 'success' as const,
          icon: CalendarCheck
        }
      case 'invoice':
        return {
          label: 'Overdue Balance',
          variant: 'danger' as const,
          icon: CreditCard
        }
      case 'retention':
        return {
          label: 'Carrier Verification',
          variant: 'warning' as const,
          icon: AlertCircle
        }
      default:
        return {
          label: 'Action Required',
          variant: 'neutral' as const,
          icon: AlertCircle
        }
    }
  }

  return (
    <div className="space-y-8">
      
      {/* ── Page Header: Today's Briefing ── */}
      <PageHeader
        title="Today's Command Center"
        badge={
          <Badge variant="neutral" size="default" suppressHydrationWarning>
            {todayFormatted}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyBookingUrl}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
              title="Copy public booking link"
            >
              {bookingCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                  <span className="hidden sm:inline">Booking Link</span>
                </>
              )}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
              title="Preview public booking page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <FilterTabs
              tabs={[
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
              ]}
              activeTab={period}
              onChange={(val) => setPeriod(val as TimeRange)}
              ariaLabel="Dashboard time period"
            />
            <Button
              variant="outline"
              size="icon-touch"
              onClick={() => refetch()}
              disabled={loading}
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
              className="sm:size-9 min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 cursor-pointer"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Could not load dashboard data"
          message={error}
          onRetry={() => refetch()}
        />
      )}

      {/* ── Trial Limit Notification Banner (BILL-001) ── */}
      {data?.trialStatus?.isTrial && data?.trialStatus?.isExceeded && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                Trial Limit Reached — Automated SMS Recovery Paused
              </h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                {data.trialStatus.reason || `You have reached the trial quota (${data.trialStatus.bookedCount}/${data.trialStatus.maxBookings} bookings).`} Public bookings continue to succeed safely, but outbound SMS auto-replies and reminders are paused.
              </p>
            </div>
          </div>
          <Link
            href="/client/billing"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <span>Upgrade Plan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Day-1 Native SMS & Quick Share Booking Link Bar (Only for Free / Unpaid accounts that haven't dismissed it) */}
      {!isPayingCustomer && !bookingShareDismissed && (
        <BookingShareBar
          slug={orgSlug}
          showUpgradeCallout={false}
          onDismiss={handleDismissBookingBar}
          onTestMissedCall={() => {
            setCelebrationModal({ open: true, type: 'missed_call', isInteractiveTest: true })
          }}
        />
      )}

      {/* ── Section 1: Needs Attention (Only surfaces when there is an active unread message or missed call) ── */}
      {!loading && visibleAttentionItems.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Needs Immediate Attention
              </h2>
              <Badge variant="warning" size="sm" className="font-bold tabular-nums">
                {visibleAttentionItems.length}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleAttentionItems.map((item) => {
              const meta = getAttentionMeta(item.category)
              const Icon = meta.icon

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={meta.variant} size="sm" className="font-semibold uppercase tracking-wider">
                        <Icon className="h-3 w-3" />
                        <span>{meta.label}</span>
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                          {item.timestamp ? new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDismissAttentionItem(item.id)
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Dismiss alert"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.subtitle}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end">
                    <Link
                      href={item.actionHref}
                      onClick={() => handleAttentionActionClick(item.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
      {/* ── Section 2: Today's Schedule & Key Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (7 cols): Today's Field Schedule */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Today&apos;s Field Schedule
            </h2>
            <Link 
              href="/client/calendar" 
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
            >
              Full Calendar &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : jobsToday.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-zinc-500 shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    No appointments scheduled for today
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 pl-4">
                  Confirmed bookings and route jobs will appear here.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/client/calendar"
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Schedule Job</span>
                </Link>
                <Link
                  href="/client/quotes"
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-750 transition-colors shadow-2xs cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>New Quote</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Driver's Seat Hero Card (Solo Owner Command) */}
              {activeJob && (
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs relative overflow-hidden space-y-4">
                  {/* Subtle vertical priority indicator bar */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      activeJob.status === 'in_progress' ? "bg-emerald-500" :
                      activeJob.status === 'arrived' ? "bg-amber-500" :
                      activeJob.status === 'en_route' ? "bg-blue-600" : "bg-slate-400 dark:bg-zinc-600"
                    )}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      {activeJob.status === 'in_progress' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>Active On-Site</span>
                        </span>
                      ) : activeJob.status === 'arrived' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span>Arrived On-Site</span>
                        </span>
                      ) : activeJob.status === 'en_route' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/70 dark:border-blue-900/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>En Route</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Next Job Today</span>
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-medium">
                        #{activeJob.jobNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 px-2.5 py-1 rounded-md">
                      <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                      <span className="tabular-nums">
                        {activeJob.scheduledStart
                          ? new Date(activeJob.scheduledStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                          : 'Today'}
                        {activeJob.scheduledEnd && (
                          <> – {new Date(activeJob.scheduledEnd).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                        {activeJob.customerName}
                      </h3>
                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                        {activeJob.title}
                      </span>
                    </div>

                    {activeJob.address ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                        <span className="truncate">{activeJob.address}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 dark:text-zinc-500">
                        No physical address specified
                      </div>
                    )}
                  </div>

                  {/* Tactile 48px Action Buttons for Field Ergonomics */}
                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                    {activeJob.status === 'en_route' ? (
                      <Button
                        type="button"
                        onClick={() => handleTimestampAction('arrived')}
                        disabled={actionLoading}
                        className="min-h-[44px] px-4 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer gap-2"
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                        <span>Mark Arrived</span>
                      </Button>
                    ) : activeJob.status === 'arrived' ? (
                      <Button
                        type="button"
                        onClick={() => handleTimestampAction('started')}
                        disabled={actionLoading}
                        className="min-h-[44px] px-4 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer gap-2"
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                        <span>Start Work</span>
                      </Button>
                    ) : activeJob.status === 'in_progress' ? (
                      <Button
                        type="button"
                        onClick={() => handleTimestampAction('completed')}
                        disabled={actionLoading}
                        className="min-h-[44px] px-4 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer gap-2"
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span>Complete Job</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => setEnRouteModalOpen(true)}
                        disabled={actionLoading}
                        className="min-h-[44px] px-4 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer gap-2"
                      >
                        <Truck className="h-4 w-4" />
                        <span>On My Way</span>
                      </Button>
                    )}

                    {activeJob.address && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeJob.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-lg border border-slate-200 dark:border-zinc-750 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                        title="Open in Google Maps"
                      >
                        <Navigation className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Directions</span>
                      </a>
                    )}

                    {activeJob.customerPhone && (
                      <>
                        <a
                          href={`tel:${activeJob.customerPhone}`}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-zinc-750 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                          title="Call Customer"
                        >
                          <Phone className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                          <span>Call</span>
                        </a>
                        <a
                          href={`sms:${activeJob.customerPhone}`}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-zinc-750 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                          title="Text Customer"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                          <span>Text</span>
                        </a>
                      </>
                    )}

                    <div className="ml-auto">
                      <Link
                        href={`/client/jobs`}
                        className="inline-flex items-center gap-1 min-h-[44px] px-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                      >
                        <span>Details &rarr;</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Celebratory Banner when all field appointments finished */}
              {allCompletedToday && !activeJob && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                        All field jobs completed for today!
                      </p>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                        {nonPracticeJobs.length} {nonPracticeJobs.length === 1 ? 'appointment' : 'appointments'} finished. Great job!
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/client/calendar"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    <span>View Calendar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* Day's Agenda Timeline */}
              <div className="space-y-2.5">
              {jobsToday.map((job) => {
                if (isPracticeJob(job)) {
                  const realJobsCount = jobsToday.filter(j => !isPracticeJob(j)).length
                  if (realJobsCount > 0 || dismissedPracticeIds.includes(job.id)) {
                    return null
                  }
                  return (
                    <PracticeJobCard
                      key={job.id}
                      job={{
                        id: job.id,
                        title: job.title,
                        status: job.status,
                        contact: {
                          name: job.customerName,
                          phone: '+1 (555) 019-9999',
                          address: job.address
                        }
                      }}
                      currentPlanId={planId}
                      onDismiss={(id) => setDismissedPracticeIds(prev => [...prev, id])}
                    />
                  )
                }

                const isActiveCurrent = activeJob?.id === job.id
                return (
                <div
                  key={job.id}
                  className={cn(
                    "rounded-xl border bg-white dark:bg-zinc-900 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                    isActiveCurrent
                      ? "border-blue-500/60 dark:border-blue-500/50 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs"
                      : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">{job.title}</span>
                      {isActiveCurrent && (
                        <Badge variant="info" size="sm" className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5">
                          Current
                        </Badge>
                      )}
                      <Badge
                        variant={
                          job.status === 'completed'
                            ? 'success'
                            : job.status === 'in_progress'
                            ? 'info'
                            : job.status === 'en_route'
                            ? 'info'
                            : job.status === 'arrived'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                        className="capitalize font-semibold"
                      >
                        {job.status ? job.status.replace('_', ' ') : 'Scheduled'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                      <span className="font-medium text-slate-700 dark:text-zinc-300">{job.customerName}</span>
                      {job.address && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 truncate text-slate-500 dark:text-zinc-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {job.address}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-xs text-slate-700 dark:text-zinc-300 font-semibold flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-zinc-700">
                      <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      {job.scheduledStart ? new Date(job.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                    </div>
                    <Link
                      href="/client/jobs"
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                    >
                      View &rarr;
                    </Link>
                  </div>
                </div>
              )
            })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Pipeline Overview */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Pipeline Status
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Open Leads */}
            <Link
              href="/client/leads"
              className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-blue-300 dark:hover:border-blue-800 transition-all group block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">Open Leads</span>
                <Target className="h-3.5 w-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2 tabular-nums group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {operations?.newLeads ?? 0}
              </div>
            </Link>

            {/* Pending Estimates / Active Bookings */}
            {canViewQuotes ? (
              <Link
                href="/client/quotes"
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800 transition-all group block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">Pending Quotes</span>
                  <FileText className="h-3.5 w-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2 tabular-nums group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {operations?.quotesAwaitingResponse ?? 0}
                </div>
              </Link>
            ) : (
              <Link
                href="/client/calendar"
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800 transition-all group block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">Active Bookings</span>
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2 tabular-nums group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {operations?.activeBookings ?? 0}
                </div>
              </Link>
            )}

            {/* Unpaid Invoices / Today's Jobs */}
            {canViewInvoices && canViewFinancials ? (
              <Link
                href="/client/invoices"
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all group block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">Unpaid Invoices</span>
                  <CreditCard className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2 tabular-nums group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  ${((outcomes?.paymentCollection?.invoicedAmount ?? 0) - (outcomes?.paymentCollection?.collectedAmount ?? 0)).toLocaleString()}
                </div>
              </Link>
            ) : (
              <Link
                href="/client/jobs"
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all group block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">Today&apos;s Jobs</span>
                  <Briefcase className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2 tabular-nums group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {operations?.jobsToday ?? jobsToday.length}
                </div>
              </Link>
            )}

            {/* Inbound Call Recovery */}
            <Link
              href="/client/inbox"
              className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-purple-300 dark:hover:border-purple-800 transition-all group block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">Calls Handled</span>
                <PhoneCall className="h-3.5 w-3.5 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2 tabular-nums group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {outcomes?.recoveredConversations?.totalMissedCalls ?? 0}
              </div>
            </Link>
          </div>
        </div>

      </div>

      {/* ── Section 3: Performance & Cash Flow ── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-zinc-800 pt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Performance &amp; Cash Flow
          </h2>
          <Badge variant="neutral" size="default">
            {period === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Revenue Collected (or Calls Recovered if restricted) */}
          {canViewFinancials ? (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Payments Collected</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                ${(outcomes?.paymentCollection?.collectedAmount ?? 0).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Calls Recovered</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {outcomes?.recoveredConversations?.recoveredCount ?? 0}
              </div>
            </div>
          )}

          {/* 2. Missed Call Recovery */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Missed Call Recovery</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {outcomes?.recoveredConversations?.recoveryRate ?? 0}%
            </div>
          </div>

          {/* 3. Bookings Won */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Appointments Won</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
              {outcomes?.bookingsFromCaptoDesk?.totalBookings ?? 0}
            </div>
          </div>

          {/* 4. Quote Acceptance (or Repeat Bookings if restricted) */}
          {canViewQuotes ? (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Quote Acceptance Rate</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {outcomes?.quoteConversion?.conversionRate ?? 0}%
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Repeat Bookings</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {outcomes?.repeatBookings?.repeatRate ?? 0}%
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Recent Inbound Calls ── */}
      <section className="space-y-3.5 border-t border-slate-200 dark:border-zinc-800 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Recent Inbound Calls & Auto-Replies
          </h2>
          <Link href="/client/inbox" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors">
            View All in Inbox &rarr;
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 text-xs text-slate-500 dark:text-zinc-400 text-center shadow-2xs">
            No recent calls logged.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/80">
            {recentCalls.slice(0, 5).map(call => (
              <div 
                key={call.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-zinc-850/60 transition-colors text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-zinc-100 font-mono">{call.callerNumber}</span>
                    <span className="text-slate-500 dark:text-zinc-400 text-[11px] ml-2 truncate">
                      {call.autoReplySent ? 'Instant SMS auto-reply sent' : 'Call answered or logged'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                    {call.createdAt ? new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                  </span>
                  <Link
                    href="/client/inbox"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                  >
                    Reply
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Achievement & Milestone Celebration Modal (Pop-up after Booking or Missed Call) */}
      <FirstBookingCelebrationModal
        isOpen={celebrationModal.open}
        onClose={handleCloseCelebrationModal}
        milestoneType={celebrationModal.type}
        isInteractiveTest={celebrationModal.isInteractiveTest}
        bookingCount={Math.max(outcomes?.bookingsFromCaptoDesk?.totalBookings ?? 0, data?.trialStatus?.bookedCount ?? 0, 1)}
      />

      {/* Solo Owner Live ETA Dispatch Modal */}
      {enRouteJobPayload && (
        <EnRouteModal
          isOpen={enRouteModalOpen}
          onClose={() => setEnRouteModalOpen(false)}
          job={enRouteJobPayload}
          organizationName={orgName}
          onConfirm={handleConfirmEnRoute}
        />
      )}
    </div>
  )
}
