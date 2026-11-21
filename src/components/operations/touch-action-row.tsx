'use client'

import React from 'react'
import Link from 'next/link'
import { Phone, MessageSquare, Navigation, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TouchActionRowProps {
  phone?: string | null
  address?: string | null
  contactId?: string | null
  jobId?: string | null
  onDetailsClick?: () => void
  className?: string
  size?: 'default' | 'compact'
}

export function TouchActionRow({
  phone,
  address,
  contactId,
  jobId,
  onDetailsClick,
  className,
  size = 'default'
}: TouchActionRowProps) {
  const cleanPhone = (phone || '').replace(/\D/g, '')
  const hasPhone = cleanPhone.length >= 10
  const hasAddress = Boolean(address && address.trim())

  const mapsUrl = hasAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address!.trim())}`
    : ''

  const inboxHref = cleanPhone
    ? `/client/inbox?phone=${encodeURIComponent(cleanPhone)}${contactId ? `&contact_id=${encodeURIComponent(contactId)}` : ''}`
    : '/client/inbox'

  return (
    <div className={cn('flex items-center flex-wrap gap-2', className)}>
      {/* 1. Navigate */}
      {hasAddress && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Navigate to job address in Google Maps"
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors border shadow-2xs cursor-pointer select-none',
            size === 'default'
              ? 'min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60'
              : 'min-h-[38px] px-2.5 py-1 text-[11px] bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60'
          )}
        >
          <Navigation className="h-3.5 w-3.5 shrink-0" />
          <span>Directions</span>
        </a>
      )}

      {/* 2. Call */}
      {hasPhone && (
        <a
          href={`tel:${cleanPhone}`}
          aria-label="Call customer phone"
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors border shadow-2xs cursor-pointer select-none',
            size === 'default'
              ? 'min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60'
              : 'min-h-[38px] px-2.5 py-1 text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60'
          )}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span>Call</span>
        </a>
      )}

      {/* 3. Text Message */}
      {hasPhone && (
        <Link
          href={inboxHref}
          aria-label="Text customer in Inbox"
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors border shadow-2xs cursor-pointer select-none',
            size === 'default'
              ? 'min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
              : 'min-h-[38px] px-2.5 py-1 text-[11px] bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>SMS</span>
        </Link>
      )}

      {/* 4. Optional Details */}
      {onDetailsClick && (
        <button
          type="button"
          onClick={onDetailsClick}
          aria-label="View job or customer details"
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors border shadow-2xs cursor-pointer select-none text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:bg-slate-50',
            size === 'default'
              ? 'min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs'
              : 'min-h-[38px] px-2.5 py-1 text-[11px]'
          )}
        >
          <span>Details</span>
        </button>
      )}
    </div>
  )
}
