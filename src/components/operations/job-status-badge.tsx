'use client'

import React from 'react'
import {
  Clock,
  CheckCircle2,
  Truck,
  Play,
  Check,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type JobStatusType =
  | 'scheduled'
  | 'confirmed'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'requested'
  | string

export interface JobStatusBadgeProps {
  status: JobStatusType
  className?: string
  size?: 'sm' | 'md'
}

export function JobStatusBadge({ status, className, size = 'sm' }: JobStatusBadgeProps) {
  const norm = (status || '').toLowerCase()

  switch (norm) {
    case 'completed':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <CheckCircle2 className={cn('shrink-0 text-emerald-600 dark:text-emerald-400', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>Completed</span>
        </span>
      )

    case 'in_progress':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-2xs',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <Play className={cn('shrink-0 text-blue-600 dark:text-blue-400 fill-current', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          <span>In Progress</span>
        </span>
      )

    case 'en_route':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs animate-pulse',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <Truck className={cn('shrink-0 text-amber-600 dark:text-amber-400', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>En Route</span>
        </span>
      )

    case 'confirmed':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <Check className={cn('shrink-0 text-indigo-600 dark:text-indigo-400', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>Confirmed</span>
        </span>
      )

    case 'cancelled':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 shadow-2xs',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <XCircle className={cn('shrink-0 text-rose-600 dark:text-rose-400', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>Cancelled</span>
        </span>
      )

    case 'no_show':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 shadow-2xs',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <AlertCircle className={cn('shrink-0 text-slate-600 dark:text-zinc-400', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>No Show</span>
        </span>
      )

    case 'requested':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 shadow-2xs',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <Clock className={cn('shrink-0 text-amber-600 dark:text-amber-400', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>Needs Confirmation</span>
        </span>
      )

    default: // scheduled
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-zinc-800/80 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60 shadow-2xs',
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          <Clock className={cn('shrink-0 text-slate-500 dark:text-zinc-400', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>Scheduled</span>
        </span>
      )
  }
}
