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
  Star
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
      const res = await fetch(`/api/client/dashboard?period=${selectedPeriod}`)
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
          // Attempt self-healing provisioning before fallback
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`
            }
            const healRes = await fetch('/api/onboarding', {
              method: 'POST',
              headers,
              body: JSON.stringify({})
            })
            if (healRes.ok) {
              return loadDashboard(selectedPeriod)
            }
          } catch {
            // Proceed to onboarding fallback
          }
          window.location.href = '/client/onboarding'
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

  return (
    <div className="space-y-8">
      
      {/* ── Page Header: Today's Briefing ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-100 tracking-tight">
              Today
            </h1>
            <span className="text-xs text-zinc-400 font-medium">
              &bull; {todayFormatted}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {org?.name ? `${org.name} front desk overview.` : 'Daily operations overview.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                period === '7d' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              7 days
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                period === '30d' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              30 days
            </button>
          </div>

          <button
            onClick={() => loadDashboard(period)}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
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
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Needs Attention
            </h2>
            {attentionQueue.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 text-[10px] font-bold text-amber-400 tabular-nums">
                {attentionQueue.length}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-400">Actions required</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
                <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-36 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-48 bg-zinc-800/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : attentionQueue.length === 0 ? (
          <div className="rounded-md border border-zinc-800 bg-zinc-900/30 px-4 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">All caught up</p>
                <p className="text-xs text-zinc-400">No unread inquiries, expiring quotes, or past-due balances need attention right now.</p>
              </div>
            </div>
            <Link
              href="/client/inbox"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors shrink-0"
            >
              Open Inbox &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionQueue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-md border border-zinc-800 bg-zinc-900/50 p-3.5 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {item.category === 'lead' ? 'New Lead' :
                       item.category === 'message' ? 'Inquiry' :
                       item.category === 'quote' ? 'Expiring Quote' :
                       item.category === 'appointment' ? 'Booking' :
                       item.category === 'invoice' ? 'Past Due Invoice' : 'Follow-up'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-zinc-100 line-clamp-1">{item.title}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-2">{item.subtitle}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-end">
                  <Link
                    href={item.actionHref}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Today's Schedule & Key Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (7 cols): Today's Field Schedule */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Today&apos;s Schedule
            </h2>
            <Link 
              href="/client/calendar" 
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Full calendar &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-md bg-zinc-900/40 border border-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : jobsToday.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-800 p-6 text-center bg-zinc-900/20">
              <Calendar className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-zinc-200">No field appointments scheduled for today</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Appointments booked online or manually will appear here chronologically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobsToday.map((job) => (
                <div
                  key={job.id}
                  className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-zinc-100 truncate">{job.title}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${
                        job.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : job.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      <span>{job.customerName}</span>
                      {job.address && <span> &bull; {job.address}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-xs text-zinc-300 font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3 text-zinc-400" />
                      {new Date(job.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <Link
                      href="/client/jobs"
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
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
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Pipeline Status
            </h2>
            <span className="text-xs text-zinc-400">Active volume</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href="/client/leads"
              className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700 transition-colors block"
            >
              <div className="text-[11px] font-medium text-zinc-400">Open Leads</div>
              <div className="text-xl font-semibold text-zinc-100 mt-1 tabular-nums">
                {operations?.newLeads ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Awaiting booking</div>
            </Link>

            <Link
              href="/client/quotes"
              className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700 transition-colors block"
            >
              <div className="text-[11px] font-medium text-zinc-400">Pending Estimates</div>
              <div className="text-xl font-semibold text-zinc-100 mt-1 tabular-nums">
                {operations?.quotesAwaitingResponse ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                ${(operations?.quotesAwaitingResponseValue ?? 0).toLocaleString()} outstanding
              </div>
            </Link>

            <Link
              href="/client/invoices"
              className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700 transition-colors block"
            >
              <div className="text-[11px] font-medium text-zinc-400">Unpaid Invoices</div>
              <div className="text-xl font-semibold text-zinc-100 mt-1 tabular-nums">
                ${(outcomes?.paymentCollection ? (outcomes.paymentCollection.invoicedAmount - outcomes.paymentCollection.collectedAmount) : 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Balance due</div>
            </Link>

            <Link
              href="/client/inbox"
              className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700 transition-colors block"
            >
              <div className="text-[11px] font-medium text-zinc-400">Calls Handled</div>
              <div className="text-xl font-semibold text-zinc-100 mt-1 tabular-nums">
                {outcomes?.recoveredConversations.totalMissedCalls ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {outcomes?.recoveredConversations.recoveryRate ?? 0}% replied to text
              </div>
            </Link>
          </div>
        </div>

      </div>

      {/* ── Section 3: Verified Outcomes (Business Numbers) ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Verified Business Numbers
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Directly attributed to front desk operations for the selected period.
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            {period === '7d' ? 'Last 7 days' : 'Last 30 days'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Revenue Collected */}
          <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3.5 space-y-1">
            <div className="text-[11px] font-medium text-zinc-400">Payments Collected</div>
            <div className="text-xl font-semibold text-zinc-100 tabular-nums">
              ${(outcomes?.paymentCollection.collectedAmount ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-400">
              {outcomes?.paymentCollection.collectionRate ?? 0}% of ${(outcomes?.paymentCollection.invoicedAmount ?? 0).toLocaleString()} invoiced
            </p>
          </div>

          {/* 2. Missed Call Recovery */}
          <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3.5 space-y-1">
            <div className="text-[11px] font-medium text-zinc-400">Missed Call Recovery</div>
            <div className="text-xl font-semibold text-zinc-100 tabular-nums">
              {outcomes?.recoveredConversations.recoveryRate ?? 0}%
            </div>
            <p className="text-[11px] text-zinc-400">
              {outcomes?.recoveredConversations.recoveredCount ?? 0} of {outcomes?.recoveredConversations.totalMissedCalls ?? 0} callers engaged via text
            </p>
          </div>

          {/* 3. Bookings Won */}
          <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3.5 space-y-1">
            <div className="text-[11px] font-medium text-zinc-400">Online & SMS Bookings</div>
            <div className="text-xl font-semibold text-zinc-100 tabular-nums">
              {outcomes?.bookingsFromCaptoDesk.totalBookings ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400">
              ${(outcomes?.bookingsFromCaptoDesk.totalBookedValue ?? 0).toLocaleString()} booked job value
            </p>
          </div>

          {/* 4. Quote Acceptance */}
          <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3.5 space-y-1">
            <div className="text-[11px] font-medium text-zinc-400">Quote Win Rate</div>
            <div className="text-xl font-semibold text-zinc-100 tabular-nums">
              {outcomes?.quoteConversion.conversionRate ?? 0}%
            </div>
            <p className="text-[11px] text-zinc-400">
              {outcomes?.quoteConversion.acceptedCount ?? 0} accepted (${(outcomes?.quoteConversion.acceptedValue ?? 0).toLocaleString()})
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Recent Inbound Calls ── */}
      <section className="space-y-3 border-t border-zinc-800 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent Inbound Calls
          </h2>
          <Link href="/client/inbox" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
            View all in Inbox &rarr;
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <div className="rounded-md border border-zinc-800 bg-zinc-900/20 px-4 py-4 text-xs text-zinc-400 text-center">
            No recent calls logged. Incoming calls forwarded to your CaptoDesk number will appear here in real time.
          </div>
        ) : (
          <div className="rounded-md border border-zinc-800 overflow-hidden divide-y divide-zinc-800/80">
            {recentCalls.slice(0, 5).map(call => (
              <div 
                key={call.id}
                className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors text-xs"
              >
                <div className="flex items-center gap-3">
                  <PhoneCall className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-zinc-200">{call.callerNumber}</span>
                    <span className="text-zinc-400 text-[11px] ml-2">
                      {call.autoReplySent ? 'Auto-reply dispatched' : 'Answered or logged'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-400">
                    {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <Link
                    href="/client/inbox"
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
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
