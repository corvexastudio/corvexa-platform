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
  Repeat, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Briefcase, 
  CreditCard, 
  RefreshCw,
  Sparkles,
  PhoneCall,
  CheckCircle,
  FileText
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const [period, setPeriod] = useState<TimeRange>('30d')
  const [org, setOrg] = useState<any>(null)
  const [attentionQueue, setAttentionQueue] = useState<AttentionItem[]>([])
  const [operations, setOperations] = useState<OperationalMetrics | null>(null)
  const [outcomes, setOutcomes] = useState<OutcomeMetrics | null>(null)
  const [jobsToday, setJobsToday] = useState<JobTodayItem[]>([])
  const [recentCalls, setRecentCalls] = useState<RecentCallItem[]>([])

  const loadDashboard = useCallback(async (selectedPeriod: TimeRange) => {
    setLoading(true)
    try {
      // 1. Fetch organization details for header
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id, organizations(*)')
          .eq('id', user.id)
          .single()
        if (profile?.organizations) {
          setOrg(profile.organizations)
        }
      }

      // 2. Fetch aggregated dashboard data from API
      const res = await fetch(`/api/client/dashboard?period=${selectedPeriod}`)
      if (res.ok) {
        const data = await res.json()
        setAttentionQueue(data.attentionQueue || [])
        setOperations(data.operations || null)
        setOutcomes(data.outcomes || null)
        setJobsToday(data.jobsToday || [])
        setRecentCalls(data.recentCalls || [])
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadDashboard(period)
  }, [loadDashboard, period])

  const criticalAttentionCount = attentionQueue.filter(i => i.urgency === 'critical').length

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header Bar with Operational Status & Period Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Operations Dashboard
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Safety Net Live
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time attention queue and verified business outcomes for <span className="font-semibold text-zinc-200">{org?.name || 'your business'}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Forwarding Status Badge */}
          <div className="hidden lg:flex items-center gap-2.5 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <div className="text-left">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Telnyx Safety Net</p>
              <p className="text-xs font-semibold text-zinc-200">{org?.telnyx_phone_number || 'Active Forwarding'}</p>
            </div>
          </div>

          {/* Time Period Filter Pills */}
          <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 p-1">
            {(['7d', '30d', 'all'] as TimeRange[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadDashboard(period)}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. PRIMARY ATTENTION QUEUE: "NEEDS ATTENTION" */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              Needs Attention
            </h2>
            {attentionQueue.length > 0 ? (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                criticalAttentionCount > 0
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}>
                {attentionQueue.length} {attentionQueue.length === 1 ? 'action required' : 'actions required'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" /> All caught up
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-400">Primary operational queue</span>
        </div>

        {attentionQueue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-white">All caught up!</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              No new leads awaiting initial contact, no unread customer texts, no expiring quotes, and no overdue invoices.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {attentionQueue.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  item.urgency === 'critical'
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : item.urgency === 'warning'
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.urgency === 'critical'
                        ? 'bg-rose-500/20 text-rose-300'
                        : item.urgency === 'warning'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {item.category === 'lead' ? 'New Lead' :
                       item.category === 'message' ? 'Customer Reply' :
                       item.category === 'quote' ? 'Expiring Quote' :
                       item.category === 'appointment' ? 'Booking Request' :
                       item.category === 'invoice' ? 'Past Due Invoice' : 'Service Due'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{item.subtitle}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 font-medium">Action recommended</span>
                  <Link
                    href={item.actionHref}
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                      item.urgency === 'critical'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : item.urgency === 'warning'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {item.actionLabel} &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. BUSINESS OUTCOMES SECTION (VERIFIABLE ATTRIBUTION) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-400" />
              Business Outcomes
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Verified metrics with direct attribution — strictly honest reporting.
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            {period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Recovered Conversations */}
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-blue-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Recovered Conversations</span>
                <PhoneMissed className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {outcomes?.recoveredConversations.recoveryRate ?? 0}%
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                <span className="font-semibold text-zinc-200">
                  {outcomes?.recoveredConversations.recoveredCount ?? 0}
                </span> of {outcomes?.recoveredConversations.totalMissedCalls ?? 0} missed callers replied after text-back
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-blue-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Auto-SMS recovery
            </div>
          </div>

          {/* 2. Bookings from CaptoDesk */}
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Bookings from CaptoDesk</span>
                <CalendarCheck className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {outcomes?.bookingsFromCaptoDesk.totalBookings ?? 0}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                ${(outcomes?.bookingsFromCaptoDesk.totalBookedValue ?? 0).toLocaleString()} booked value from recovery & online scheduling
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Direct attribution
            </div>
          </div>

          {/* 3. Quote Conversion */}
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-indigo-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Quote Conversion</span>
                <FileCheck className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {outcomes?.quoteConversion.conversionRate ?? 0}%
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                <span className="font-semibold text-zinc-200">{outcomes?.quoteConversion.acceptedCount ?? 0}</span> accepted (${(outcomes?.quoteConversion.acceptedValue ?? 0).toLocaleString()})
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-indigo-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Proposal win rate
            </div>
          </div>

          {/* 4. Payment Collection */}
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-teal-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Payment Collection</span>
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {outcomes?.paymentCollection.collectionRate ?? 0}%
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                ${(outcomes?.paymentCollection.collectedAmount ?? 0).toLocaleString()} collected of ${(outcomes?.paymentCollection.invoicedAmount ?? 0).toLocaleString()} invoiced
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-teal-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Stripe & recorded receipts
            </div>
          </div>

          {/* 5. Repeat Bookings */}
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Repeat Bookings</span>
                <Repeat className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {outcomes?.repeatBookings.repeatRate ?? 0}%
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                <span className="font-semibold text-zinc-200">{outcomes?.repeatBookings.repeatBookingsCount ?? 0}</span> bookings from {outcomes?.repeatBookings.repeatCustomerCount ?? 0} returning clients
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-amber-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Retention engine
            </div>
          </div>
        </div>
      </section>

      {/* 4. DAILY OPERATIONS & TODAY'S SCHEDULE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Today's Field Schedule */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Today&apos;s Field Schedule
              </h2>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
                {jobsToday.length} {jobsToday.length === 1 ? 'Job' : 'Jobs'}
              </span>
            </div>
            <Link href="/client/jobs" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
              All Jobs &rarr;
            </Link>
          </div>

          {jobsToday.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center bg-zinc-900/30">
              <Briefcase className="h-8 w-8 text-zinc-500 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-white">No field jobs scheduled for today</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Appointments booked through CaptoDesk or dispatched manually will appear here automatically.
              </p>
              <div className="mt-4">
                <Link
                  href="/client/calendar"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors"
                >
                  Open Calendar &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {jobsToday.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{job.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        job.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : job.status === 'in_progress'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 flex items-center gap-2">
                      <span>{job.customerName}</span>
                      {job.technicianName && <span>• Tech: {job.technicianName}</span>}
                    </p>
                    {job.address && (
                      <p className="text-[11px] text-zinc-400">{job.address}</p>
                    )}
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-xs font-semibold text-zinc-300 flex items-center sm:justify-end gap-1">
                      <Clock className="h-3 w-3 text-zinc-400" />
                      {new Date(job.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <Link
                      href="/client/jobs"
                      className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors inline-block mt-1"
                    >
                      View Details &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Daily Operational Pulse */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              Operational Pulse
            </h2>
            <span className="text-xs text-zinc-400 font-medium">Pipeline overview</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* New Leads */}
            <Link
              href="/client/leads"
              className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3.5 hover:border-zinc-700 transition-all group"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">New Leads</p>
              <div className="text-2xl font-extrabold text-white mt-1">{operations?.newLeads ?? 0}</div>
              <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">View leads &rarr;</p>
            </Link>

            {/* Quotes Awaiting Response */}
            <Link
              href="/client/quotes"
              className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3.5 hover:border-zinc-700 transition-all group"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">Quotes Pending</p>
              <div className="text-2xl font-extrabold text-white mt-1">{operations?.quotesAwaitingResponse ?? 0}</div>
              <p className="text-[10px] text-zinc-400 mt-1">${(operations?.quotesAwaitingResponseValue ?? 0).toLocaleString()} value</p>
            </Link>

            {/* Outstanding Invoices */}
            <Link
              href="/client/invoices"
              className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3.5 hover:border-zinc-700 transition-all group"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">Unpaid Invoices</p>
              <div className="text-2xl font-extrabold text-white mt-1">{operations?.outstandingInvoices ?? 0}</div>
              <p className="text-[10px] text-zinc-400 mt-1">${(operations?.outstandingInvoicesBalance ?? 0).toLocaleString()} balance</p>
            </Link>

            {/* Payments Collected */}
            <Link
              href="/client/invoices"
              className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3.5 hover:border-zinc-700 transition-all group"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">Payments Recv.</p>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">${(operations?.paymentsReceivedAmount ?? 0).toLocaleString()}</div>
              <p className="text-[10px] text-zinc-400 mt-1">{operations?.paymentsReceived ?? 0} transactions</p>
            </Link>

            {/* Review Requests */}
            <Link
              href="/client/reviews"
              className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3.5 hover:border-zinc-700 transition-all group"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">Reviews Sent</p>
              <div className="text-2xl font-extrabold text-white mt-1">{operations?.reviewRequestsSent ?? 0}</div>
              <p className="text-[10px] text-zinc-400 mt-1">Google invites sent</p>
            </Link>

            {/* Customers Due for Follow-up */}
            <Link
              href="/client/customers"
              className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3.5 hover:border-zinc-700 transition-all group"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">Follow-Ups Due</p>
              <div className="text-2xl font-extrabold text-amber-400 mt-1">{operations?.customersDueForFollowup ?? 0}</div>
              <p className="text-[10px] text-zinc-400 mt-1">Service due / overdue</p>
            </Link>
          </div>
        </div>
      </div>

      {/* 5. RECENT MISSED CALL RECOVERY FEED */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneMissed className="h-4 w-4 text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Recent Missed Call Activity
            </h2>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
              Live Feed
            </span>
          </div>
          <Link href="/client/inbox" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
            Full 2-Way Inbox &rarr;
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center bg-zinc-900/30">
            <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">Your Safety Net is Active</h4>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              When you are on a job and miss an inbound call, CaptoDesk catches the caller, logs it here, and fires the instant text-back in 15 seconds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentCalls.map((call) => (
              <div
                key={call.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col justify-between hover:border-zinc-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">
                      {call.customerName || call.callerNumber}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{call.callerNumber}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Texted back
                  </span>
                  <Link
                    href="/client/inbox"
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Open Inbox &rarr;
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
