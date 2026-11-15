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
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AgencyPortfolioOverview } from '@/lib/agency/agency-types'

const TIERS = [
  {
    id: 'starter_3',
    name: 'Starter 3-Pack',
    price: 129,
    slots: 3,
    costPerSlot: 43.00,
    description: 'Perfect for boutique agencies testing rapid lead recovery on 2 to 3 trade clients.',
    features: [
      'Up to 3 Active Contractor Clients',
      'Dedicated 10DLC Local Phone Numbers',
      '5-Second Missed Call Auto-Text Engine',
      'UTM Closed-Loop Revenue Attribution',
      'Zero-Login Mobile Field Dispatch'
    ],
    highlight: false,
  },
  {
    id: 'growth_10',
    name: 'Growth 10-Pack',
    price: 349,
    slots: 10,
    costPerSlot: 34.90,
    description: 'Our most popular partner tier. Covers full home service rosters with maximum margin.',
    features: [
      'Up to 10 Active Contractor Clients',
      'All Starter Features Included',
      'Free 10DLC Brand & Carrier Setups',
      'Priority Carrier Line Provisioning',
      'Dedicated Partner Success Channel',
      'Monthly PDF Retainer Defense Reports'
    ],
    highlight: true,
  },
  {
    id: 'scale_25',
    name: 'Scale 25-Pack',
    price: 699,
    slots: 25,
    costPerSlot: 27.96,
    description: 'For scaling trade marketing firms managing multi-metro HVAC and plumbing clients.',
    features: [
      'Up to 25 Active Contractor Clients',
      'All Growth Features Included',
      'Custom Agency Domain Mapping',
      'Quarterly Retainer Strategy Audits',
      'Dedicated Technical Account Manager',
      'Multi-Team Member Agency Logins'
    ],
    highlight: false,
  },
]

export default function AgencyBillingPage() {
  const [overview, setOverview] = useState<AgencyPortfolioOverview | null>(null)
  const [loading, setLoading] = useState(true)

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

  const currentTier = overview?.agency?.subscription_tier || 'growth_10'
  const usedSlots = overview?.used_slots ?? 0
  const totalSlots = overview?.total_slots ?? 10

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-1 font-mono">
            <Link href="/agency/dashboard" className="hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              <span>Portfolio</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-zinc-200">Partner Capacity & Billing</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Slot Capacity & Wholesale Billing</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manage your agency’s wholesale slot packs, view active occupancy, and upgrade client capacity.
          </p>
        </div>
      </div>

      {/* Active Subscription Overview Card */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
              Active Wholesale Plan
            </span>
            <Badge className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px]">
              Active Auto-Renew
            </Badge>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Growth 10-Pack ($349.00 / month)
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Billed on the 1st of every month via Stripe Wholesale Auto-Debit. Covers up to 10 contractor clients ($34.90/client/mo).
          </p>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-zinc-800 pt-4 md:pt-0 md:pl-6">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Slot Occupancy</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
              {usedSlots} / {totalSlots} <span className="text-xs text-slate-500 dark:text-zinc-400 font-sans font-normal">Assigned</span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              {totalSlots - usedSlots} slots available to deploy
            </span>
          </div>
        </div>
      </div>

      {/* Wholesale Tier Upgrade Grid */}
      <div className="space-y-3 pt-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Wholesale Capacity Plans</h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Scale your agency capacity with discounted volume licensing. Slots can be reassigned between clients anytime.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {TIERS.map((tier) => {
            const isCurrent = currentTier === tier.id

            return (
              <div 
                key={tier.id}
                className={cn(
                  "p-5 rounded-xl border flex flex-col justify-between transition-all relative",
                  tier.highlight 
                    ? "bg-white dark:bg-zinc-900 border-2 border-emerald-500 shadow-md" 
                    : "bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-2xs"
                )}
              >
                {tier.highlight && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    Agency Sweet Spot
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{tier.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">${tier.price}</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">/ month</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 font-semibold">
                    ${tier.costPerSlot.toFixed(2)} per client slot
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-3 leading-relaxed">
                    {tier.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2 text-xs">
                    {tier.features.map((feat, idx) => (
                      <div key={`feat-${idx}`} className="flex items-start gap-2 text-slate-700 dark:text-zinc-300">
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
                      className="w-full h-9 text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 rounded-lg"
                    >
                      Current Active Plan
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer shadow-2xs"
                      onClick={() => toast.info(`To upgrade to ${tier.name}, contact your partner account lead or email partners@captodesk.com`)}
                    >
                      {tier.price > 349 ? 'Upgrade Capacity' : 'Select Plan'}
                    </Button>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
