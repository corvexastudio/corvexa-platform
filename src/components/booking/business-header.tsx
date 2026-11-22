'use client'

import { Phone, CalendarDays, Zap, Clock } from 'lucide-react'
import { ContractorBrandAvatar } from '@/components/brand/contractor-brand-avatar'
import { cn } from '@/lib/utils'

export interface BusinessHeaderProps {
  org: {
    name: string
    industry?: string | null
    logo_url?: string | null
    phone?: string | null
    booking_mode?: 'instant' | 'request'
  }
  servicesCount?: number
  className?: string
}

export function BusinessHeader({
  org,
  servicesCount,
  className
}: BusinessHeaderProps) {
  const isInstant = org.booking_mode === 'instant'

  // Format industry label cleanly (e.g. "plumbing" -> "Plumbing")
  const industryLabel = org.industry
    ? org.industry.charAt(0).toUpperCase() + org.industry.slice(1).replace(/_/g, ' ')
    : null

  return (
    <header className={cn("text-center space-y-3 pb-2 flex flex-col items-center", className)}>
      <ContractorBrandAvatar
        logoUrl={org.logo_url}
        name={org.name}
        industry={org.industry}
        size="lg"
        className="shadow-sm ring-2 ring-white dark:ring-zinc-900"
      />

      {/* Badges Row */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Online Booking</span>
        </div>

        {industryLabel && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium">
            {industryLabel}
          </span>
        )}

        <div className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
          isInstant
            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
        )}>
          {isInstant ? (
            <>
              <Zap className="h-3 w-3 fill-emerald-500 text-emerald-500" />
              <span>Instant Confirmation</span>
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              <span>Booking Request</span>
            </>
          )}
        </div>
      </div>

      {/* Business Name */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {org.name}
        </h1>

        {/* Direct Contact Phone Link */}
        {org.phone && (
          <div className="pt-0.5">
            <a
              href={`tel:${org.phone}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
              aria-label={`Call ${org.name} at ${org.phone}`}
            >
              <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{org.phone}</span>
            </a>
          </div>
        )}
      </div>

      {/* Subtext */}
      <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md">
        {isInstant
          ? 'Select a service and preferred arrival time to book online.'
          : 'Submit your service details and schedule request for fast confirmation.'}
      </p>
    </header>
  )
}
