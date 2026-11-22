'use client'

import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimeInTz } from '@/lib/temporal/timezone'

export interface SelectedSlotSummary {
  startTime: string
  displayTime: string
  endTime?: string
}

export interface DateTimeBottomBarProps {
  selectedDate: string | null
  selectedDateFormatted?: string | null
  selectedSlot: SelectedSlotSummary | null
  formattedTotal?: string | null
  totalDurationMinutes: number
  timezone?: string
  onBack: () => void
  onContinue: () => void
  disabled?: boolean
  className?: string
}

export function DateTimeBottomBar({
  selectedDate,
  selectedDateFormatted,
  selectedSlot,
  formattedTotal,
  totalDurationMinutes,
  timezone,
  onBack,
  onContinue,
  disabled = false,
  className
}: DateTimeBottomBarProps) {
  const isSelected = !!selectedSlot && !!selectedDate

  return (
    <aside
      aria-label="Appointment time summary and step progression"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-zinc-800 p-3 sm:p-4 shadow-2xl transition-all",
        className
      )}
    >
      <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Service Selection"
          className="h-11 w-11 sm:w-auto sm:px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-750 flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm active:scale-[0.98]"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
          <span className="hidden sm:inline text-xs font-semibold">Services</span>
        </button>

        {/* Selected Slot Summary or Prompt */}
        <div className="min-w-0 flex-1 px-1">
          {isSelected ? (
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Selected Appointment
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {selectedDateFormatted || selectedDate} at {selectedSlot.displayTime}
              </p>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-0.5 font-medium text-slate-700 dark:text-zinc-300">
                  <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span>{totalDurationMinutes} mins</span>
                </span>
                {formattedTotal && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formattedTotal}
                    </span>
                  </>
                )}
                {selectedSlot.endTime && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline text-slate-500 dark:text-zinc-400">
                      Until {timezone ? formatTimeInTz(selectedSlot.endTime, timezone) : formatEndTime(selectedSlot.endTime)}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Step 2 of 3
              </span>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-medium truncate">
                {selectedDate ? 'Choose an appointment time' : 'Select a date and time'}
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Primary CTA */}
        <button
          type="button"
          onClick={onContinue}
          disabled={!isSelected || disabled}
          aria-label={isSelected ? 'Continue to Customer Details' : 'Select an appointment time to continue'}
          className={cn(
            "h-11 sm:h-12 px-4 sm:px-6 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md select-none",
            isSelected && !disabled
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-[0.98]"
              : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 shadow-none cursor-not-allowed opacity-75"
          )}
        >
          <span className="hidden sm:inline">Continue to Details</span>
          <span className="sm:hidden">Details</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}

function formatEndTime(isoUtcString: string): string {
  try {
    const d = new Date(isoUtcString)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}
