'use client'

import { ChevronRight, Clock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ServiceCardItem } from './service-card'
import { type ServiceAddOn } from '@/lib/services/service-pricing'

export interface BookingBottomBarProps {
  selectedService: ServiceCardItem | null
  selectedAddOns: ServiceAddOn[]
  formattedTotal?: string | null
  totalDurationMinutes: number
  onContinue: () => void
  disabled?: boolean
  className?: string
}

export function BookingBottomBar({
  selectedService,
  selectedAddOns,
  formattedTotal,
  totalDurationMinutes,
  onContinue,
  disabled = false,
  className
}: BookingBottomBarProps) {
  const isSelected = !!selectedService
  const addOnsCount = selectedAddOns.length

  return (
    <aside
      aria-label="Booking summary and step progression"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-zinc-800 p-3 sm:p-4 shadow-2xl transition-all",
        className
      )}
    >
      <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
        {/* Left Side: Selected Summary or Prompt */}
        <div className="min-w-0 flex-1">
          {isSelected ? (
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Selected Service
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {selectedService.name}
              </p>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-0.5 font-medium text-slate-700 dark:text-zinc-300">
                  <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span>{totalDurationMinutes} mins</span>
                </span>
                <span>•</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formattedTotal || selectedService.formatted_price || 'Price on request'}
                </span>
                {addOnsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-medium">
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>+{addOnsCount} extra{addOnsCount > 1 ? 's' : ''}</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Step 1 of 3
              </span>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-medium">
                Choose a service above to continue
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Primary CTA */}
        <button
          type="button"
          onClick={onContinue}
          disabled={!isSelected || disabled}
          aria-label={isSelected ? 'Continue to Date and Time selection' : 'Select a service to continue'}
          className={cn(
            "h-11 sm:h-12 px-4 sm:px-6 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md select-none",
            isSelected && !disabled
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-[0.98]"
              : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 shadow-none cursor-not-allowed opacity-75"
          )}
        >
          <span className="hidden sm:inline">Continue to Date &amp; Time</span>
          <span className="sm:hidden">Continue</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
