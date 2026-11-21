'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useMemo } from 'react'
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
  X,
  Share2,
  ChevronDown,
  ChevronUp,
  Sliders,
  Users,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { EnRouteModal } from '@/components/jobs/en-route-modal'
import { Modal } from '@/components/ui/modal'
import { JobStatusBadge } from '@/components/operations/job-status-badge'
import { TouchActionRow } from '@/components/operations/touch-action-row'
import { createClient } from '@/lib/supabase/client'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
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
import { formatTimeInTz, formatDateInTz, formatDateToIsoYmdInTz, parseZonedDateAndTimeToUtc } from '@/lib/temporal/timezone'
import { FirstBookingCelebrationModal } from '@/components/billing/first-booking-celebration-modal'
import { isPracticeJob } from '@/lib/jobs/practice-job'
import { JobWonBadge } from '@/components/jobs/job-won-badge'
import { FoundMoneyUnlockModal } from '@/components/billing/found-money-unlock-modal'
import { PushNotificationBanner } from '@/components/notifications/push-notification-banner'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const { orgId, orgName, orgSlug, orgTimezone: wsOrgTimezone, subscriptionStatus, planId, role, userFullName } = useWorkspace()
  const orgTimezone = wsOrgTimezone || 'America/Chicago'
  
  const [enRouteModalOpen, setEnRouteModalOpen] = useState(false)
  const [foundMoneyModalOpen, setFoundMoneyModalOpen] = useState(false)
  const [gatedJobData, setGatedJobData] = useState<{ amount?: number; customerName?: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCompletedJobs, setShowCompletedJobs] = useState(false)
  const [bookingCopied, setBookingCopied] = useState(false)
  const [dismissedAttentionIds, setDismissedAttentionIds] = useState<string[]>([])
  const [rescheduleJob, setRescheduleJob] = useState<JobTodayItem | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('09:00')
  const [rescheduling, setRescheduling] = useState(false)
  
  const [celebrationModal, setCelebrationModal] = useState<{
    open: boolean
    type: 'booking' | 'missed_call'
    isInteractiveTest?: boolean
  }>({ open: false, type: 'booking', isInteractiveTest: false })

  // Public Booking Link construction
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

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${orgName || 'CaptoDesk'} Online Booking`,
          text: `Book an appointment online with ${orgName || 'us'}:`,
          url: bookingUrl
        })
        toast.success('Booking link shared!')
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyBookingUrl()
        }
      }
    } else {
      handleCopyBookingUrl()
    }
  }

  // Fetch Dashboard Data
  const { data, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['dashboard', '30d', orgTimezone],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const reqHeaders: Record<string, string> = {}
      if (session?.access_token) {
        reqHeaders['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch(`/api/client/dashboard?period=30d&timezone=${encodeURIComponent(orgTimezone)}`, { 
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
    staleTime: 45 * 1000
  })

  const attentionQueue: AttentionItem[] = data?.attentionQueue || []
  const visibleAttentionItems = attentionQueue.filter(item => {
    return !dismissedAttentionIds.includes(item.id)
  })

  const operations: OperationalMetrics | null = data?.operations || null
  const outcomes: OutcomeMetrics | null = data?.outcomes || null
  const jobsToday: JobTodayItem[] = data?.jobsToday || []
  const upcomingJobs: JobTodayItem[] = data?.upcomingJobs || []
  const nextUpJob: JobTodayItem | null = data?.nextUpJob || null
  const recentCalls: RecentCallItem[] = data?.recentCalls || []
  const error = isError ? (queryError?.message || 'Failed to load dashboard data.') : null

  // Greeting determination based on user's local hour in workspace timezone
  const greeting = useMemo(() => {
    try {
      const nowStr = new Date().toLocaleString('en-US', { timeZone: orgTimezone, hour: 'numeric', hour12: false })
      const hour = parseInt(nowStr, 10)
      if (hour < 12) return 'Good morning'
      if (hour < 17) return 'Good afternoon'
      return 'Good evening'
    } catch {
      return 'Welcome back'
    }
  }, [orgTimezone])

  const firstName = useMemo(() => {
    if (!userFullName) return ''
    return userFullName.split(' ')[0]
  }, [userFullName])

  // Current formatted date in workspace timezone
  const todayFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: orgTimezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }).format(new Date())
    } catch {
      return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    }
  }, [orgTimezone])

  // Solo Owner & Field Operations: Determine active/upcoming job for today's route
  const nonPracticeJobs = useMemo(() => jobsToday.filter(j => !isPracticeJob(j)), [jobsToday])

  const completedJobs = useMemo(() => nonPracticeJobs.filter(j => j.status === 'completed'), [nonPracticeJobs])
  const remainingJobs = useMemo(() => nonPracticeJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled'), [nonPracticeJobs])

  const activeJob = useMemo(() => {
    return (
      nonPracticeJobs.find(j => j.status === 'in_progress') ||
      nonPracticeJobs.find(j => j.status === 'arrived') ||
      nonPracticeJobs.find(j => j.status === 'en_route') ||
      nonPracticeJobs.find(j => j.status === 'scheduled' || j.status === 'confirmed') ||
      null
    )
  }, [nonPracticeJobs])

  const allCompletedToday = nonPracticeJobs.length > 0 && remainingJobs.length === 0

  const enRouteJobPayload = activeJob ? {
    id: activeJob.id,
    job_number: activeJob.jobNumber,
    title: activeJob.title,
    contact: {
      name: activeJob.customerName,
      phone: activeJob.customerPhone || '',
      address: activeJob.address || null
    },
    technician_name:
      activeJob.technicianName && activeJob.technicianName !== 'Unassigned'
        ? activeJob.technicianName
        : null,
    assigned_profile:
      activeJob.technicianName && activeJob.technicianName !== 'Unassigned'
        ? { full_name: activeJob.technicianName }
        : null,
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
      const result = await res.json().catch(() => ({}))
      if (res.ok && result.success) {
        toast.success(
          notifyCustomer
            ? `On my way! Customer texted live GPS tracking with ~${etaMinutes}m ETA.`
            : 'Marked En Route.'
        )
        await refetch()
        return
      }
      if (res.status === 402 || result.upgradeRequired) {
        setGatedJobData({
          amount: activeJob.servicePrice || 195,
          customerName: activeJob.customerName
        })
        setEnRouteModalOpen(false)
        setFoundMoneyModalOpen(true)
        return
      }
      toast.error(result.error || 'Failed to update status to en route.')
    } catch {
      toast.error('Network error updating status. Please try again.')
    }
  }

  const handleOpenReschedule = (job: JobTodayItem) => {
    setRescheduleJob(job)
    if (job.scheduledStart) {
      setRescheduleDate(formatDateToIsoYmdInTz(job.scheduledStart, orgTimezone))
      setRescheduleTime(formatTimeInTz(job.scheduledStart, orgTimezone, { hour12: false }))
    } else {
      setRescheduleDate(formatDateToIsoYmdInTz(new Date(), orgTimezone))
      setRescheduleTime('09:00')
    }
  }

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rescheduleJob || !rescheduleDate || !rescheduleTime) return
    setRescheduling(true)
    try {
      const utcStart = parseZonedDateAndTimeToUtc(rescheduleDate, rescheduleTime, orgTimezone)
      const res = await fetch('/api/client/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rescheduleJob.id,
          scheduledStart: utcStart.toISOString(),
          status: 'scheduled'
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to reschedule job')
      }
      toast.success('Job rescheduled successfully.')
      setRescheduleJob(null)
      await refetch()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reschedule')
    } finally {
      setRescheduling(false)
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
          toast.success('Marked arrived on-site! Customer notified.')
        } else if (action === 'started') {
          toast.success('Work started on-site. Job is now in progress.')
        } else if (action === 'completed') {
          toast.success('Job completed! Invoice ready for payment.', {
            action: {
              label: 'Collect Payment',
              onClick: () => router.push('/client/invoices')
            }
          })
        }
        await refetch()
      } else {
        toast.error(result.error || 'Failed to update timestamp')
      }
    } catch {
      toast.error('Network error updating job')
    } finally {
      setActionLoading(false)
    }
  }

  const getAttentionMeta = (category: string) => {
    switch (category) {
      case 'lead':
        return { label: 'New Lead', variant: 'info' as const, icon: Target }
      case 'message':
        return { label: 'Unread Chat', variant: 'info' as const, icon: MessageSquare }
      case 'failed_sms':
        return { label: 'Failed SMS', variant: 'danger' as const, icon: AlertCircle }
      case 'missed_call':
        return { label: 'Missed Call', variant: 'danger' as const, icon: PhoneMissed }
      case 'quote':
        return { label: 'Estimate Pending', variant: 'warning' as const, icon: FileText }
      case 'appointment':
        return { label: 'Booking Request', variant: 'success' as const, icon: CalendarCheck }
      case 'invoice':
        return { label: 'Overdue Invoice', variant: 'danger' as const, icon: DollarSign }
      case 'retention':
        return { label: 'Service Alert', variant: 'warning' as const, icon: Clock }
      default:
        return { label: 'Action Required', variant: 'neutral' as const, icon: AlertCircle }
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* ── Top Header: Personal Greeting & Date ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
            {todayFormatted} &bull; {orgName || 'Workspace'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-9 px-3 text-xs font-semibold gap-1.5 cursor-pointer bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>

          <Link
            href="/client/calendar"
            className="min-h-[44px] sm:min-h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Job</span>
          </Link>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Could not load dashboard data"
          message={error}
          onRetry={() => refetch()}
        />
      )}

      {/* Push Notification Banner */}
      <PushNotificationBanner />

      {/* ── Operational Day Progress Strip (1 Row, 4 Key Operational Metrics) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Metric 1: Jobs Today */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
            Jobs Today
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
            {isLoading ? '-' : nonPracticeJobs.length}
          </div>
        </div>

        {/* Metric 2: Completed */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Completed
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {isLoading ? '-' : completedJobs.length}
          </div>
        </div>

        {/* Metric 3: Remaining */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
            Remaining
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
            {isLoading ? '-' : remainingJobs.length}
          </div>
        </div>

        {/* Metric 4: Needs Attention */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Attention Needed
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {isLoading ? '-' : visibleAttentionItems.length}
          </div>
        </div>
      </div>

      {/* ── Needs Attention Priority Queue (Only surfaces when action is genuinely needed) ── */}
      {!isLoading && visibleAttentionItems.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                Action Required ({visibleAttentionItems.length})
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleAttentionItems.map((item) => {
              const meta = getAttentionMeta(item.category)
              const Icon = meta.icon

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-2xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={meta.variant} size="sm" className="font-bold text-[10px] uppercase">
                        <Icon className="h-3 w-3" />
                        <span>{meta.label}</span>
                      </Badge>
                      <button
                        type="button"
                        onClick={() => setDismissedAttentionIds(prev => [...prev, item.id])}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                        title="Dismiss alert"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                      {item.subtitle}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-end">
                    <Link
                      href={item.actionHref}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
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

      {/* ── 2-Column Responsive Workspace Grid (Left: Active Job & Schedule, Right: Quick Actions & Front Desk) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (7 cols): Next Job Command & Today's Schedule */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* A. Driver's Seat Next Job Command Card */}
          {activeJob ? (
            <div className="rounded-3xl border-2 border-blue-600/30 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Next Stop &bull; #{activeJob.jobNumber}
                  </span>
                </div>
                <JobStatusBadge status={activeJob.status} />
              </div>

              {/* Customer & Service Info */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    {activeJob.customerName}
                  </h3>
                  <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1 font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{activeJob.scheduledStart ? formatTimeInTz(activeJob.scheduledStart, orgTimezone) : 'Today'}</span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {activeJob.cleanTitle || activeJob.title}
                </p>

                {activeJob.address ? (
                  <p className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1.5 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{activeJob.address}</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 italic pt-0.5">
                    No physical address specified
                  </p>
                )}
              </div>

              {/* 44px+ Touch-Target Action Controls */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                {activeJob.status === 'en_route' ? (
                  <Button
                    type="button"
                    onClick={() => handleTimestampAction('arrived')}
                    disabled={actionLoading}
                    className="min-h-[44px] px-4 font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer gap-2"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                    <span>Mark Arrived</span>
                  </Button>
                ) : activeJob.status === 'arrived' ? (
                  <Button
                    type="button"
                    onClick={() => handleTimestampAction('started')}
                    disabled={actionLoading}
                    className="min-h-[44px] px-4 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer gap-2"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                    <span>Start Work</span>
                  </Button>
                ) : activeJob.status === 'in_progress' ? (
                  <Button
                    type="button"
                    onClick={() => handleTimestampAction('completed')}
                    disabled={actionLoading}
                    className="min-h-[44px] px-4 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer gap-2"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span>Complete Job</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setEnRouteModalOpen(true)}
                    disabled={actionLoading}
                    className="min-h-[44px] px-4 font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer gap-2"
                  >
                    <Truck className="h-4 w-4" />
                    <span>On My Way (Send ETA SMS)</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenReschedule(activeJob)}
                  className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-1.5"
                >
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Reschedule</span>
                </Button>

                <TouchActionRow
                  phone={activeJob.customerPhone}
                  address={activeJob.address}
                  contactId={activeJob.customerPhone}
                  jobId={activeJob.id}
                  onDetailsClick={() => router.push('/client/field')}
                />
              </div>
            </div>
          ) : allCompletedToday ? (
            /* All Stops Completed Celebration Card */
            <div className="rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                    All stops completed for today
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {completedJobs.length} {completedJobs.length === 1 ? 'appointment' : 'appointments'} marked complete. Ready to collect payment?
                  </p>
                </div>
              </div>

              <Link
                href="/client/invoices"
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
              >
                <span>View Invoices &rarr;</span>
              </Link>
            </div>
          ) : (
            /* Clear Schedule Empty State */
            <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Your schedule is clear today
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Share your public booking link with homeowners or manually schedule a service call to fill your route.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <Link
                  href="/client/calendar"
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule a Job</span>
                </Link>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Booking Link</span>
                </button>
              </div>
            </div>
          )}

          {/* B. Today's Full Stops Queue (Chronological) */}
          {nonPracticeJobs.length > 0 && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Today&apos;s Jobs ({nonPracticeJobs.length})
                </h2>
                <Link
                  href="/client/field"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span>Truck Route</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2">
                {nonPracticeJobs.map((job, idx) => {
                  const isDone = job.status === 'completed'
                  return (
                    <div
                      key={job.id}
                      className={cn(
                        'p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs',
                        isDone
                          ? 'bg-slate-50/70 dark:bg-zinc-900/40 border-slate-200/60 dark:border-zinc-800/60 opacity-80'
                          : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="font-mono text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                          #{idx + 1}
                        </span>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {job.customerName}
                            </span>
                            <JobStatusBadge status={job.status} />
                          </div>
                          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium truncate">
                            {job.cleanTitle || job.title}
                          </p>
                          {job.address && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-500 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{job.address}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        <div className="text-xs font-mono font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{job.scheduledStart ? formatTimeInTz(job.scheduledStart, orgTimezone) : 'Today'}</span>
                        </div>
                        {!isDone && (
                          <button
                            type="button"
                            onClick={() => handleOpenReschedule(job)}
                            className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            Reschedule
                          </button>
                        )}
                        <Link
                          href="/client/field"
                          className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center"
                        >
                          Details &rarr;
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* C. Coming Up This Week */}
          {upcomingJobs.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Coming Up This Week ({upcomingJobs.length})
                </h3>
                <Link
                  href="/client/calendar"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span>Full Schedule</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                {upcomingJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {job.customerName} &bull; {job.cleanTitle || job.title}
                      </p>
                      {job.address && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {job.address}
                        </p>
                      )}
                    </div>
                    <div className="text-xs font-mono font-semibold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md shrink-0 self-end sm:self-auto">
                      {formatDateInTz(job.scheduledStart, orgTimezone, { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTimeInTz(job.scheduledStart, orgTimezone)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column (5 cols): Quick Actions, Booking Link Front Desk & Calls */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* 1. Quick Actions Bar */}
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/client/calendar"
                className="min-h-[44px] p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800 text-left transition-all flex flex-col justify-between"
              >
                <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block mt-1">Schedule Job</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">New appointment</span>
                </div>
              </Link>

              <Link
                href="/client/quotes"
                className="min-h-[44px] p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-800 text-left transition-all flex flex-col justify-between"
              >
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block mt-1">Create Quote</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">Send estimate</span>
                </div>
              </Link>

              <Link
                href="/client/inbox"
                className="min-h-[44px] p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-800 text-left transition-all flex flex-col justify-between"
              >
                <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block mt-1">Open Inbox</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">Client messages</span>
                </div>
              </Link>

              <Link
                href="/client/customers"
                className="min-h-[44px] p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800 text-left transition-all flex flex-col justify-between"
              >
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block mt-1">Customers</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">Client profiles</span>
                </div>
              </Link>
            </div>
          </div>

          {/* 2. Public Booking Link Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Online Booking Link
                </span>
              </div>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Preview</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-700 dark:text-zinc-300 truncate select-all">
                {bookingUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyBookingUrl}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {bookingCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                Paste into your Google Business Profile and Instagram bio.
              </p>
              <button
                type="button"
                onClick={handleNativeShare}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
              >
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* 3. Recent Inbound Inquiries & Calls */}
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Recent Inquiries &amp; Calls
              </h2>
              <Link href="/client/inbox" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Inbox &rarr;
              </Link>
            </div>

            {recentCalls.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 py-1">
                No recent customer calls logged. Inbound calls with auto-replies appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {recentCalls.slice(0, 3).map((call) => (
                  <div
                    key={call.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-zinc-200">
                        {call.customerName || call.callerNumber}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {call.status === 'completed' || call.status === 'answered' ? 'Answered call' : 'Missed call with auto text-back'}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatTimeInTz(call.createdAt, orgTimezone)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* En Route Modal */}
      {enRouteJobPayload && (
        <EnRouteModal
          isOpen={enRouteModalOpen}
          onClose={() => setEnRouteModalOpen(false)}
          job={enRouteJobPayload}
          onConfirm={handleConfirmEnRoute}
        />
      )}

      {/* Found Money Paywall Modal */}
      <FoundMoneyUnlockModal
        isOpen={foundMoneyModalOpen}
        onClose={() => setFoundMoneyModalOpen(false)}
        amountDue={gatedJobData?.amount || 195}
        customerName={gatedJobData?.customerName || 'Customer'}
      />

      {/* Celebration Modal */}
      <FirstBookingCelebrationModal
        isOpen={celebrationModal.open}
        onClose={() => setCelebrationModal(prev => ({ ...prev, open: false }))}
        milestoneType={celebrationModal.type}
      />

      {/* Quick Reschedule Modal */}
      {rescheduleJob && (
        <Modal
          open={Boolean(rescheduleJob)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setRescheduleJob(null)
          }}
          title={`Reschedule Job #${rescheduleJob.jobNumber}`}
          description={`Update scheduled start for ${rescheduleJob.customerName} (${orgTimezone}).`}
          size="sm"
        >
          <form onSubmit={handleConfirmReschedule} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                New Date
              </label>
              <input
                type="date"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                New Time
              </label>
              <input
                type="time"
                required
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRescheduleJob(null)}
                disabled={rescheduling}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={rescheduling}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                {rescheduling ? 'Saving...' : 'Confirm Reschedule'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  )
}
