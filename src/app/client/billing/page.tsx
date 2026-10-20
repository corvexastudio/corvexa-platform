'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
  RotateCcw,
  Users,
  Smartphone,
  ExternalLink,
  MessageSquare,
  DollarSign,
  Loader2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BillingData {
  organization: {
    id: string
    name: string
    slug: string
    subscription_status: string
    monthly_rate: number
    telnyx_phone_number?: string | null
  }
  subscription: {
    id: string
    org_id: string
    plan_id: string
    status: string
    billing_interval: string
    amount: number
    currency: string
    current_period_start: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean
    canceled_at: string | null
    provider: string
  } | null
  entitlement: {
    isEntitled: boolean
    status: string
    reason: string
    daysRemaining?: number
  } | null
  currentPlan: {
    id: string
    name: string
    description: string
    amount: number
    currency: string
    billingInterval: string
    maxUsers: number
    tier: string
    features: string[]
  }
  availablePlans: any[]
  payments: any[]
  canManageBilling: boolean
}

export default function ClientBillingPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [billingCycleToggle, setBillingCycleToggle] = useState<'monthly' | 'yearly'>('monthly')

  // Modals state
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false)
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<any | null>(null)
  const [changeNotes, setChangeNotes] = useState('')
  const [submittingChange, setSubmittingChange] = useState(false)

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [reactivating, setReactivating] = useState(false)

  const fetchBilling = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/billing')
      const data = await res.json()
      if (res.ok) {
        setBillingData(data)
        if (data.subscription?.billing_interval === 'year' || data.subscription?.plan_id?.includes('yearly')) {
          setBillingCycleToggle('yearly')
        }
      } else {
        setError(data.error || 'Failed to load billing details')
      }
    } catch {
      setError('Network error loading billing information.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  const handleOpenChangePlan = (plan: any) => {
    setSelectedTargetPlan(plan)
    setChangeNotes('')
    setChangePlanModalOpen(true)
  }

  const handleConfirmPlanChange = async () => {
    if (!selectedTargetPlan) return
    setSubmittingChange(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_change',
          targetPlanId: selectedTargetPlan.id,
          notes: changeNotes.trim() || undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Plan change request submitted!')
        setChangePlanModalOpen(false)
        fetchBilling()
      } else {
        toast.error(data.error || 'Failed to submit plan change.')
      }
    } catch {
      toast.error('Network error submitting plan change request.')
    } finally {
      setSubmittingChange(false)
    }
  }

  const handleConfirmCancel = async () => {
    setCanceling(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          reason: cancelReason.trim() || undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Subscription scheduled for cancellation.')
        setCancelModalOpen(false)
        fetchBilling()
      } else {
        toast.error(data.error || 'Failed to schedule cancellation.')
      }
    } catch {
      toast.error('Network error scheduling cancellation.')
    } finally {
      setCanceling(false)
    }
  }

  const handleReactivate = async () => {
    setReactivating(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Subscription reactivated!')
        fetchBilling()
      } else {
        toast.error(data.error || 'Failed to reactivate subscription.')
      }
    } catch {
      toast.error('Network error reactivating subscription.')
    } finally {
      setReactivating(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-zinc-800" />
          <Skeleton className="h-4 w-96 bg-zinc-800" />
        </div>
        <Skeleton className="h-56 w-full rounded-2xl bg-zinc-900" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full rounded-2xl bg-zinc-900" />
          <Skeleton className="h-80 w-full rounded-2xl bg-zinc-900" />
        </div>
      </div>
    )
  }

  if (error || !billingData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ErrorState
          title="Unable to load billing"
          description={error || 'An error occurred loading your subscription details.'}
          onRetry={fetchBilling}
        />
      </div>
    )
  }

  const sub = billingData.subscription
  const isScheduledCancellation = sub?.cancel_at_period_end
  const isCanceled = sub?.status === 'canceled'
  const isTrial = billingData.organization.subscription_status === 'trial'
  const currentPlanId = sub?.plan_id || 'solo'

  const renewalDateFormatted = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : null

  // Plan matching helper
  const isCurrentSolo = currentPlanId === 'solo' || currentPlanId === 'solo_yearly' || currentPlanId === 'captodesk_standard'
  const isCurrentMultiCrew = currentPlanId === 'multi_crew' || currentPlanId === 'multi_crew_yearly'

  return (
    <div className="max-w-6xl mx-auto space-y-10 p-4 sm:p-6 lg:p-8 pb-20">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <CreditCard className="w-3.5 h-3.5" />
            <span>MEMBERSHIP & BILLING</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Subscription & Plans
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage your CaptoDesk subscription, view team seat limits, and review payment receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/client/settings"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            ← Back to Settings
          </Link>
        </div>
      </div>

      {/* ── Scheduled Cancellation Alert ── */}
      {isScheduledCancellation && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-200">Subscription Scheduled for Cancellation</h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Your CaptoDesk services will remain active until <strong>{renewalDateFormatted}</strong>. After this date, missed call AI recovery and online booking will pause.
              </p>
            </div>
          </div>
          <Button
            onClick={handleReactivate}
            disabled={reactivating}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs shrink-0"
          >
            {reactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            Resume Subscription
          </Button>
        </div>
      )}

      {/* ── 2. Active Subscription Summary Card ── */}
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900/60 to-zinc-950 p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Plan Info */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Current Plan</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize',
                  sub?.status === 'active' && !isScheduledCancellation
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : isScheduledCancellation
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    : isTrial
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    sub?.status === 'active' && !isScheduledCancellation
                      ? 'bg-emerald-400'
                      : isScheduledCancellation
                      ? 'bg-amber-400'
                      : 'bg-zinc-400'
                  )}
                />
                {isScheduledCancellation ? 'Cancels at Period End' : sub?.status || 'Active Onboarding'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {billingData.currentPlan.name}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
              {billingData.currentPlan.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-zinc-850 text-xs">
              <div>
                <span className="text-zinc-500 block">Team Seats</span>
                <span className="font-semibold text-zinc-200">
                  {billingData.currentPlan.maxUsers === 1 ? '1 Solo Owner' : `Up to ${billingData.currentPlan.maxUsers} Crew Members`}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Dedicated Phone</span>
                <span className="font-semibold text-zinc-200 font-mono">
                  {billingData.organization.telnyx_phone_number || '10DLC Active'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Billing Interval</span>
                <span className="font-semibold text-zinc-200 capitalize">
                  {sub?.billing_interval || 'Monthly'} Auto-Renew
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Cycle Status */}
          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Subscription Rate</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
                  ${sub?.amount || billingData.currentPlan.amount}
                </span>
                <span className="text-zinc-400 text-xs font-medium">
                  / {sub?.billing_interval === 'year' ? 'year' : 'month'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs text-zinc-400 border-t border-zinc-800 pt-3">
              <div className="flex justify-between">
                <span>Renewal Date:</span>
                <span className="text-white font-medium">{renewalDateFormatted || 'Active'}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="text-white font-medium">PayPal Subscription</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Plan Change & Comparison ── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">Compare & Change Plans</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upgrade as your business grows. Switch to yearly anytime to get 2 months free.
            </p>
          </div>

          {/* Monthly / Yearly Toggle */}
          <div className="inline-flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setBillingCycleToggle('monthly')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                billingCycleToggle === 'monthly'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycleToggle('yearly')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                billingCycleToggle === 'yearly'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              <span>Yearly</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[9px] font-extrabold uppercase">
                2 Mo Free
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* ── Card 1: Solo Plan ($99/mo or $990/yr) ── */}
          <div
            className={cn(
              'rounded-3xl border bg-zinc-950 p-6 sm:p-7 flex flex-col justify-between space-y-6 transition-all',
              isCurrentSolo ? 'border-zinc-700 bg-zinc-900/30' : 'border-zinc-800'
            )}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                  SOLO OPERATOR
                </span>
                {isCurrentSolo && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Current Plan
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-xl font-bold text-white">CaptoDesk Solo</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Built for 1 owner-operator running their service business from their phone.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-zinc-850">
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
                  ${billingCycleToggle === 'monthly' ? '99' : '990'}
                </span>
                <span className="text-zinc-400 text-xs font-medium">
                  / {billingCycleToggle === 'monthly' ? 'month' : 'year (2 Mo Free)'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-zinc-850">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>1 Owner-Operator Seat</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Instant 8-second AI missed-call recovery</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Public customer booking link</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Mobile Field Portal with GPS routing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Apple Pay & Card Invoicing (0.5% flat)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Domino&apos;s customer live tracking links</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-850">
              {isCurrentSolo ? (
                <Button disabled className="w-full bg-zinc-800 text-zinc-400 font-bold text-xs cursor-default">
                  Current Plan
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    handleOpenChangePlan({
                      id: billingCycleToggle === 'monthly' ? 'solo' : 'solo_yearly',
                      name: 'CaptoDesk Solo',
                      amount: billingCycleToggle === 'monthly' ? 99 : 990,
                      interval: billingCycleToggle
                    })
                  }
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-zinc-700"
                >
                  Downgrade to Solo (${billingCycleToggle === 'monthly' ? '99/mo' : '990/yr'})
                </Button>
              )}
            </div>
          </div>

          {/* ── Card 2: Multi-Crew Plan ($199/mo or $1,990/yr) ── */}
          <div
            className={cn(
              'rounded-3xl border-2 bg-zinc-950 p-6 sm:p-7 flex flex-col justify-between space-y-6 relative transition-all',
              isCurrentMultiCrew ? 'border-emerald-500/60 bg-zinc-900/40 shadow-xl' : 'border-emerald-500 shadow-2xl'
            )}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GROWING FLEET
                </span>
                {isCurrentMultiCrew ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Current Plan
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-600 text-white">
                    RECOMMENDED
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-xl font-bold text-white">CaptoDesk Multi-Crew</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  For growing businesses with helpers, field crews, and technicians.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-zinc-850">
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
                  ${billingCycleToggle === 'monthly' ? '199' : '1,990'}
                </span>
                <span className="text-zinc-400 text-xs font-medium">
                  / {billingCycleToggle === 'monthly' ? 'month' : 'year (2 Mo Free)'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-zinc-200 pt-2 border-t border-zinc-850">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Up to 5 Crew Members & Technicians</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Everything in Solo Plan</strong>, plus:</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Multi-crew live dispatch board & team schedule</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Restricted technician mobile portal (zero financial visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Role permissions (Owner, Admin, Dispatcher, Field Tech)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Priority message delivery routing</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-850">
              {isCurrentMultiCrew ? (
                <Button disabled className="w-full bg-zinc-800 text-zinc-400 font-bold text-xs cursor-default">
                  Current Plan
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    handleOpenChangePlan({
                      id: billingCycleToggle === 'monthly' ? 'multi_crew' : 'multi_crew_yearly',
                      name: 'CaptoDesk Multi-Crew',
                      amount: billingCycleToggle === 'monthly' ? 199 : 1990,
                      interval: billingCycleToggle
                    })
                  }
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30"
                >
                  Upgrade to Multi-Crew (${billingCycleToggle === 'monthly' ? '199/mo' : '1,990/yr'})
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Payment Receipts & History ── */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Billing History & Receipts</h3>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
          {billingData.payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No previous payment receipts recorded yet. Your upcoming subscription receipts will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider font-mono text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 text-zinc-300">
                  {billingData.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                        {new Date(p.payment_date || p.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {p.notes || 'CaptoDesk SaaS Subscription'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        ${p.amount} {p.currency || 'USD'}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 capitalize">
                        {p.provider || 'PayPal'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {p.payment_status || 'Completed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[10px] text-zinc-500 truncate max-w-[150px]">
                        {p.provider_payment_reference || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Cancellation & Danger Zone ── */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-rose-300">Cancel Membership</h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              You can cancel your subscription at any time. Your services will continue until your paid period ends.
            </p>
          </div>
          {isScheduledCancellation ? (
            <Button
              onClick={handleReactivate}
              disabled={reactivating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              {reactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
              Reactivate Subscription
            </Button>
          ) : (
            <Button
              onClick={() => setCancelModalOpen(true)}
              variant="outline"
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-bold text-xs"
            >
              Cancel Subscription
            </Button>
          )}
        </div>
      </div>

      {/* ── Plan Change Modal ── */}
      {changePlanModalOpen && selectedTargetPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Switch to {selectedTargetPlan.name}</h3>
                <p className="text-xs text-zinc-400">
                  ${selectedTargetPlan.amount} / {selectedTargetPlan.interval === 'yearly' ? 'year (2 Mo Free)' : 'month'}
                </p>
              </div>
              <button
                onClick={() => setChangePlanModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p>
                Confirm your request to switch to <strong>{selectedTargetPlan.name}</strong>.
              </p>
              <p className="text-zinc-400">
                Your account representative will adjust your PayPal recurring billing and update your team seat limits immediately without downtime.
              </p>

              <div className="space-y-1 pt-1">
                <label className="block text-zinc-400 font-semibold">Special Instructions (Optional)</label>
                <textarea
                  rows={3}
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="e.g. Please add 2 more helper seats to our fleet"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button
                variant="ghost"
                onClick={() => setChangePlanModalOpen(false)}
                disabled={submittingChange}
                className="text-xs text-zinc-400"
              >
                Nevermind
              </Button>
              <Button
                onClick={handleConfirmPlanChange}
                disabled={submittingChange}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                {submittingChange ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Confirm Plan Change
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Subscription Modal ── */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-rose-300">Cancel Your Membership?</h3>
                <p className="text-xs text-zinc-400">We&apos;re sorry to see you go.</p>
              </div>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p>
                If you cancel, your account will remain <strong>fully active until {renewalDateFormatted || 'the end of your period'}</strong>.
              </p>
              <p className="text-zinc-400">
                You will not be billed again. After your billing cycle ends, automated missed-call SMS text-back and booking links will be paused.
              </p>

              <div className="space-y-1 pt-1">
                <label className="block text-zinc-400 font-semibold">Reason for canceling (Optional)</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Tell us what we could have done better..."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button
                variant="ghost"
                onClick={() => setCancelModalOpen(false)}
                disabled={canceling}
                className="text-xs text-zinc-400"
              >
                Keep My Membership
              </Button>
              <Button
                onClick={handleConfirmCancel}
                disabled={canceling}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                {canceling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
