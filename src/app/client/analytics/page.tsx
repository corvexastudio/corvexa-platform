'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  TrendingUp, 
  DollarSign, 
  CalendarCheck, 
  PhoneCall, 
  CreditCard, 
  FileText, 
  Users, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  BarChart3, 
  Clock, 
  Sparkles, 
  Percent,
  CheckCircle,
  HelpCircle,
  Link2,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useWorkspace } from '@/lib/context/workspace-context'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ErrorState } from '@/components/ui/error-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TimeRange, OutcomeMetrics, OperationalMetrics } from '@/lib/dashboard/dashboard-service'

export default function AnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { orgName, orgSlug, role, planId, subscriptionStatus } = useWorkspace()
  const [period, setPeriod] = useState<TimeRange>('30d')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    frontdesk: false,
    retention: false,
  })

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const canViewFinancials = !['technician', 'dispatcher', 'member'].includes((role || '').toLowerCase())
  const isPayingCustomer = Boolean(
    (planId && !['free', 'trial'].includes(planId.toLowerCase())) ||
    (subscriptionStatus && ['active', 'paid', 'solo', 'crew'].includes(subscriptionStatus.toLowerCase()) && (planId || '').toLowerCase() !== 'free')
  )

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics-overview', period],
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
        }
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load business analytics')
      }
      return res.json()
    },
    staleTime: 60 * 1000
  })

  const outcomes: OutcomeMetrics | undefined = data?.outcomes
  const operations: OperationalMetrics | undefined = data?.operations

  // Calculation helpers
  const collectedAmount = outcomes?.paymentCollection?.collectedAmount ?? 0
  const invoicedAmount = outcomes?.paymentCollection?.invoicedAmount ?? 0
  const collectionRate = outcomes?.paymentCollection?.collectionRate ?? (invoicedAmount > 0 ? Math.round((collectedAmount / invoicedAmount) * 100) : 0)
  const paidInvoicesCount = outcomes?.paymentCollection?.paidInvoicesCount ?? 0
  const totalInvoicesCount = outcomes?.paymentCollection?.totalInvoicesCount ?? 0

  const quoteConversionRate = outcomes?.quoteConversion?.conversionRate ?? 0
  const acceptedQuotesCount = outcomes?.quoteConversion?.acceptedCount ?? 0
  const totalQuotesCount = outcomes?.quoteConversion?.totalResolvedCount ?? 0
  const acceptedQuoteValue = outcomes?.quoteConversion?.acceptedValue ?? 0
  const totalQuoteValue = outcomes?.quoteConversion?.totalSentValue ?? 0

  const totalBookings = outcomes?.bookingsFromCaptoDesk?.totalBookings ?? operations?.activeBookings ?? 0
  const totalBookedValue = outcomes?.bookingsFromCaptoDesk?.totalBookedValue ?? 0
  const onlineBookingsCount = outcomes?.bookingsFromCaptoDesk?.onlineBookingsCount ?? 0

  const totalMissedCalls = outcomes?.recoveredConversations?.totalMissedCalls ?? 0
  const recoveredCount = outcomes?.recoveredConversations?.recoveredCount ?? 0
  const recoveryRate = outcomes?.recoveredConversations?.recoveryRate ?? (totalMissedCalls > 0 ? Math.round((recoveredCount / totalMissedCalls) * 100) : 0)

  const repeatRate = outcomes?.repeatBookings?.repeatRate ?? 0
  const repeatBookingsCount = outcomes?.repeatBookings?.repeatBookingsCount ?? 0
  const repeatCustomerCount = outcomes?.repeatBookings?.repeatCustomerCount ?? 0

  if (isError) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Business Analytics & Reports"
          subtitle="Real-time performance indicators, revenue collections, quote conversion, and front desk metrics."
        />
        <ErrorState
          title="Failed to load analytics"
          message={(error as Error)?.message || 'An error occurred while aggregating analytics data.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* ── Page Header & Horizon Filters ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              Business Analytics &amp; Reports
            </h1>
            <Badge variant="outline" className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              {orgName || 'Workspace'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Real-time performance indicators, cash collections, quote conversion funnels, and dispatch metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <FilterTabs
            tabs={[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' },
            ]}
            activeTab={period}
            onChange={(val) => setPeriod(val as TimeRange)}
            ariaLabel="Analytics reporting timeframe"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-8.5 px-2.5 text-xs text-slate-700 dark:text-zinc-300"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Top Executive KPI Pulse (4 Macro Metrics) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. Payments Collected */}
        {canViewFinancials ? (
          <Link
            href="/client/invoices?status=paid"
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-colors block group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Revenue Collected
              </span>
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              ${collectedAmount.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">
                {collectionRate}%
              </span>
              <span className="truncate">of ${invoicedAmount.toLocaleString()} invoiced</span>
            </div>
          </Link>
        ) : (
          <Link
            href="/client/inbox"
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-colors block group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Calls Recovered
              </span>
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <PhoneCall className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {recoveredCount}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-zinc-800 truncate">
              {recoveryRate}% missed calls re-engaged
            </div>
          </Link>
        )}

        {/* 2. Booked Appointments */}
        <Link
          href="/client/calendar"
          className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-purple-300 dark:hover:border-purple-700/60 transition-colors block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Booked Appointments
            </span>
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
            {totalBookings}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">
              {onlineBookingsCount}
            </span>
            <span className="truncate">via online booking link</span>
          </div>
        </Link>

        {/* 3. Quote Acceptance Rate */}
        <Link
          href="/client/quotes?tab=pending"
          className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-amber-300 dark:hover:border-amber-700/60 transition-colors block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Quote Acceptance
            </span>
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {quoteConversionRate}%
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">
              {acceptedQuotesCount} of {totalQuotesCount}
            </span>
            <span className="truncate">estimates won</span>
          </div>
        </Link>

        {/* 4. Missed Call Recovery Rate */}
        <Link
          href="/client/inbox"
          className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-blue-300 dark:hover:border-blue-700/60 transition-colors block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Front Desk Recovery
            </span>
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <PhoneCall className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
            {recoveryRate}%
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">
              {recoveredCount} of {totalMissedCalls}
            </span>
            <span className="truncate">rescued calls</span>
          </div>
        </Link>
      </div>

      {/* ── Deep Analytical Breakdown (2x2 Grid) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Section 1: Revenue & Cash Flow Intelligence ── */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Revenue &amp; Invoicing Efficiency
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Cash collected vs outstanding customer balances
                </p>
              </div>
            </div>
            <Link
              href="/client/invoices"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Invoices</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {canViewFinancials ? (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-zinc-300">Collection Efficiency</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{collectionRate}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(collectionRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stat Matrix */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Total Invoiced</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    ${invoicedAmount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Across {totalInvoicesCount} invoices
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Payments Settled</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                    ${collectedAmount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    {paidInvoicesCount} paid in full
                  </div>
                </div>

                <Link
                  href="/client/invoices?status=unpaid"
                  className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-700/60 transition-colors block group cursor-pointer"
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>Outstanding Balance</span>
                    <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                    ${(operations?.outstandingInvoicesBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    {operations?.outstandingInvoices ?? 0} open receivable{(operations?.outstandingInvoices ?? 0) === 1 ? '' : 's'} · Collect
                  </div>
                </Link>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Average Job Ticket</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    ${totalBookings > 0 ? Math.round(invoicedAmount / totalBookings).toLocaleString() : '0'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Based on closed appointments
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-zinc-400 py-4 text-center">
              Financial performance is restricted to organization administrators and owners.
            </p>
          )}
        </div>

        {/* ── Section 2: Quote Conversion & Sales Funnel ── */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Quote Conversion &amp; Win Rate
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Estimates sent to customers vs accepted quotes
                </p>
              </div>
            </div>
            <Link
              href="/client/quotes"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Quotes</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-4">
            {/* Conversion Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-zinc-300">Quote Win Rate</span>
                <span className="text-amber-600 dark:text-amber-400">{quoteConversionRate}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(quoteConversionRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Stat Matrix */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Quotes Won</div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {acceptedQuotesCount} <span className="text-xs font-normal text-slate-400">/ {totalQuotesCount}</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Signed and approved by clients
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Won Value</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                  ${acceptedQuoteValue.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Out of ${totalQuoteValue.toLocaleString()} sent
                </div>
              </div>

              <Link
                href="/client/quotes?tab=pending"
                className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-700/60 transition-colors block group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>Awaiting Decision</span>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-amber-500 transition-colors" />
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {operations?.quotesAwaitingResponse ?? 0}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  ${(operations?.quotesAwaitingResponseValue ?? 0).toLocaleString()} in pipeline · Review
                </div>
              </Link>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Average Quote Size</div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  ${totalQuotesCount > 0 ? Math.round(totalQuoteValue / totalQuotesCount).toLocaleString() : '0'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Estimated job proposal size
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: 24/7 Front Desk & Call Recovery ── */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Front Desk &amp; Call Recovery
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Automated customer capture &amp; 24/7 dispatch triage
                </p>
              </div>
            </div>
            <Link
              href="/client/inbox"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Inbox</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Automated SMS Dispatch: Active
                </span>
              </div>
              <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                Under 15s instant response
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Total Calls Logged</div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {totalMissedCalls}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Inbound customer calls
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Conversations Rescued</div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                  {recoveredCount}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Customers who replied to SMS
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Recovery Rate</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                  {recoveryRate}%
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Prevented lost leads to competitors
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Public Bookings</div>
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums">
                  {onlineBookingsCount}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Self-service customer appointments
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Customer Retention & Repeat Business ── */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Customer Retention &amp; Loyalty
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Repeat bookings and client lifetime value
                </p>
              </div>
            </div>
            <Link
              href="/client/customers"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Customers</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-4">
            {/* Retention Rate Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-zinc-300">Repeat Customer Rate</span>
                <span className="text-purple-600 dark:text-purple-400">{repeatRate}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(repeatRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Repeat Bookings</div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {repeatBookingsCount}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Second+ jobs booked
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Repeat Clients</div>
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums">
                  {repeatCustomerCount}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Returning homeowners &amp; businesses
                </div>
              </div>

              <Link
                href="/client/customers"
                className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-700/60 transition-colors block group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>Follow-Ups Due</span>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-amber-500 transition-colors" />
                </div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                  {operations?.customersDueForFollowup ?? 0}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Seasonal service · Re-engage
                </div>
              </Link>

              <Link
                href="/client/reviews"
                className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-colors block group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>Reviews Triggered</span>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                  {operations?.reviewRequestsSent ?? 0}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Google review SMS links · Track
                </div>
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* ── Bottom Link back to Today ── */}
      <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-800">
        <span>Need tactical daily route dispatch or today&apos;s upcoming stops?</span>
        <Link 
          href="/client/dashboard" 
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <span>Return to Today&apos;s Route &amp; Dispatch</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
