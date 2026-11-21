'use client'

import React, { useState, useEffect } from 'react'
import { Zap, Lock, ChevronRight, CheckCircle2, ShieldCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MilestoneUpgradeModal } from './milestone-upgrade-modal'
import { useWorkspace } from '@/lib/context/workspace-context'

export interface PlanLimitBadgeProps {
  completedJobsCount?: number
  isLimitReached?: boolean
  className?: string
}

export function PlanLimitBadge({
  completedJobsCount: propCount,
  isLimitReached: propLimitReached,
  className
}: PlanLimitBadgeProps) {
  const { planId, subscriptionStatus } = useWorkspace()
  const isPaidPlan = ['solo', 'multi_crew', 'fleet', 'captodesk_standard', 'solo_yearly', 'multi_crew_yearly'].includes(
    (planId || '').toLowerCase()
  )
  const isPayingActive = subscriptionStatus === 'active' && isPaidPlan

  const [usage, setUsage] = useState<{
    completedJobsCount: number
    totalRevenueEarned: number
    isLimitReached: boolean
  } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isPayingActive) return
    if (propCount !== undefined) return

    let mounted = true
    fetch('/api/client/billing')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (mounted && data?.entitlement?.starterUsage) {
          setUsage(data.entitlement.starterUsage)
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [isPayingActive, propCount])

  if (isPayingActive || dismissed) return null

  const count = Math.min(3, Math.max(0, propCount ?? usage?.completedJobsCount ?? 0))
  const isLimitReached = propLimitReached ?? usage?.isLimitReached ?? count >= 3
  const remaining = Math.max(0, 3 - count)

  return (
    <>
      <div
        className={cn(
          'w-full flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl text-xs transition-colors shadow-2xs border select-none',
          isLimitReached
            ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            : 'bg-slate-50/90 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300',
          className
        )}
      >
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer min-h-[36px]"
          aria-label="View Starter Pass details and upgrade options"
        >
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white font-bold text-[10px]',
              isLimitReached ? 'bg-amber-600' : 'bg-blue-600'
            )}
          >
            {isLimitReached ? <Lock className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
          </span>

          <div className="flex flex-col min-w-0">
            <span className="font-bold truncate text-[11px] sm:text-xs">
              {isLimitReached
                ? 'Starter Pass Limit Reached (3 of 3 Jobs Completed)'
                : `Starter Pass: ${count} of 3 Jobs Used (${remaining} Remaining)`}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
              {isLimitReached
                ? 'Upgrade to Solo Pro to unlock unlimited jobs and invoicing'
                : '$0 platform fees on your first 3 completed customer jobs'}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-1 min-h-[36px] flex items-center gap-0.5 cursor-pointer"
          >
            <span>Upgrade</span>
            <ChevronRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 rounded-md min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <MilestoneUpgradeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        completedJobsCount={count}
        isLimitReached={isLimitReached}
        totalRevenue={usage?.totalRevenueEarned || 0}
      />
    </>
  )
}
