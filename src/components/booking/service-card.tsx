'use client'

import { useState } from 'react'
import { Clock, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseServicePricing, type ServiceAddOn, type PricingModel } from '@/lib/services/service-pricing'

export interface ServiceCardItem {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price?: number | null
  requires_address?: boolean
  add_ons?: ServiceAddOn[]
  formatted_price?: string
  clean_description?: string
  pricing_model?: string
}

export interface ServiceCardProps {
  service: ServiceCardItem
  isSelected: boolean
  onSelect: (service: ServiceCardItem) => void
  isPopular?: boolean
  categoryLabel?: string
  showCategoryBadge?: boolean
  cleanDesc?: string
  className?: string
}

export function ServiceCard({
  service,
  isSelected,
  onSelect,
  isPopular = false,
  categoryLabel,
  showCategoryBadge = false,
  cleanDesc,
  className
}: ServiceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Use parsed pricing information
  const pricing = parseServicePricing(service.price, service.description)
  const effectiveModel: PricingModel = (service.pricing_model as PricingModel) || pricing.model
  const displayDescription = cleanDesc !== undefined ? cleanDesc : pricing.cleanDescription

  // Pricing Model Subtext / Notes
  const getModelHelpText = (model: PricingModel): string | null => {
    switch (model) {
      case 'diagnostic_fee':
        return 'Covers on-site diagnosis and troubleshooting. Estimate provided for repairs.'
      case 'quote_on_site':
        return 'Technician assesses project on site and provides an estimate before work begins.'
      case 'free_estimate':
        return 'Complimentary estimate with zero upfront cost and no obligation.'
      case 'starting_at':
        return 'Base rate. Final total depends on project scope and parts required.'
      case 'fixed':
      default:
        return null
    }
  }

  const modelHelpText = getModelHelpText(effectiveModel)
  const hasAddOns = service.add_ons && service.add_ons.length > 0
  const isDescriptionLong = displayDescription.length > 120

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onSelect(service)
    }
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(service)}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative group",
        isSelected
          ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20 shadow-sm"
          : "bg-white dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 shadow-2xs",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Content Column */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Header row: Badges and Title */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {isPopular && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60 shrink-0">
                  <Sparkles className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                  <span>Popular</span>
                </span>
              )}

              {showCategoryBadge && categoryLabel && (
                <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md shrink-0">
                  {categoryLabel}
                </span>
              )}
            </div>

            <h3 className={cn(
              "font-bold text-sm sm:text-base leading-snug transition-colors",
              isSelected
                ? "text-blue-950 dark:text-white"
                : "text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
            )}>
              {service.name}
            </h3>
          </div>

          {/* Clean Description with Optional Read More */}
          {displayDescription ? (
            <div className="space-y-1">
              <p className={cn(
                "text-xs text-slate-600 dark:text-zinc-400 leading-relaxed",
                !isExpanded && isDescriptionLong ? "line-clamp-2" : ""
              )}>
                {displayDescription}
              </p>
              {isDescriptionLong && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(!isExpanded)
                  }}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{isExpanded ? 'Show less' : 'Read more'}</span>
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
          ) : null}

          {/* Duration & Model-Aware Pricing Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* Duration Badge */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800/80">
              <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{service.duration_minutes} mins</span>
            </span>

            {/* Price Badge by Model */}
            {effectiveModel === 'free_estimate' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                Free Estimate
              </span>
            )}

            {effectiveModel === 'quote_on_site' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                Quote on Site
              </span>
            )}

            {effectiveModel === 'diagnostic_fee' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                {pricing.formattedPrice}
              </span>
            )}

            {effectiveModel === 'starting_at' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                {pricing.formattedPrice}
              </span>
            )}

            {effectiveModel === 'fixed' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                {pricing.formattedPrice}
              </span>
            )}
          </div>

          {/* Model Explanatory Note */}
          {modelHelpText && (
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic leading-snug">
              {modelHelpText}
            </p>
          )}

          {/* Add-ons Availability Callout */}
          {hasAddOns && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 pt-1">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>
                {service.add_ons!.length} optional {service.add_ons!.length === 1 ? 'upgrade' : 'upgrades'} available
              </span>
            </div>
          )}
        </div>

        {/* Radio Selection Indicator */}
        <div className={cn(
          "h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all",
          isSelected
            ? "border-blue-600 bg-blue-600 text-white shadow-xs"
            : "border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 group-hover:border-slate-400"
        )}>
          {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
        </div>
      </div>
    </div>
  )
}
