'use client'

import { useMemo } from 'react'
import { Clock, Sun, Sunset, Moon, AlertCircle, CalendarDays, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimeInTz, getFriendlyTimezoneLabel } from '@/lib/temporal/timezone'

export interface SlotItem {
  startTime: string
  endTime: string
  displayTime: string
  date: string
  isAvailable?: boolean
  status?: 'available' | 'booked' | 'past'
}

export interface TimeSlotGridProps {
  availableSlots: SlotItem[]
  allSlots: SlotItem[]
  selectedSlot: SlotItem | null
  onSelectSlot: (slot: SlotItem) => void
  loading: boolean
  dayStatus: string
  selectedDate: string
  timezone: string
  appointmentDurationMinutes?: number
  onSelectNextAvailableDate?: () => void
  nextAvailableDateLabel?: string | null
  className?: string
}

export function TimeSlotGrid({
  availableSlots,
  allSlots,
  selectedSlot,
  onSelectSlot,
  loading,
  dayStatus,
  selectedDate,
  timezone,
  appointmentDurationMinutes = 60,
  onSelectNextAvailableDate,
  nextAvailableDateLabel,
  className
}: TimeSlotGridProps) {
  const friendlyTz = getFriendlyTimezoneLabel(timezone)
  const displaySlots = allSlots.length > 0 ? allSlots : availableSlots

  // Group slots by Morning (< 12:00 PM), Afternoon (12:00 PM - 5:00 PM), Evening (>= 5:00 PM) in the business timezone
  const groupedSlots = useMemo(() => {
    const morning: SlotItem[] = []
    const afternoon: SlotItem[] = []
    const evening: SlotItem[] = []

    displaySlots.forEach(slot => {
      try {
        const d = new Date(slot.startTime)
        const hourStr = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: false
        }).format(d)
        const hour = parseInt(hourStr, 10) % 24

        if (hour < 12) {
          morning.push(slot)
        } else if (hour < 17) {
          afternoon.push(slot)
        } else {
          evening.push(slot)
        }
      } catch {
        afternoon.push(slot)
      }
    })

    const groups: Array<{ id: string; label: string; icon: any; slots: SlotItem[] }> = []
    if (morning.length > 0) groups.push({ id: 'morning', label: 'Morning', icon: Sun, slots: morning })
    if (afternoon.length > 0) groups.push({ id: 'afternoon', label: 'Afternoon', icon: Sunset, slots: afternoon })
    if (evening.length > 0) groups.push({ id: 'evening', label: 'Evening', icon: Moon, slots: evening })

    return groups
  }, [displaySlots, timezone])

  return (
    <div className={cn("space-y-3", className)}>
      {/* Section Header with Live Slot Counts */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Available Appointment Times ({friendlyTz})</span>
        </label>

        {!loading && availableSlots.length > 0 && (
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
            {availableSlots.length} open {availableSlots.length === 1 ? 'slot' : 'slots'}
          </span>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-2 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800/60 animate-pulse border border-slate-200/60 dark:border-zinc-800"
              />
            ))}
          </div>
        </div>
      ) : dayStatus === 'fully_booked' || (allSlots.length > 0 && availableSlots.length === 0) ? (
        /* Fully Booked State */
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                This date is fully booked
              </h4>
              <p className="text-[11px] text-amber-900/90 dark:text-amber-300/80 leading-relaxed">
                All appointment slots for this date have already been reserved. Please pick another date to see open times.
              </p>
            </div>
          </div>

          {onSelectNextAvailableDate && nextAvailableDateLabel && (
            <button
              type="button"
              onClick={onSelectNextAvailableDate}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>View Next Available Date ({nextAvailableDateLabel})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Reserved Slots Inspection */}
          {allSlots.length > 0 && (
            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 tracking-wider">
                Reserved Times:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 opacity-80">
                {allSlots.map((slot) => (
                  <div
                    key={slot.startTime}
                    className="p-2 rounded-lg text-xs font-medium border border-amber-200 dark:border-amber-900/40 bg-white/60 dark:bg-zinc-900/60 text-slate-400 dark:text-zinc-500 flex items-center justify-between"
                  >
                    <span className="line-through">{slot.displayTime}</span>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Booked</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : dayStatus === 'closed' ? (
        /* Closed Day State */
        <div className="p-6 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
          <CalendarDays className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              Closed on this date
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              Our business is closed on this day according to regular operating hours. Please choose another date.
            </p>
          </div>
          {onSelectNextAvailableDate && nextAvailableDateLabel && (
            <button
              type="button"
              onClick={onSelectNextAvailableDate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>View Next Open Date ({nextAvailableDateLabel})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : dayStatus === 'past' ? (
        /* Past Date State */
        <div className="p-6 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
          <Clock className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              Operating hours have passed
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              Working hours for this date in {friendlyTz} have concluded. Please select tomorrow or an upcoming date.
            </p>
          </div>
          {onSelectNextAvailableDate && nextAvailableDateLabel && (
            <button
              type="button"
              onClick={onSelectNextAvailableDate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>View Next Available Date ({nextAvailableDateLabel})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : displaySlots.length === 0 ? (
        /* General Zero Slots State */
        <div className="p-6 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
          <CalendarDays className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              No available times for this date
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              All appointments are either booked, outside business hours, or within the required advance notice window.
            </p>
          </div>
          {onSelectNextAvailableDate && nextAvailableDateLabel && (
            <button
              type="button"
              onClick={onSelectNextAvailableDate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>View Next Open Date ({nextAvailableDateLabel})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        /* Grouped Slots View */
        <div className="space-y-4" role="radiogroup" aria-label="Available appointment times">
          {groupedSlots.map(({ id, label, icon: Icon, slots }) => (
            <div key={id} className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 px-0.5">
                <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                <span>{label}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime
                  const isBooked = !slot.isAvailable && slot.status === 'booked'
                  const isPast = !slot.isAvailable && slot.status === 'past'
                  const isAvailable = slot.isAvailable !== false && slot.status !== 'booked' && slot.status !== 'past'

                  // Compute clean end time in business timezone
                  const endTimeFormatted = formatTimeInTz(slot.endTime, timezone)

                  if (isBooked) {
                    return (
                      <div
                        key={slot.startTime}
                        className="p-3 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/40 text-slate-400 dark:text-zinc-600 flex items-center justify-between cursor-not-allowed select-none min-h-[56px]"
                        title="This appointment time is already booked"
                      >
                        <div>
                          <span className="text-xs font-bold line-through block">
                            {slot.displayTime}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-600">
                            Until {endTimeFormatted}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60">
                          Booked
                        </span>
                      </div>
                    )
                  }

                  if (isPast) {
                    return (
                      <div
                        key={slot.startTime}
                        className="p-3 rounded-2xl border border-slate-200/40 dark:border-zinc-900 bg-slate-50/20 dark:bg-zinc-950/20 text-slate-300 dark:text-zinc-700 flex items-center justify-between cursor-not-allowed select-none min-h-[56px]"
                        title="This appointment time has passed"
                      >
                        <span className="text-xs font-medium">{slot.displayTime}</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-600">Past</span>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onSelectSlot(slot)}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[56px] shadow-2xs select-none",
                        isSelected
                          ? "bg-blue-600 border-blue-500 text-white font-bold shadow-md shadow-blue-500/20 ring-2 ring-blue-500/20"
                          : "bg-white dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                      )}
                    >
                      <div>
                        <span className={cn(
                          "text-xs sm:text-sm font-bold block",
                          isSelected ? "text-white" : "text-slate-900 dark:text-white"
                        )}>
                          {slot.displayTime}
                        </span>
                        <span className={cn(
                          "text-[10px] block mt-0.5",
                          isSelected ? "text-blue-100" : "text-slate-400 dark:text-zinc-500"
                        )}>
                          Until {endTimeFormatted}
                        </span>
                      </div>

                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                          Open
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
