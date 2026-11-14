'use client'

import React from 'react'
import { Sparkles, Trophy, Tag, CheckCircle2, FileQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface JobWonBadgeProps {
  amount?: number | null
  milestoneIndex?: number // e.g. 1, 2, 3
  compact?: boolean
  className?: string
  label?: string
  pricingModel?: string | null
  servicePrice?: number | null
}

/**
 * Honest, Trade-First Job Badge
 * Factual badging for field service appointments and customer bookings.
 * Strictly respects real pricing: never invents fake or hardcoded dollar amounts.
 */
export function JobWonBadge({
  amount,
  milestoneIndex,
  compact = false,
  className,
  label = 'CONTRACT WON',
  pricingModel,
  servicePrice
}: JobWonBadgeProps) {
  // Determine real display amount: strictly use real data, NEVER hardcode a fake $250
  const realAmount = typeof amount === 'number' && amount > 0
    ? amount
    : typeof servicePrice === 'number' && servicePrice > 0
    ? servicePrice
    : null

  const displayAmount = realAmount !== null ? Math.round(realAmount).toLocaleString('en-US') : null

  // Determine factual display label
  const resolvedLabel = (() => {
    if (pricingModel === 'quote_on_site') return 'Quote on Site'
    if (pricingModel === 'free_estimate') return 'Free Estimate'
    if (pricingModel === 'diagnostic_fee') {
      return displayAmount ? `$${displayAmount} Diagnostic` : 'Diagnostic Fee'
    }
    return label
  })()

  if (compact) {
    const isQuoteNeeded = pricingModel === 'quote_on_site' || pricingModel === 'free_estimate'

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-normal transition-colors',
          isQuoteNeeded
            ? 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
            : displayAmount
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60'
            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60',
          className
        )}
      >
        {isQuoteNeeded ? (
          <FileQuestion className="w-3 h-3 text-slate-500 dark:text-zinc-400 shrink-0" />
        ) : displayAmount ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
        )}

        <span>{resolvedLabel}</span>
        {displayAmount && (
          <span className="font-bold text-emerald-900 dark:text-emerald-200">• ${displayAmount}</span>
        )}
      </span>
    )
  }

  return (
    <div
      className={cn(
        'w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl',
        'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs',
        'transition-all duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-zinc-700">
          <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              {resolvedLabel}
            </span>
            {milestoneIndex && milestoneIndex <= 3 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
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
          {displayAmount ? 'Est. Value' : 'Pricing Model'}
        </span>
        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 leading-tight">
          {displayAmount ? `$${displayAmount}` : (pricingModel === 'quote_on_site' ? 'Quote on Site' : 'Free Estimate')}
        </span>
      </div>
    </div>
  )
}

/**
 * Dedicated Dispatch Job Pricing Pill
 * Displays clean, human-designed status pill tailored to field service trade workflows.
 */
export interface JobPricingBadgeProps {
  servicePrice?: number | null
  pricingModel?: string | null
  quoteAmount?: number | null
  quoteStatus?: string | null
  className?: string
}

export function JobPricingBadge({
  servicePrice,
  pricingModel,
  quoteAmount,
  quoteStatus,
  className
}: JobPricingBadgeProps) {
  // 1. Accepted Quote takes precedence
  if (quoteStatus === 'accepted' && typeof quoteAmount === 'number' && quoteAmount > 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
          'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
          className
        )}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Approved Quote</span>
        <span className="font-bold text-emerald-900 dark:text-emerald-200">• ${Math.round(quoteAmount).toLocaleString('en-US')}</span>
      </span>
    )
  }

  // 2. Quote on Site (Explicit diagnostic / in-person estimate)
  if (pricingModel === 'quote_on_site') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
          'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700',
          className
        )}
        title="Exact price will be quoted on-site after inspection"
      >
        <FileQuestion className="w-3 h-3 text-slate-500 dark:text-zinc-400 shrink-0" />
        <span>Quote on Site</span>
      </span>
    )
  }

  // 3. Free Estimate
  if (pricingModel === 'free_estimate') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
          'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700',
          className
        )}
      >
        <Tag className="w-3 h-3 text-slate-500 dark:text-zinc-400 shrink-0" />
        <span>Free Estimate</span>
      </span>
    )
  }

  // 4. Diagnostic Fee
  if (pricingModel === 'diagnostic_fee') {
    const fee = typeof servicePrice === 'number' && servicePrice > 0 ? `$${Math.round(servicePrice)}` : null
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
          'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700',
          className
        )}
      >
        <Tag className="w-3 h-3 text-slate-500 dark:text-zinc-400 shrink-0" />
        <span>{fee ? `${fee} Diagnostic` : 'Diagnostic Fee'}</span>
      </span>
    )
  }

  // 5. Fixed Price or Starting At
  if (typeof servicePrice === 'number' && servicePrice > 0) {
    const prefix = pricingModel === 'starting_at' ? 'From ' : ''
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
          'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
          className
        )}
      >
        <Tag className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{prefix}${Math.round(servicePrice).toLocaleString('en-US')}</span>
      </span>
    )
  }

  // 6. Generic Online Booking
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
        'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700',
        className
      )}
    >
      <span>Online Booking</span>
    </span>
  )
}
