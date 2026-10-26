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
  Sparkles
} from 'lucide-react'
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
import { isPracticeJob } from '@/lib/jobs/practice-job'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const { orgName, orgSlug, subscriptionStatus, planId, role } = useWorkspace()
  const [period, setPeriod] = useState<TimeRange>('30d')
  const [dismissedPracticeIds, setDismissedPracticeIds] = useState<string[]>([])

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
  const operations: OperationalMetrics | null = data?.operations || null
  const outcomes: OutcomeMetrics | null = data?.outcomes || null
  const jobsToday: JobTodayItem[] = data?.jobsToday || []
  const recentCalls: RecentCallItem[] = data?.recentCalls || []
  const loading = isLoading
  const error = isError ? (queryError?.message || 'Failed to load dashboard metrics.') : null

  const canViewFinancials = data?.permissions?.canViewFinancials ?? (role === 'owner' || role === 'admin' || role === 'super_admin')
  const canViewInvoices = data?.permissions?.canViewInvoices ?? (role === 'owner' || role === 'admin' || role === 'super_admin')
  const canViewQuotes = data?.permissions?.canViewQuotes ?? (role === 'owner' || role === 'admin' || role === 'super_admin')

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date())

  const getAttentionMeta = (category: AttentionItem['category']) => {
    switch (category) {
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
          <div className="flex items-center gap-2.5">
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

      {/* Day-1 Native SMS & Quick Share Booking Link Bar */}
      <BookingShareBar slug={orgSlug} />

      {/* ── Section 1: Needs Attention (Action-First Queue) ── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Needs Immediate Attention
            </h2>
            {attentionQueue.length > 0 && (
              <Badge variant="warning" size="sm" className="font-bold tabular-nums">
                {attentionQueue.length}
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-2xs">
                <div className="h-4 w-24 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-5 w-48 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-full bg-slate-100/70 dark:bg-zinc-800/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : attentionQueue.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-5 py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">All caught up!</p>
              </div>
            </div>
            <Link
              href="/client/inbox"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>Open 2-Way Inbox</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {attentionQueue.map((item) => {
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
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today'}
                      </span>
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
        )}
      </section>

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
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-8 text-center bg-white/60 dark:bg-zinc-900/40 shadow-2xs">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500 mx-auto mb-3">
                <Calendar className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">No field appointments scheduled for today</p>
              <div className="mt-4">
                <Link
                  href="/client/calendar"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Book Appointment Now</span>
                </Link>
              </div>
            </div>
          ) : (
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

                return (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">{job.title}</span>
                      <Badge
                        variant={
                          job.status === 'completed'
                            ? 'success'
                            : job.status === 'in_progress'
                            ? 'info'
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

      {/* ── Section 3: Verified Outcomes (Business Numbers) ── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-zinc-800 pt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Verified Attributed Performance
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

    </div>
  )
}
