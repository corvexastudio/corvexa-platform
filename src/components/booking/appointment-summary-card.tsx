'use client'

import { Clock, ChevronLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ServiceAddOn } from '@/lib/services/service-pricing'

export interface AppointmentSummaryCardProps {
  serviceName: string
  durationMinutes: number
  formattedPrice: string
  selectedAddOns?: ServiceAddOn[]
  onChangeService: () => void
  className?: string
}

export function AppointmentSummaryCard({
  serviceName,
  durationMinutes,
  formattedPrice,
  selectedAddOns = [],
  onChangeService,
  className
}: AppointmentSummaryCardProps) {
  const addOnsCount = selectedAddOns.length

  return (
    <div
      className={cn(
        "p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-2xs space-y-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          Selected Service
        </span>
        <button
          type="button"
          onClick={onChangeService}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
          aria-label="Change selected service"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Change Service</span>
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
            {serviceName}
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-zinc-300">
              <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>{durationMinutes} mins</span>
            </span>

            <span>•</span>

            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formattedPrice}
            </span>

            {addOnsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-semibold">
                <Sparkles className="h-2.5 w-2.5" />
                <span>+{addOnsCount} upgrade{addOnsCount > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
