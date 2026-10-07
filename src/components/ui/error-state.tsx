'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  compact?: boolean
}

/**
 * Standardized error state primitive.
 * Replaces hardcoded red error divs across data-driven client pages.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  className,
  compact = false
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-red-500/20 bg-red-500/10 text-center flex flex-col items-center justify-center transition-all',
        compact ? 'p-4 gap-2' : 'p-6 sm:p-8 gap-3',
        className
      )}
    >
      <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
        <AlertCircle className="h-5 w-5" />
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className="text-sm font-bold text-red-300 tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-red-400/90 leading-relaxed">
          {message}
        </p>
      </div>

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size={compact ? 'xs' : 'sm'}
          className="mt-1 border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          <span>{retryLabel}</span>
        </Button>
      )}
    </div>
  )
}
