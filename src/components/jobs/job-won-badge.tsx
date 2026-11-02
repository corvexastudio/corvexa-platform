'use client'

import React from 'react'
import { Sparkles, Trophy, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface JobWonBadgeProps {
  amount?: number | null
  milestoneIndex?: number // e.g. 1, 2, 3
  compact?: boolean
  className?: string
  label?: string
}

/**
 * Mobile-First Dopamine "Contract Won!" Badge
 * Celebrates incoming customer bookings and reinforces business revenue milestones.
 */
export function JobWonBadge({
  amount,
  milestoneIndex,
  compact = false,
  className,
  label = 'CONTRACT WON'
}: JobWonBadgeProps) {
  const displayAmount = typeof amount === 'number' && amount > 0 
    ? Math.round(amount).toLocaleString('en-US') 
    : '250'

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide',
          'bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15',
          'border border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
          'shadow-xs animate-in fade-in duration-300',
          className
        )}
      >
        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 animate-pulse" />
        <span className="uppercase">{label}</span>
        <span className="text-emerald-800 dark:text-emerald-300 font-extrabold">• ${displayAmount}</span>
      </span>
    )
  }

  return (
    <div
      className={cn(
        'w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl',
        'bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40',
        'border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs',
        'transition-all duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
          <Trophy className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse text-amber-500" />
              {label}
            </span>
            {milestoneIndex && milestoneIndex <= 3 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                Job {milestoneIndex} of 3 Free
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium truncate mt-0.5">
            Customer booked via your live link
          </p>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block leading-tight">
          Est. Value
        </span>
        <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 leading-tight">
          ${displayAmount}
        </span>
      </div>
    </div>
  )
}
