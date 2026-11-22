'use client'

import { useState, useMemo } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDayOfWeekName } from '@/lib/booking/availability'

export interface SelectableDateItem {
  dateStr: string
  dayOfWeek: string
  dayNum: string
  label: string
  isToday: boolean
}

export interface DateMetaInfo {
  dayStatus?: string // 'available' | 'fully_booked' | 'past' | 'closed' | 'blocked' | 'outside_window'
  slotsCount?: number
  bookedCount?: number
}

export interface DatePickerRailProps {
  dates: SelectableDateItem[]
  selectedDate: string
  onSelectDate: (dateStr: string) => void
  datesMeta: Record<string, DateMetaInfo>
  timezone: string
  businessHours?: Record<string, { closed?: boolean; open?: string; close?: string }>
  blockedDates?: string[]
  maxBookingDaysAhead?: number
  className?: string
}

export function DatePickerRail({
  dates,
  selectedDate,
  onSelectDate,
  datesMeta,
  timezone,
  businessHours = {},
  blockedDates = [],
  maxBookingDaysAhead = 30,
  className
}: DatePickerRailProps) {
  const [showCalendarModal, setShowCalendarModal] = useState(false)

  // Quick lookup to resolve base day status from config even before network fetch
  const getBaseStatus = (dateStr: string): 'closed' | 'blocked' | 'open' => {
    if (blockedDates.includes(dateStr)) return 'blocked'
    const dayName = getDayOfWeekName(dateStr, timezone)
    const schedule = businessHours[dayName]
    if (!schedule || schedule.closed || !schedule.open || !schedule.close) return 'closed'
    return 'open'
  }

  // Generate month days for the calendar grid view
  const monthCalendarData = useMemo(() => {
    if (dates.length === 0) return []
    const firstDateStr = dates[0].dateStr
    const [firstY, firstM] = firstDateStr.split('-').map(Number)

    // Collect all unique months in the selectable horizon
    const monthsMap = new Map<string, { year: number; month: number; title: string; days: Array<{ dateStr: string; dayNumber: number; inHorizon: boolean; isSelectable: boolean }> }>()

    dates.forEach(item => {
      const [y, m, d] = item.dateStr.split('-').map(Number)
      const key = `${y}-${String(m).padStart(2, '0')}`
      if (!monthsMap.has(key)) {
        const title = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 15)))
        monthsMap.set(key, { year: y, month: m, title, days: [] })
      }
    })

    // Build monthly grid with padding for leading empty days
    const result: Array<{ title: string; weeks: Array<Array<{ dateStr?: string; dayNum?: number; isSelectable?: boolean; isSelected?: boolean; baseStatus?: string; meta?: DateMetaInfo }>> }> = []

    monthsMap.forEach(({ year, month, title }) => {
      const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0))
      // Sunday is 0, Monday is 1, etc.
      const startDayOfWeek = firstDayOfMonth.getUTCDay()
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

      const weeks: Array<Array<{ dateStr?: string; dayNum?: number; isSelectable?: boolean; isSelected?: boolean; baseStatus?: string; meta?: DateMetaInfo }>> = []
      let currentWeek: Array<{ dateStr?: string; dayNum?: number; isSelectable?: boolean; isSelected?: boolean; baseStatus?: string; meta?: DateMetaInfo }> = []

      // Leading empty cells
      for (let i = 0; i < startDayOfWeek; i++) {
        currentWeek.push({})
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const inHorizon = dates.some(d => d.dateStr === dateStr)
        const baseStatus = getBaseStatus(dateStr)
        const isSelectable = inHorizon
        const isSelected = selectedDate === dateStr
        const meta = datesMeta[dateStr]

        currentWeek.push({
          dateStr,
          dayNum: day,
          isSelectable,
          isSelected,
          baseStatus,
          meta
        })

        if (currentWeek.length === 7) {
          weeks.push(currentWeek)
          currentWeek = []
        }
      }

      // Trailing empty cells
      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push({})
        }
        weeks.push(currentWeek)
      }

      result.push({ title, weeks })
    })

    return result
  }, [dates, selectedDate, datesMeta, timezone, businessHours, blockedDates])

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header Row: Label & Calendar Grid Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Choose Date</span>
        </label>

        <button
          type="button"
          onClick={() => setShowCalendarModal(true)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          aria-label="Open full month calendar picker"
        >
          <CalendarIcon className="h-3 w-3" />
          <span>View Full Calendar</span>
        </button>
      </div>

      {/* Horizontal Quick Date Rail */}
      <div
        role="tablist"
        aria-label="Available booking dates"
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1"
      >
        {dates.map((item) => {
          const isSelected = selectedDate === item.dateStr
          const meta = datesMeta[item.dateStr]
          const baseStatus = getBaseStatus(item.dateStr)

          // Determine day status badge
          let badgeText: string | null = null
          let badgeClass = ''

          if (baseStatus === 'blocked') {
            badgeText = 'Blocked'
            badgeClass = isSelected
              ? 'bg-slate-800 text-zinc-300'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
          } else if (baseStatus === 'closed') {
            badgeText = 'Closed'
            badgeClass = isSelected
              ? 'bg-slate-800 text-zinc-300'
              : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-500'
          } else if (meta?.dayStatus === 'fully_booked') {
            badgeText = 'Full'
            badgeClass = isSelected
              ? 'bg-rose-950/80 text-rose-200 border border-rose-500/30'
              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
          } else if (meta?.dayStatus === 'past') {
            badgeText = 'Past'
            badgeClass = isSelected
              ? 'bg-slate-800 text-zinc-300'
              : 'bg-slate-100 dark:bg-zinc-800/60 text-slate-400 dark:text-zinc-500'
          } else if (meta?.slotsCount !== undefined && meta.slotsCount > 0) {
            badgeText = `${meta.slotsCount} open`
            badgeClass = isSelected
              ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/30'
              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
          }

          return (
            <button
              key={item.dateStr}
              role="tab"
              type="button"
              aria-selected={isSelected}
              onClick={() => onSelectDate(item.dateStr)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[76px] py-2.5 px-2 rounded-2xl border transition-all shrink-0 cursor-pointer min-h-[74px] shadow-2xs select-none",
                isSelected
                  ? "bg-blue-600 border-blue-500 text-white font-bold shadow-md shadow-blue-600/20 ring-2 ring-blue-500/20"
                  : "bg-white dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100"
              )}
            >
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                isSelected ? "text-blue-100" : "text-slate-400 dark:text-zinc-500"
              )}>
                {item.dayOfWeek}
              </span>
              <span className={cn(
                "text-sm font-extrabold mt-0.5",
                isSelected ? "text-white" : "text-slate-900 dark:text-zinc-100"
              )}>
                {item.label}
              </span>

              {badgeText && (
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-md mt-1", badgeClass)}>
                  {badgeText}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Full Month Calendar Modal */}
      {showCalendarModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select date from calendar"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Select an Appointment Date
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 flex items-center justify-center cursor-pointer"
                aria-label="Close calendar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Calendar Months Display */}
            <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5">
              {monthCalendarData.map((monthGroup, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 px-1">
                    {monthGroup.title}
                  </h4>

                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider pb-1">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>

                  {/* Weeks & Days Grid */}
                  <div className="space-y-1">
                    {monthGroup.weeks.map((week, wIdx) => (
                      <div key={wIdx} className="grid grid-cols-7 gap-1">
                        {week.map((dayCell, cIdx) => {
                          if (!dayCell.dayNum) {
                            return <div key={cIdx} className="h-9 w-full" />
                          }

                          const isSelected = dayCell.isSelected
                          const isSelectable = dayCell.isSelectable
                          const isClosed = dayCell.baseStatus === 'closed'
                          const isBlocked = dayCell.baseStatus === 'blocked'

                          return (
                            <button
                              key={cIdx}
                              type="button"
                              disabled={!isSelectable}
                              onClick={() => {
                                if (dayCell.dateStr) {
                                  onSelectDate(dayCell.dateStr)
                                  setShowCalendarModal(false)
                                }
                              }}
                              className={cn(
                                "h-9 w-full rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer relative",
                                isSelected
                                  ? "bg-blue-600 text-white font-bold shadow-xs"
                                  : isSelectable
                                  ? "hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200"
                                  : "text-slate-300 dark:text-zinc-700 cursor-not-allowed opacity-40",
                                isClosed && !isSelected ? "text-slate-400 dark:text-zinc-600" : ""
                              )}
                            >
                              <span>{dayCell.dayNum}</span>
                              {isSelectable && !isSelected && (
                                <span className={cn(
                                  "w-1 h-1 rounded-full mt-0.5",
                                  isClosed || isBlocked
                                    ? "bg-slate-300 dark:bg-zinc-700"
                                    : "bg-emerald-500"
                                )} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
