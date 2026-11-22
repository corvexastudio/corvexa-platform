'use client'

import { useState, useEffect } from 'react'
import { MapPin, Globe } from 'lucide-react'
import {
  getFriendlyTimezoneLabel,
  isDifferentFromDeviceTimezone,
  getDeviceTimezone
} from '@/lib/temporal/timezone'
import { cn } from '@/lib/utils'

export interface TimezoneBannerProps {
  timezone: string
  className?: string
}

export function TimezoneBanner({ timezone, className }: TimezoneBannerProps) {
  const [isDifferent, setIsDifferent] = useState(false)
  const [deviceTzName, setDeviceTzName] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const diff = isDifferentFromDeviceTimezone(timezone)
    setIsDifferent(diff)
    if (diff) {
      setDeviceTzName(getFriendlyTimezoneLabel(getDeviceTimezone()))
    }
  }, [timezone])

  if (!isDifferent) return null

  const businessTzFriendly = getFriendlyTimezoneLabel(timezone)

  return (
    <div
      role="note"
      aria-label="Timezone notice"
      className={cn(
        "rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200",
        className
      )}
    >
      <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <div className="space-y-0.5 min-w-0 flex-1 leading-relaxed">
        <p className="font-bold text-blue-950 dark:text-blue-100 text-[11px] uppercase tracking-wider">
          Service Location Timezone
        </p>
        <p className="text-[11px] text-blue-900/90 dark:text-blue-200/90">
          All appointment slots are shown in <strong>{businessTzFriendly}</strong> to match the service property address. Your device is currently in {deviceTzName}.
        </p>
      </div>
    </div>
  )
}
