'use client'

import { useState } from 'react'
import { 
  Calendar, 
  Clock, 
  Tag, 
  ChevronRight, 
  ChevronDown, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  AlertCircle 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimeInTz, getFriendlyTimezoneLabel } from '@/lib/temporal/timezone'
import { type ServiceAddOn, type PricingModel } from '@/lib/services/service-pricing'

export interface BookingReviewSummaryProps {
  orgName: string
  bookingMode: 'instant' | 'request'
  serviceName: string
  category?: string
  pricingModel?: string
  basePrice?: number | null
  formattedTotal?: string | null
  totalDurationMinutes: number
  selectedAddOns?: ServiceAddOn[]
  selectedDate: string
  selectedDateFormatted?: string | null
  selectedSlot: {
    startTime: string
    displayTime: string
    endTime?: string
  } | null
  timezone: string
  onChangeService: () => void
  onChangeSlot: () => void
  className?: string
}

export function BookingReviewSummary({
  orgName,
  bookingMode,
  serviceName,
  category,
  pricingModel = 'fixed',
  basePrice,
  formattedTotal,
  totalDurationMinutes,
  selectedAddOns = [],
  selectedDate,
  selectedDateFormatted,
  selectedSlot,
  timezone,
  onChangeService,
  onChangeSlot,
  className
}: BookingReviewSummaryProps) {
  const [showAddonsBreakdown, setShowAddonsBreakdown] = useState(false)
  const friendlyTz = getFriendlyTimezoneLabel(timezone)
  const addOnsCount = selectedAddOns.length

  // Compute clean end time in business timezone
  const endTimeFormatted = selectedSlot?.endTime
    ? formatTimeInTz(selectedSlot.endTime, timezone)
    : null

  // Pricing Model Guidance Banner / Subtitle
  const getPricingSubtitle = () => {
    switch (pricingModel) {
      case 'fixed':
        return 'Guaranteed fixed service rate. No unexpected charges.'
      case 'starting_at':
        return 'Base price covers standard visit. Final scope confirmed on site.'
      case 'diagnostic_fee':
        return 'Covers comprehensive diagnostic inspection. Applied to repair upon approval.'
      case 'quote_on_site':
        return 'Custom on-site evaluation. Full estimate provided before any work begins.'
      case 'free_estimate':
        return 'Complimentary on-site assessment with zero obligation.'
      default:
        return 'Professional service by certified technicians.'
    }
  }

  return (
    <div
      role="region"
      aria-label="Appointment and pricing summary"
      className={cn(
        "rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-4",
        className
      )}
    >
      {/* Top Header: Business Name & Booking Mode */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {orgName}
          </span>
        </div>

        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
          bookingMode === 'instant'
            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
            : "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
        )}>
          {bookingMode === 'instant' ? 'Instant Confirmation' : 'Request Mode'}
        </span>
      </div>

      {/* Service Details Card */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {category && (
                <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  {category}
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
              {serviceName}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              {getPricingSubtitle()}
            </p>
          </div>

          <button
            type="button"
            onClick={onChangeService}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 shrink-0 cursor-pointer pt-0.5"
            aria-label="Change selected service"
          >
            Change
          </button>
        </div>

        {/* Pricing & Duration Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-400 font-medium bg-slate-50 dark:bg-zinc-800/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-zinc-800">
              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>{totalDurationMinutes} mins total</span>
            </span>

            {addOnsCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAddonsBreakdown(!showAddonsBreakdown)}
                className="inline-flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>{addOnsCount} extra{addOnsCount > 1 ? 's' : ''}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAddonsBreakdown ? "rotate-180" : "")} />
              </button>
            )}
          </div>

          <span className="font-extrabold text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
            {formattedTotal || 'Price on request'}
          </span>
        </div>

        {/* Expandable Add-ons Breakdown */}
        {showAddonsBreakdown && addOnsCount > 0 && (
          <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200/80 dark:border-zinc-800 text-xs space-y-1.5 animate-in fade-in duration-150">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
              Selected Add-ons
            </span>
            {selectedAddOns.map((addon) => (
              <div key={addon.id} className="flex items-center justify-between text-[11px] text-slate-700 dark:text-zinc-300 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>{addon.name}</span>
                  {addon.duration_minutes ? (
                    <span className="text-slate-400 dark:text-zinc-500 text-[10px]">
                      (+{addon.duration_minutes}m)
                    </span>
                  ) : null}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {addon.price !== null && addon.price !== undefined
                    ? addon.price > 0 ? `+$${addon.price.toFixed(2)}` : 'Free'
                    : 'Included'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Date & Time Window */}
      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
              Appointment Time
            </span>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {selectedDateFormatted || selectedDate}
            </p>
            {selectedSlot && (
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                <strong className="text-slate-800 dark:text-zinc-200">{selectedSlot.displayTime}</strong>
                {endTimeFormatted && <span> - {endTimeFormatted}</span>}
                <span className="text-slate-400 dark:text-zinc-500"> ({friendlyTz})</span>
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onChangeSlot}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 shrink-0 cursor-pointer"
          aria-label="Change appointment date and time"
        >
          Change
        </button>
      </div>
    </div>
  )
}
