'use client'

import React from 'react'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  tip?: string
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tip,
  className,
  compact = false
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-800/80 bg-zinc-950/40 text-center transition-all',
        compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12',
        className
      )}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 shadow-inner mb-4">
        <Icon className="h-7 w-7 text-zinc-300" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed mb-6">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          {actionLabel && onAction && (
            <Button
              onClick={onAction}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 cursor-pointer"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="h-10 px-4 rounded-xl border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}

      {tip && (
        <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-900/80 border border-zinc-800/90 px-3.5 py-1.5 text-[11px] text-zinc-400">
          <span className="font-bold text-zinc-300">Tip:</span>
          <span>{tip}</span>
        </div>
      )}
    </div>
  )
}
