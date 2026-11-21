'use client'

import React, { useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateToIsoYmdInTz, getLocalDayUtcBoundaries, DEFAULT_US_TIMEZONE } from '@/lib/temporal/timezone'

export interface DateStripSelectorProps {
  selectedDate: string // YYYY-MM-DD
  onSelectDate: (dateYmd: string) => void
  timezone?: string
  daysCount?: number
  jobCountsByDate?: Record<string, number>
  className?: string
}

export function DateStripSelector({
  selectedDate,
  onSelectDate,
  timezone = DEFAULT_US_TIMEZONE,
  daysCount = 7,
  jobCountsByDate = {},
  className
}: DateStripSelectorProps) {
  const todayYmd = useMemo(() => {
    return formatDateToIsoYmdInTz(new Date(), timezone)
  }, [timezone])

  // Generate date window around selectedDate or today
  const dates = useMemo(() => {
    const list: Array<{ ymd: string; dayName: string; dayNum: string; isToday: boolean }> = []
    const centerDate = new Date(`${selectedDate}T12:00:00Z`)
    const half = Math.floor(daysCount / 2)

    for (let i = -half; i <= half; i++) {
      const d = new Date(centerDate.getTime() + i * 24 * 60 * 60 * 1000)
      const ymd = formatDateToIsoYmdInTz(d, timezone)
      const dayName = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(d)
      const dayNum = new Intl.DateTimeFormat('en-US', { timeZone: timezone, day: 'numeric' }).format(d)
      list.push({
        ymd,
        dayName,
        dayNum,
        isToday: ymd === todayYmd
      })
    }
    return list
  }, [selectedDate, timezone, daysCount, todayYmd])

  const handlePrevDay = () => {
    const current = new Date(`${selectedDate}T12:00:00Z`)
    current.setDate(current.getDate() - 1)
    onSelectDate(formatDateToIsoYmdInTz(current, timezone))
  }

  const handleNextDay = () => {
    const current = new Date(`${selectedDate}T12:00:00Z`)
    current.setDate(current.getDate() + 1)
    onSelectDate(formatDateToIsoYmdInTz(current, timezone))
  }

  const handleGoToday = () => {
    onSelectDate(todayYmd)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Header controls: Prev, Today button, Next */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevDay}
            aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-2xs transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleGoToday}
            aria-label="Jump to today"
            className={cn(
              'px-3 h-9 rounded-xl border text-xs font-bold transition-colors shadow-2xs cursor-pointer select-none',
              selectedDate === todayYmd
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
            )}
          >
            Today
          </button>

          <button
            type="button"
            onClick={handleNextDay}
            aria-label="Next day"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-2xs transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 font-mono">
          <CalendarIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>
            {new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            }).format(new Date(`${selectedDate}T12:00:00Z`))}
          </span>
        </div>
      </div>

      {/* 7-Day Horizontal Strip */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {dates.map(d => {
          const isSelected = d.ymd === selectedDate
          const count = jobCountsByDate[d.ymd] || 0

          return (
            <button
              key={d.ymd}
              type="button"
              onClick={() => onSelectDate(d.ymd)}
              aria-label={`Select ${d.dayName} ${d.dayNum}`}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-2xl border transition-all duration-150 min-h-[56px] cursor-pointer select-none relative',
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-bold ring-2 ring-blue-600/30'
                  : d.isToday
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
              )}
            >
              <span className={cn('text-[10px] uppercase font-bold tracking-wider opacity-80', isSelected && 'opacity-95')}>
                {d.dayName}
              </span>
              <span className={cn('text-sm sm:text-base font-extrabold mt-0.5', isSelected && 'text-white')}>
                {d.dayNum}
              </span>

              {/* Job indicator dot */}
              {count > 0 && (
                <span
                  className={cn(
                    'mt-1 h-1.5 w-1.5 rounded-full',
                    isSelected ? 'bg-white' : 'bg-blue-600 dark:bg-blue-400'
                  )}
                  title={`${count} job${count === 1 ? '' : 's'}`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
