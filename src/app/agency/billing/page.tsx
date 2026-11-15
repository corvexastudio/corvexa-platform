'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  CreditCard, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  Layers, 
  Download,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { 
  AgencyPortfolioOverview, 
  AgencyTier, 
  AGENCY_TIERS_LIST, 
  getAgencyTierConfig 
} from '@/lib/agency/agency-types'

export default function AgencyBillingPage() {
  const [overview, setOverview] = useState<AgencyPortfolioOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [switchingTier, setSwitchingTier] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const res = await fetch('/api/agency/overview')
        if (res.ok) {
          const data = await res.json()
          setOverview(data)
        }
      } catch (err) {
        console.error('[AGENCY BILLING] Error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const currentTier = overview?.agency?.subscription_tier
  const hasActiveSubscription = overview?.agency?.subscription_status === 'active' && Boolean(currentTier) && currentTier !== 'none'
  const activeTierConfig = hasActiveSubscription && currentTier ? getAgencyTierConfig(currentTier) : null
  const usedSlots = overview?.used_slots ?? 0
  const totalSlots = overview?.total_slots ?? (activeTierConfig?.slots ?? 0)

  async function handleSelectTier(tierId: AgencyTier) {
    if (hasActiveSubscription && tierId === currentTier) return

    setSwitchingTier(tierId)
    try {
      const res = await fetch('/api/agency/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: overview?.agency?.id || 'agency-partner',
          tier: tierId
        })
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to select plan')
        return
      }

      if (data.overview) {
        setOverview(data.overview)
      }
      const targetConfig = getAgencyTierConfig(tierId)
      toast.success(
        hasActiveSubscription
          ? `Wholesale plan updated to ${targetConfig.name} (${targetConfig.slots} client capacity slots).`
          : `Subscribed to ${targetConfig.name} (${targetConfig.slots} client capacity slots activated).`
      )
    } catch (err: any) {
      toast.error(err?.message || 'Error updating wholesale plan')
    } finally {
      setSwitchingTier(null)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-1 font-mono">
            <Link href="/dashboard" className="hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              <span>Portfolio</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-zinc-200">Capacity & Billing</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Wholesale Capacity & Plans</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manage wholesale client slots, track capacity, and select your agency subscription.
          </p>
        </div>
      </div>

      {/* Subscription Status Card: Active vs Pending Plan Selection */}
      {hasActiveSubscription && activeTierConfig ? (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 transition-colors">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                Active Plan
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {activeTierConfig.name} (${activeTierConfig.price}.00 / month)
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Billed monthly. Covers up to {totalSlots} contractor clients (${activeTierConfig.costPerSlot.toFixed(2)}/client/mo).
            </p>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-zinc-800 pt-4 md:pt-0 md:pl-6">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Slot Capacity</span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                {usedSlots} / {totalSlots}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                {Math.max(0, totalSlots - usedSlots)} available
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                Setup Required
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Choose a Wholesale Plan
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Select a client capacity package to activate dedicated phone lines, missed-call auto-text, and contractor booking portals.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-zinc-400 shrink-0">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Switch or scale anytime</span>
          </div>
        </div>
      )}

      {/* Wholesale Tier Selection Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {hasActiveSubscription ? 'All Available Wholesale Capacity Plans' : 'Choose Your Partner Plan'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {hasActiveSubscription 
                ? 'Select or scale your wholesale capacity package anytime. All client slots can be reassigned freely across accounts.'
                : 'Select any plan to subscribe. All tiers include full white-label telephony, missed-call auto-text, and client embed widgets.'}
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            {AGENCY_TIERS_LIST.length} Tiers Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {AGENCY_TIERS_LIST.map((tier) => {
            const isCurrent = Boolean(hasActiveSubscription && currentTier === tier.id)
            const isSwitching = switchingTier === tier.id
            const isUpgrade = Boolean(hasActiveSubscription && activeTierConfig && tier.price > activeTierConfig.price)

            return (
              <div 
                key={tier.id}
                className={cn(
                  "p-5 rounded-xl border flex flex-col justify-between transition-all relative",
                  isCurrent
                    ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-2 border-emerald-500 shadow-md ring-1 ring-emerald-500/20"
                    : tier.highlight && !hasActiveSubscription
                      ? "bg-white dark:bg-zinc-900 border-2 border-emerald-500/80 shadow-xs hover:border-emerald-500 ring-1 ring-emerald-500/20"
                      : "bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-700"
                )}
              >
                {isCurrent && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    Current Active
                  </div>
                )}
                {!isCurrent && tier.highlight && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{tier.name}</h3>
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">${tier.price}</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">/ month</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 font-semibold">
                    ${tier.costPerSlot.toFixed(2)} / client slot ({tier.slots} slots)
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-3 leading-relaxed min-h-[48px]">
                    {tier.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2 text-xs">
                    {tier.features.map((feat, idx) => (
                      <div key={`feat-${tier.id}-${idx}`} className="flex items-start gap-2 text-slate-700 dark:text-zinc-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800">
                  {isCurrent ? (
                    <Button
                      disabled
                      className="w-full h-9 text-xs font-semibold bg-emerald-100/50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-default"
                    >
                      Current Active Plan
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={loading || Boolean(switchingTier)}
                      className={cn(
                        "w-full h-9 text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs gap-1.5",
                        tier.highlight || !hasActiveSubscription
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : "bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-slate-900"
                      )}
                      onClick={() => handleSelectTier(tier.id)}
                    >
                      {isSwitching ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Activating...</span>
                        </>
                      ) : (
                        <span>
                          {!hasActiveSubscription
                            ? `Subscribe to ${tier.name}`
                            : isUpgrade
                            ? 'Upgrade to Plan'
                            : 'Select This Plan'}
                        </span>
                      )}
                    </Button>
                  )}
                </div>

              </div>
            )
          })}
        </div>

        {/* Enterprise & High Volume 50+ Slots Banner */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                Enterprise &bull; 50+ Slots
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
              Managing 50+ contractor locations or multiple marketing agency franchises?
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Custom carrier trunking, dedicated IP pools, custom white-label subdomains, and volume SLAs are available.
            </p>
          </div>
          <a
            href="mailto:partners@captodesk.com?subject=Wholesale%20Enterprise%2050%2B%20Slots%20Inquiry"
            className="shrink-0 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors"
          >
            Contact Partner Desk
          </a>
        </div>

        {/* Clean 1-Line Capacity Callout */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-100/70 dark:bg-zinc-850/60 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">Capacity Rule:</span>
            <span>1 Slot = 1 Solo Contractor (1 Van). Multi-van operations (2–5 vans) consume 2 slots.</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 shrink-0">
            Slots reassign freely upon client offboarding
          </span>
        </div>
      </div>

    </div>
  )
}
