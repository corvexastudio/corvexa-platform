'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
import { 
  AttentionItem, 
  OperationalMetrics, 
  OutcomeMetrics, 
  JobTodayItem, 
  RecentCallItem, 
  TimeRange 
} from '@/lib/dashboard/dashboard-service'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<TimeRange>('30d')
  const [org, setOrg] = useState<any>(null)
  const [attentionQueue, setAttentionQueue] = useState<AttentionItem[]>([])
  const [operations, setOperations] = useState<OperationalMetrics | null>(null)
  const [outcomes, setOutcomes] = useState<OutcomeMetrics | null>(null)
  const [jobsToday, setJobsToday] = useState<JobTodayItem[]>([])
  const [recentCalls, setRecentCalls] = useState<RecentCallItem[]>([])

  const loadDashboard = useCallback(async (selectedPeriod: TimeRange) => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch organization details safely
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.org_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', profile.org_id)
            .maybeSingle()
          if (orgData) {
            setOrg(orgData)
          }
        }
      }

      // 2. Fetch aggregated dashboard data
      const { data: { session } } = await supabase.auth.getSession()
      const reqHeaders: Record<string, string> = {}
      if (session?.access_token) {
        reqHeaders['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch(`/api/client/dashboard?period=${selectedPeriod}`, { headers: reqHeaders })
      if (res.ok) {
        const data = await res.json()
        setAttentionQueue(data.attentionQueue || [])
        setOperations(data.operations || null)
        setOutcomes(data.outcomes || null)
        setJobsToday(data.jobsToday || [])
        setRecentCalls(data.recentCalls || [])
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 403 && (errData.error?.includes('profile not registered') || errData.error?.includes('not linked to an organization'))) {
          // Attempt self-healing provisioning once
          try {
            const healHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
              healHeaders['Authorization'] = `Bearer ${session.access_token}`
            }
            const healRes = await fetch('/api/onboarding', {
              method: 'POST',
              headers: healHeaders,
              body: JSON.stringify({})
            })
            if (healRes.ok) {
              const retryRes = await fetch(`/api/client/dashboard?period=${selectedPeriod}`, { headers: reqHeaders })
              if (retryRes.ok) {
                const retryData = await retryRes.json()
                setAttentionQueue(retryData.attentionQueue || [])
                setOperations(retryData.operations || null)
                setOutcomes(retryData.outcomes || null)
                setJobsToday(retryData.jobsToday || [])
                setRecentCalls(retryData.recentCalls || [])
                return
              }
            }
          } catch {
            // Non-fatal
          }
          setError(
            errData.error || 
            'Your user profile is not linked to an organization yet. Please complete workspace setup at /client/onboarding.'
          )
          return
        }
        setError(errData.error || 'Failed to load dashboard metrics.')
      }
    } catch {
      setError('Unable to load dashboard. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadDashboard(period)
  }, [loadDashboard, period])

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
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40',
          icon: Target
        }
      case 'message':
        return {
          label: 'Unread Inquiry',
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/40',
          icon: MessageSquare
        }
      case 'quote':
        return {
          label: 'Expiring Estimate',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40',
          icon: FileText
        }
      case 'appointment':
        return {
          label: 'Booking Request',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40',
          icon: CalendarCheck
        }
      case 'invoice':
        return {
          label: 'Overdue Balance',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40',
          icon: CreditCard
        }
      default:
        return {
          label: 'Action Required',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
          icon: AlertCircle
        }
    }
  }

  return (
    <div className="space-y-8">
      
      {/* ── Page Header: Today's Briefing ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Today&apos;s Command Center
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700" suppressHydrationWarning>
              {todayFormatted}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {org?.name ? `${org.name} • Operational status, dispatch & triage.` : 'Daily operational overview.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Period selector */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100/80 dark:bg-zinc-900 p-0.5 text-xs shadow-2xs">
            <button
              onClick={() => setPeriod('7d')}
              className={cn(
                "px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer",
                period === '7d' 
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              )}
            >
              7 Days
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={cn(
                "px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer",
                period === '30d' 
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              )}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={() => loadDashboard(period)}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Could not load dashboard data"
          message={error}
          onRetry={() => loadDashboard(period)}
        />
      )}

      {/* ── Section 1: Needs Attention (Action-First Queue) ── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Needs Immediate Attention
            </h2>
            {attentionQueue.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {attentionQueue.length}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Prioritized triage items</span>
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
                <p className="text-xs text-emerald-800/80 dark:text-emerald-400/90 mt-0.5">
                  No unread inquiries, expiring quotes, or past-due balances need your attention right now.
                </p>
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
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", meta.badgeClass)}>
                        <Icon className="h-3 w-3" />
                        <span>{meta.label}</span>
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                Appointments booked online by customers or dispatched manually will appear here chronologically.
              </p>
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
              {jobsToday.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">{job.title}</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md border capitalize",
                        job.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                          : job.status === 'in_progress'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                          : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                      )}>
                        {job.status.replace('_', ' ')}
                      </span>
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
                      {new Date(job.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <Link
                      href="/client/jobs"
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                    >
                      View &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Pipeline Overview */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Pipeline Status
            </h2>
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Active volume</span>
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
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Awaiting booking</div>
            </Link>

            {/* Pending Estimates */}
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
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 font-mono">
                ${(operations?.quotesAwaitingResponseValue ?? 0).toLocaleString()} out
              </div>
            </Link>

            {/* Unpaid Invoices */}
            <Link
              href="/client/invoices"
              className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs hover:shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all group block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">Unpaid Invoices</span>
                <CreditCard className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2 tabular-nums group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                ${(outcomes?.paymentCollection ? (outcomes.paymentCollection.invoicedAmount - outcomes.paymentCollection.collectedAmount) : 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Balance pending</div>
            </Link>

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
                {outcomes?.recoveredConversations.totalMissedCalls ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                {outcomes?.recoveredConversations.recoveryRate ?? 0}% SMS reply rate
              </div>
            </Link>
          </div>
        </div>

      </div>

      {/* ── Section 3: Verified Outcomes (Business Numbers) ── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-zinc-800 pt-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Verified Attributed Performance
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Directly measured and attributed to your CaptoDesk digital front desk.
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-zinc-700">
            {period === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Revenue Collected */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Payments Collected</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              ${(outcomes?.paymentCollection.collectedAmount ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {outcomes?.paymentCollection.collectionRate ?? 0}% of ${(outcomes?.paymentCollection.invoicedAmount ?? 0).toLocaleString()} invoiced
            </p>
          </div>

          {/* 2. Missed Call Recovery */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Missed Call Recovery</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {outcomes?.recoveredConversations.recoveryRate ?? 0}%
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {outcomes?.recoveredConversations.recoveredCount ?? 0} of {outcomes?.recoveredConversations.totalMissedCalls ?? 0} engaged via instant SMS
            </p>
          </div>

          {/* 3. Bookings Won */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Appointments Won</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
              {outcomes?.bookingsFromCaptoDesk.totalBookings ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              ${(outcomes?.bookingsFromCaptoDesk.totalBookedValue ?? 0).toLocaleString()} total job value
            </p>
          </div>

          {/* 4. Quote Acceptance */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Quote Acceptance Rate</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {outcomes?.quoteConversion.conversionRate ?? 0}%
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {outcomes?.quoteConversion.acceptedCount ?? 0} accepted (${(outcomes?.quoteConversion.acceptedValue ?? 0).toLocaleString()})
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Recent Inbound Calls ── */}
      <section className="space-y-3.5 border-t border-slate-200 dark:border-zinc-800 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Recent Inbound Calls & Auto-Replies
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Live feed of callers answered or recovered by CaptoDesk safety net.
            </p>
          </div>
          <Link href="/client/inbox" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors">
            View All in Inbox &rarr;
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 text-xs text-slate-500 dark:text-zinc-400 text-center shadow-2xs">
            No recent calls logged. Incoming calls forwarded to your CaptoDesk phone number will appear here in real time.
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
                    {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
