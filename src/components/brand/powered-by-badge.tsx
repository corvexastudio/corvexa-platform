'use client'

import React from 'react'
import { BrandIcon, BrandWordmark } from '@/components/brand/brand-logo'

export interface PoweredByBadgeProps {
  className?: string
  source?: 'booking' | 'tracking' | 'invoice' | 'quote' | 'manage' | string
  compact?: boolean
}

/**
 * Universal Clickable "Powered by CaptoDesk" Badge with Official Logo Mark.
 * Placed in public-facing portals (Booking, Tracking, Invoicing, Quotes) to drive viral referrals.
 */
export function PoweredByBadge({
  className = '',
  source = 'public_portal',
  compact = false
}: PoweredByBadgeProps) {
  const utmUrl = `https://captodesk.com?utm_source=powered_by&utm_medium=badge&utm_campaign=client_portal&utm_content=${encodeURIComponent(source)}`

  return (
    <div className={`flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 select-none ${className}`}>
      {!compact && (
        <span className="text-[11px] font-medium tracking-normal text-slate-400 dark:text-zinc-500">
          Powered by
        </span>
      )}
      <a
        href={utmUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="CaptoDesk - Trade Operations &amp; Customer Automation"
        className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group cursor-pointer"
      >
        <BrandIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform shrink-0" size={16} />
        <BrandWordmark size="text-xs" theme="auto" />
      </a>
    </div>
  )
}
