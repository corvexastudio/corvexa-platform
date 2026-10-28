'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw, LayoutDashboard, Navigation, ChevronDown, ChevronUp, LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ClientErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  useEffect(() => {
    // Log exception for client-side monitoring
    console.error('[CaptoDesk Client Route Error]:', error)
  }, [error])

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-xl text-center space-y-6">
        
        {/* Status Badge & Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Dashboard View Temporarily Interrupted
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed max-w-md">
              Your front desk automations, phone line, and customer bookings are safe and continuing to run normally in the background.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto min-h-[44px] px-5 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reload View</span>
          </Button>

          <Link
            href="/client/dashboard"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/client/dashboard'
              }
            }}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-750 transition-colors shadow-2xs cursor-pointer"
          >
            <LayoutDashboard className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            <span>Today&apos;s Center</span>
          </Link>

          <Link
            href="/client/field"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-750 transition-colors shadow-2xs cursor-pointer"
          >
            <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Field Route</span>
          </Link>
        </div>

        {/* Expandable Technical Details */}
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 text-left">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 py-1 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>Technical Diagnostics</span>
            </span>
            {showTechnicalDetails ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showTechnicalDetails && (
            <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80 font-mono text-[11px] text-slate-600 dark:text-zinc-400 space-y-1.5 break-all">
              <div>
                <strong className="text-slate-900 dark:text-zinc-200">Message:</strong>{' '}
                {error?.message || 'Unknown render exception'}
              </div>
              {error?.digest && (
                <div>
                  <strong className="text-slate-900 dark:text-zinc-200">Digest ID:</strong>{' '}
                  {error.digest}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
