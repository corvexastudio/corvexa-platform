'use client'

import { Sparkles, Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ServiceAddOn } from '@/lib/services/service-pricing'

export interface AddOnSelectorProps {
  addOns: ServiceAddOn[]
  selectedAddOns: ServiceAddOn[]
  onToggleAddOn: (addon: ServiceAddOn) => void
  serviceName?: string
  className?: string
}

export function AddOnSelector({
  addOns,
  selectedAddOns,
  onToggleAddOn,
  serviceName,
  className
}: AddOnSelectorProps) {
  if (!addOns || addOns.length === 0) return null

  const selectedCount = selectedAddOns.length
  const totalExtrasCost = selectedAddOns.reduce((sum, a) => sum + (Number(a.price) || 0), 0)

  return (
    <section
      aria-label="Optional Service Add-ons"
      className={cn(
        "p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/90 dark:border-zinc-800 space-y-3.5 transition-all",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 fill-amber-500/20" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
              Customize Your Service
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Optional upgrades for {serviceName || 'this appointment'}
            </p>
          </div>
        </div>

        {selectedCount > 0 ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
            {selectedCount} selected {totalExtrasCost > 0 ? `(+$${totalExtrasCost.toFixed(2)})` : ''}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700 shrink-0">
            Optional
          </span>
        )}
      </div>

      {/* Grid of Add-On Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {addOns.map((addon) => {
          const isChecked = selectedAddOns.some(a => a.id === addon.id)
          const numPrice = Number(addon.price) || 0
          const hasDuration = addon.duration_minutes && addon.duration_minutes > 0

          return (
            <button
              key={addon.id}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => onToggleAddOn(addon)}
              className={cn(
                "flex items-start justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer min-h-[52px]",
                isChecked
                  ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-400 ring-1 ring-blue-500/20 shadow-xs"
                  : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-2xs"
              )}
            >
              {/* Left Column: Checkbox, Name, Duration, Description */}
              <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-2">
                <div className={cn(
                  "h-4 w-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                  isChecked
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                )}>
                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                </div>

                <div className="space-y-0.5 min-w-0">
                  <span className={cn(
                    "text-xs font-bold block truncate",
                    isChecked
                      ? "text-blue-950 dark:text-white"
                      : "text-slate-800 dark:text-zinc-200"
                  )}>
                    {addon.name}
                  </span>

                  {addon.description && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                      {addon.description}
                    </p>
                  )}

                  {hasDuration && (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      <span>+{addon.duration_minutes} mins</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Price Tag */}
              <span className={cn(
                "text-xs font-mono font-bold shrink-0 pt-0.5",
                numPrice > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-zinc-400"
              )}>
                {numPrice > 0 ? `+$${numPrice.toFixed(2)}` : 'Free'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
