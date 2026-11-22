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
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  CheckCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle
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
  const { orgName, role, planId, subscriptionStatus } = useWorkspace()
  const [period, setPeriod] = useState<TimeRange>('30d')
  
  // Track open/collapsed state for each of the 4 detailed sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cashflow: true,
    quotes: true,
    frontdesk: true,
    retention: true,
  })

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const allOpen = Object.values(openSections).every(Boolean)
  const toggleAll = () => {
    const nextState = !allOpen
    setOpenSections({
      cashflow: nextState,
      quotes: nextState,
      frontdesk: nextState,
      retention: nextState,
    })
  }

  const canViewFinancials = !['technician', 'dispatcher', 'member'].includes((role || '').toLowerCase())

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

  // Cash Flow & Receivables Metrics
  const collectedAmount = outcomes?.paymentCollection?.collectedAmount ?? 0
  const invoicedAmount = outcomes?.paymentCollection?.invoicedAmount ?? 0
  const collectionRate = outcomes?.paymentCollection?.collectionRate ?? (invoicedAmount > 0 ? Math.round((collectedAmount / invoicedAmount) * 100) : 0)
  const paidInvoicesCount = outcomes?.paymentCollection?.paidInvoicesCount ?? 0
  const totalInvoicesCount = outcomes?.paymentCollection?.totalInvoicesCount ?? 0
  const outstandingBalance = outcomes?.paymentCollection?.outstandingReceivables ?? operations?.outstandingInvoicesBalance ?? 0
  const outstandingInvoicesCount = outcomes?.paymentCollection?.outstandingInvoicesCount ?? operations?.outstandingInvoices ?? 0
  const draftInvoicesCount = outcomes?.paymentCollection?.draftInvoicesCount ?? 0
  const draftInvoicesAmount = outcomes?.paymentCollection?.draftInvoicesAmount ?? 0
  const averageJobTicket = outcomes?.paymentCollection?.averageJobTicket ?? (totalInvoicesCount > 0 ? Math.round(invoicedAmount / totalInvoicesCount) : 0)

  // Quotes & Sales Metrics
  const quoteConversionRate = outcomes?.quoteConversion?.conversionRate ?? 0
  const acceptedQuotesCount = outcomes?.quoteConversion?.acceptedCount ?? 0
  const declinedQuotesCount = outcomes?.quoteConversion?.declinedCount ?? 0
  const expiredQuotesCount = outcomes?.quoteConversion?.expiredCount ?? 0
  const pendingQuotesCount = outcomes?.quoteConversion?.pendingCount ?? operations?.quotesAwaitingResponse ?? 0
  const pendingQuotesValue = outcomes?.quoteConversion?.pendingValue ?? operations?.quotesAwaitingResponseValue ?? 0
  const draftQuotesCount = outcomes?.quoteConversion?.draftCount ?? 0
  const totalResolvedCount = outcomes?.quoteConversion?.totalResolvedCount ?? (acceptedQuotesCount + declinedQuotesCount + expiredQuotesCount)
  const acceptedQuoteValue = outcomes?.quoteConversion?.acceptedValue ?? 0
  const totalSentValue = outcomes?.quoteConversion?.totalSentValue ?? 0
  const averageQuoteSize = outcomes?.quoteConversion?.averageQuoteSize ?? (acceptedQuotesCount > 0 ? Math.round(acceptedQuoteValue / acceptedQuotesCount) : 0)

  // Bookings & Appointments
  const totalBookings = outcomes?.bookingsFromCaptoDesk?.totalBookings ?? operations?.activeBookings ?? 0
  const totalBookedValue = outcomes?.bookingsFromCaptoDesk?.totalBookedValue ?? 0
  const onlineBookingsCount = outcomes?.bookingsFromCaptoDesk?.onlineBookingsCount ?? 0

  // Front Desk & Missed Call Recovery
  const totalMissedCalls = outcomes?.recoveredConversations?.totalMissedCalls ?? 0
  const recoveredCount = outcomes?.recoveredConversations?.recoveredCount ?? 0
  const recoveryRate = outcomes?.recoveredConversations?.recoveryRate ?? (totalMissedCalls > 0 ? Math.round((recoveredCount / totalMissedCalls) * 100) : 0)

  // Retention & Repeat Business
  const repeatRate = outcomes?.repeatBookings?.repeatRate ?? 0
  const repeatBookingsCount = outcomes?.repeatBookings?.repeatBookingsCount ?? 0
  const repeatCustomerCount = outcomes?.repeatBookings?.repeatCustomerCount ?? 0
  const followUpsDueCount = operations?.customersDueForFollowup ?? 0
  const reviewsSentCount = operations?.reviewRequestsSent ?? 0

  if (isError) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Business Analytics & Reports"
          subtitle="Real-time performance indicators, cash flow, quote conversion, and front desk recovery."
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
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* ── Page Header & Reporting Period Horizon ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              Business Analytics &amp; Reports
            </h1>
            <Badge variant="outline" className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              {orgName || 'Workspace'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Real-time performance indicators, cash flow, quote conversion, and front desk recovery.
          </p>
        </div>

        {/* ── Segmented Control with Touch Target >= 44px ── */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <FilterTabs
            tabs={[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' },
            ]}
            activeTab={period}
            onChange={(val) => setPeriod(val as TimeRange)}
            size="touch"
            ariaLabel="Analytics reporting timeframe"
            className="w-full sm:w-auto justify-between"
          />

          <Button
            variant="outline"
            size="default"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="min-h-[44px] min-w-[44px] px-3 text-xs text-slate-700 dark:text-zinc-300 shrink-0"
            title="Refresh metrics"
            aria-label="Refresh business metrics"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Executive Overview (4 Primary Macro Cards) ── */}
      <section aria-label="Executive Performance Overview" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Executive Overview
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
            Tap any card to view detailed records
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Card 1: Revenue Collected (or Calls Recovered if financial permission is restricted) */}
          {canViewFinancials ? (
            <Link
              href="/client/invoices?status=paid"
              className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-xs transition-all block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label={`Revenue Collected: $${collectedAmount.toLocaleString()}. Tap to view paid invoices.`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Revenue Collected
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <DollarSign className="h-4 w-4" />
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
              className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-xs transition-all block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label={`Front Desk Recovery: ${recoveredCount} calls recovered. Tap to view inbox.`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Calls Recovered
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <PhoneCall className="h-4 w-4" />
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

          {/* Card 2: Booked Appointments */}
          <Link
            href="/client/calendar"
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-purple-300 dark:hover:border-purple-700/60 hover:shadow-xs transition-all block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label={`Booked Appointments: ${totalBookings}. Tap to view calendar.`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Booked Appointments
              </span>
              <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <CalendarCheck className="h-4 w-4" />
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

          {/* Card 3: Quote Acceptance */}
          <Link
            href="/client/quotes?tab=accepted"
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-amber-300 dark:hover:border-amber-700/60 hover:shadow-xs transition-all block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label={`Quote Acceptance Rate: ${quoteConversionRate}%. Tap to view accepted quotes.`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Quote Acceptance
              </span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
              {quoteConversionRate}%
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">
                {acceptedQuotesCount} of {totalResolvedCount}
              </span>
              <span className="truncate">estimates won</span>
            </div>
          </Link>

          {/* Card 4: Front Desk Recovery */}
          <Link
            href="/client/inbox"
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4.5 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-blue-300 dark:hover:border-blue-700/60 hover:shadow-xs transition-all block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Front Desk Recovery Rate: ${recoveryRate}%. Tap to view inbox.`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Front Desk Recovery
              </span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <PhoneCall className="h-4 w-4" />
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
      </section>

      {/* ── Expandable Detailed Sections Header ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            Detailed Performance Breakdowns
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Cash collections, estimate conversions, dispatch response, and repeat clients.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-2 min-h-[44px] flex items-center gap-1 rounded-lg transition-colors cursor-pointer select-none"
          aria-label={allOpen ? 'Collapse all detailed sections' : 'Expand all detailed sections'}
        >
          <span>{allOpen ? 'Collapse All' : 'Expand All'}</span>
          {allOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── 4 Detailed Performance Sections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* ── Section 1: Cash Flow & Receivables ── */}
        <section 
          aria-labelledby="section-heading-cashflow"
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden transition-all"
        >
          {/* Header Toggle */}
          <button
            type="button"
            onClick={() => toggleSection('cashflow')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors min-h-[48px] cursor-pointer"
            aria-expanded={openSections.cashflow}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 id="section-heading-cashflow" className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Cash Flow &amp; Receivables
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Payments collected vs unpaid customer balances
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hidden sm:inline tabular-nums">
                ${collectedAmount.toLocaleString()} collected
              </span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                {openSections.cashflow ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </button>

          {/* Section Body */}
          {openSections.cashflow && (
            <div className="p-4 sm:p-6 space-y-4">
              {canViewFinancials ? (
                <>
                  {/* Collection Efficiency Progress Bar */}
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
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Stat 1: Total Invoiced */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Total Invoiced</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                        ${invoicedAmount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                        Across {totalInvoicesCount} issued invoice{totalInvoicesCount === 1 ? '' : 's'}
                      </div>
                      {draftInvoicesCount > 0 && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                          + {draftInvoicesCount} draft (${draftInvoicesAmount.toLocaleString()})
                        </div>
                      )}
                    </div>

                    {/* Stat 2: Payments Settled */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Payments Settled</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                        ${collectedAmount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                        {paidInvoicesCount} invoice{paidInvoicesCount === 1 ? '' : 's'} paid in full
                      </div>
                    </div>

                    {/* Stat 3: Outstanding Receivables (Interactive Deep Link) */}
                    <Link
                      href="/client/invoices?status=unpaid"
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600/70 transition-colors block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                      aria-label={`Outstanding Receivables: $${outstandingBalance.toLocaleString()}. Tap to collect.`}
                    >
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>Outstanding Receivables</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                      </div>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                        ${outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 group-hover:text-amber-700 dark:group-hover:text-amber-300 font-medium">
                        {outstandingInvoicesCount} open receivable{outstandingInvoicesCount === 1 ? '' : 's'} · Collect
                      </div>
                    </Link>

                    {/* Stat 4: Average Job Ticket */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Average Job Ticket</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                        ${averageJobTicket.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                        Based on completed service work
                      </div>
                    </div>
                  </div>

                  {/* Informational Explainer Note */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-zinc-400">
                    <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      Collected revenue strictly accounts for successfully processed payments. Draft invoices are kept separate from active receivables until issued.
                    </span>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 text-center space-y-1">
                  <ShieldCheck className="h-6 w-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Financial Performance Restricted
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Detailed cash flow and receivables are restricted to organization administrators and owners.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Section 2: Quotes & Sales Performance ── */}
        <section 
          aria-labelledby="section-heading-quotes"
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden transition-all"
        >
          {/* Header Toggle */}
          <button
            type="button"
            onClick={() => toggleSection('quotes')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors min-h-[48px] cursor-pointer"
            aria-expanded={openSections.quotes}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 id="section-heading-quotes" className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Quotes &amp; Sales Performance
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Proposal conversion funnel and pipeline value
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 hidden sm:inline tabular-nums">
                {quoteConversionRate}% win rate
              </span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                {openSections.quotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </button>

          {/* Section Body */}
          {openSections.quotes && (
            <div className="p-4 sm:p-6 space-y-4">
              {/* Win Rate Progress Bar */}
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
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Stat 1: Quotes Won (Interactive Deep Link) */}
                <Link
                  href="/client/quotes?tab=accepted"
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600/70 transition-colors block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                  aria-label={`Quotes Won: ${acceptedQuotesCount} of ${totalResolvedCount}. Tap to view.`}
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>Quotes Won</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    {acceptedQuotesCount} <span className="text-xs font-normal text-slate-400">/ {totalResolvedCount}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 group-hover:text-amber-700 dark:group-hover:text-amber-300 font-medium">
                    Signed and approved · View
                  </div>
                </Link>

                {/* Stat 2: Won Value */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Won Value</div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                    ${acceptedQuoteValue.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Out of ${totalSentValue.toLocaleString()} sent
                  </div>
                </div>

                {/* Stat 3: Awaiting Decision (Interactive Deep Link) */}
                <Link
                  href="/client/quotes?tab=pending"
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600/70 transition-colors block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                  aria-label={`Quotes Awaiting Decision: ${pendingQuotesCount}. Tap to review.`}
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>Awaiting Decision</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    {pendingQuotesCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 group-hover:text-amber-700 dark:group-hover:text-amber-300 font-medium">
                    ${pendingQuotesValue.toLocaleString()} in pipeline · Review
                  </div>
                </Link>

                {/* Stat 4: Average Proposal Size */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Average Proposal Size</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    ${averageQuoteSize.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Estimated service proposal value
                  </div>
                </div>
              </div>

              {/* Status Chips Row */}
              <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                  {acceptedQuotesCount} Won
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium">
                  {declinedQuotesCount} Declined
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium">
                  {expiredQuotesCount} Expired
                </span>
                {draftQuotesCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 font-medium">
                    {draftQuotesCount} Drafts
                  </span>
                )}
              </div>

              {/* Informational Explainer Note */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-zinc-400">
                <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Win rate formula is Accepted / (Accepted + Declined + Expired). Pending proposals awaiting customer decisions do not penalize your win rate.
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── Section 3: Front Desk & Call Recovery ── */}
        <section 
          aria-labelledby="section-heading-frontdesk"
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden transition-all"
        >
          {/* Header Toggle */}
          <button
            type="button"
            onClick={() => toggleSection('frontdesk')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors min-h-[48px] cursor-pointer"
            aria-expanded={openSections.frontdesk}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <h3 id="section-heading-frontdesk" className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Front Desk &amp; Call Recovery
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Automated customer capture and 24/7 dispatch triage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 hidden sm:inline tabular-nums">
                {recoveryRate}% rescued
              </span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                {openSections.frontdesk ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </button>

          {/* Section Body */}
          {openSections.frontdesk && (
            <div className="p-4 sm:p-6 space-y-4">
              {/* Active Status Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
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

              {/* Stat Matrix */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Stat 1: Total Calls Logged */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Total Calls Logged</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    {totalMissedCalls}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Inbound customer calls
                  </div>
                </div>

                {/* Stat 2: Conversations Rescued (Interactive Deep Link) */}
                <Link
                  href="/client/inbox"
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-600/70 transition-colors block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                  aria-label={`Conversations Rescued: ${recoveredCount}. Tap to view inbox.`}
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>Conversations Rescued</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                    {recoveredCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 group-hover:text-blue-700 dark:group-hover:text-blue-300 font-medium">
                    Replied to text-back · Open Inbox
                  </div>
                </Link>

                {/* Stat 3: Recovery Rate */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Recovery Rate</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                    {recoveryRate}%
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Prevented lost leads to competitors
                  </div>
                </div>

                {/* Stat 4: Public Self-Service Bookings */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Public Bookings</div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums">
                    {onlineBookingsCount}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Self-service appointments booked
                  </div>
                </div>
              </div>

              {/* Informational Explainer Note */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-zinc-400">
                <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Calls are marked as recovered when an inbound caller receives your automated text-back and responds, keeping the job lead warm.
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── Section 4: Customer Retention & Loyalty ── */}
        <section 
          aria-labelledby="section-heading-retention"
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden transition-all"
        >
          {/* Header Toggle */}
          <button
            type="button"
            onClick={() => toggleSection('retention')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors min-h-[48px] cursor-pointer"
            aria-expanded={openSections.retention}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 id="section-heading-retention" className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Customer Retention &amp; Loyalty
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Repeat bookings, follow-ups, and reputation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 hidden sm:inline tabular-nums">
                {repeatRate}% repeat rate
              </span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                {openSections.retention ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </button>

          {/* Section Body */}
          {openSections.retention && (
            <div className="p-4 sm:p-6 space-y-4">
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

              {/* Stat Matrix */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Stat 1: Repeat Bookings */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Repeat Bookings</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    {repeatBookingsCount}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Second or subsequent jobs booked
                  </div>
                </div>

                {/* Stat 2: Repeat Clients */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Repeat Clients</div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums">
                    {repeatCustomerCount}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Returning homeowners and commercial clients
                  </div>
                </div>

                {/* Stat 3: Follow-Ups Due (Interactive Deep Link) */}
                <Link
                  href="/client/customers"
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600/70 transition-colors block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                  aria-label={`Follow-Ups Due: ${followUpsDueCount}. Tap to re-engage.`}
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>Follow-Ups Due</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                  </div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                    {followUpsDueCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 group-hover:text-amber-700 dark:group-hover:text-amber-300 font-medium">
                    Seasonal service due · Re-engage
                  </div>
                </Link>

                {/* Stat 4: Reviews Triggered (Interactive Deep Link) */}
                <Link
                  href="/client/reviews"
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-600/70 transition-colors block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  aria-label={`Reviews Triggered: ${reviewsSentCount}. Tap to track.`}
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>Reviews Triggered</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                    {reviewsSentCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 font-medium">
                    Google review links sent · Track
                  </div>
                </Link>
              </div>

              {/* Informational Explainer Note */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-zinc-400">
                <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Returning customers cost 5x less to acquire than new leads. CaptoDesk tracks job history per contact to alert you when clients are due for maintenance.
                </span>
              </div>
            </div>
          )}
        </section>

      </div>

      {/* ── Bottom Link back to Daily Route Dispatch ── */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-800">
        <span>Need tactical daily route dispatch or today&apos;s upcoming stops?</span>
        <Link 
          href="/client/dashboard" 
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
          aria-label="Return to Today's Route and Dispatch"
        >
          <span>Return to Today&apos;s Route &amp; Dispatch</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
