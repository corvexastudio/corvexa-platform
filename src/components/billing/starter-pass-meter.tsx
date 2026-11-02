'use client'

import React, { useState, useEffect } from 'react'
import { Check, ChevronRight, Zap, Trophy, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MilestoneUpgradeModal } from './milestone-upgrade-modal'
import { useWorkspace } from '@/lib/context/workspace-context'

export interface StarterPassMeterProps {
  completedJobsCount?: number
  totalRevenue?: number
  isLimitReached?: boolean
  isPayingActive?: boolean
  onUpgradeClick?: () => void
  className?: string
}

/**
 * Mobile-First 3-Job Starter Pass Progress Meter
 * 
 * Compact, touch-friendly header pill banner optimized for mobile screens (375px+).
 * Visualizes the 3 discrete milestones with dopamine indicators and $0 fee tracking.
 */
export function StarterPassMeter({
  completedJobsCount: propCount,
  totalRevenue: propRevenue,
  isLimitReached: propLimitReached,
  isPayingActive: propPayingActive,
  onUpgradeClick,
  className
}: StarterPassMeterProps) {
  const { operationMode, subscriptionStatus, planId } = useWorkspace()
  
  // Local state for auto-fetching if props are omitted
  const [fetchedUsage, setFetchedUsage] = useState<{
    completedJobsCount: number
    totalRevenueEarned: number
    isLimitReached: boolean
  } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const isPaidPlan = ['solo', 'multi_crew', 'fleet', 'captodesk_standard', 'solo_yearly', 'multi_crew_yearly'].includes((planId || '').toLowerCase())
  const isPayingActive = propPayingActive ?? (subscriptionStatus === 'active' && isPaidPlan)

  useEffect(() => {
    if (isPayingActive) return
    if (propCount !== undefined && propRevenue !== undefined) return

    let isMounted = true
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/client/billing')
        if (res.ok) {
          const data = await res.json()
          if (isMounted && data.entitlement?.starterUsage) {
            setFetchedUsage(data.entitlement.starterUsage)
          }
        }
      } catch {
        // Non-blocking
      }
    }

    fetchUsage()
    return () => {
      isMounted = false
    }
  }, [isPayingActive, propCount, propRevenue])

  // If contractor has already upgraded to paid Pro, meter is hidden
  if (isPayingActive) return null

  const count = Math.min(3, Math.max(0, propCount ?? fetchedUsage?.completedJobsCount ?? 0))
  const totalRevenue = propRevenue ?? fetchedUsage?.totalRevenueEarned ?? 0
  const isLimitReached = propLimitReached ?? fetchedUsage?.isLimitReached ?? (count >= 3)

  const remaining = Math.max(0, 3 - count)
  const isComplete = isLimitReached || count >= 3
  const formattedRevenue = Math.round(totalRevenue).toLocaleString('en-US')

  const handleClick = () => {
    if (onUpgradeClick) {
      onUpgradeClick()
    } else {
      setModalOpen(true)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all duration-200 cursor-pointer active:scale-[0.99] select-none',
          isComplete
            ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/40 text-amber-900 dark:text-amber-100 shadow-xs'
            : 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 hover:from-emerald-500/15 hover:to-blue-500/15 border border-emerald-500/25 text-slate-800 dark:text-zinc-100 shadow-2xs',
          className
        )}
        aria-label="Starter Pass status and upgrade details"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Milestone Icon */}
          <div
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-200',
              isComplete
                ? 'bg-amber-500 text-black border-amber-400 font-bold'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            )}
          >
            {isComplete ? (
              <Trophy className="w-4 h-4 animate-bounce" />
            ) : (
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>

          {/* Milestone Description */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1">
                {isComplete ? 'Starter Pass Limit Reached' : 'Free 3-Job Starter Pass'}
              </span>
              {totalRevenue > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  ${formattedRevenue} Earned ($0 Fees)
                </span>
              )}
            </div>

            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 font-medium truncate mt-0.5">
              {isComplete
                ? 'You completed 3 free jobs! Upgrade to Pro to unlock next booking'
                : count === 0
                  ? '3 free customer jobs remaining • $0 platform fees'
                  : `${remaining} free ${remaining === 1 ? 'job' : 'jobs'} left • Review requests auto-sent`}
            </p>
          </div>
        </div>

        {/* Discrete Milestone Nodes (Mobile-Optimized) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-zinc-800/60">
            {[1, 2, 3].map((step) => {
              const isDone = count >= step
              const isCurrent = !isDone && count + 1 === step

              return (
                <div
                  key={step}
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                    isDone
                      ? 'bg-emerald-500 text-white shadow-2xs'
                      : isCurrent
                        ? 'border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 animate-pulse'
                        : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600'
                  )}
                  title={`Job ${step} of 3`}
                >
                  {isDone ? (
                    <Check className="w-3 h-3 stroke-[3]" />
                  ) : isComplete ? (
                    <Lock className="w-2.5 h-2.5" />
                  ) : (
                    <span>{step}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action Chevron */}
          <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Upgrade Celebration Modal */}
      <MilestoneUpgradeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        totalRevenue={totalRevenue}
        operationMode={operationMode}
      />
    </>
  )
}
