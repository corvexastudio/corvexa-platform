'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface MobileCardMetric {
  label: string
  value: React.ReactNode
}

export interface MobileCardProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  icon?: React.ReactNode
  metrics?: MobileCardMetric[]
  actions?: React.ReactNode
  onClick?: () => void
  className?: string
  children?: React.ReactNode
}

/**
 * Reusable MobileCard primitive.
 * Standardizes mobile record representation across customer profiles,
 * invoices, jobs, quotes, and team members.
 */
export function MobileCard({
  title,
  subtitle,
  badge,
  icon,
  metrics = [],
  actions,
  onClick,
  className,
  children
}: MobileCardProps) {
  const isClickable = !!onClick

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-2xl bg-[#0D1322] border border-zinc-800/80 p-4 space-y-3 transition-all',
        isClickable && 'hover:border-zinc-700/80 hover:bg-[#111827] cursor-pointer active:scale-[0.99]',
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="h-10 w-10 rounded-xl bg-zinc-800/80 border border-zinc-750 flex items-center justify-center shrink-0 text-zinc-300">
              {icon}
            </div>
          )}
          <div className="min-w-0 space-y-0.5">
            <div className="font-semibold text-sm text-white truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-zinc-400 truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Custom Body Children */}
      {children}

      {/* Metrics Grid */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60 text-xs">
          {metrics.map((m, idx) => (
            <div key={idx} className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                {m.label}
              </span>
              <div className="font-medium text-zinc-200 truncate">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions Row */}
      {actions && (
        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
