'use client'

import { Search, X, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CategoryRailProps {
  categories: { id: string; label: string; count: number }[]
  activeCategory: string
  onSelectCategory: (categoryId: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  totalServicesCount: number
  filteredServicesCount: number
  showSearch: boolean
  showCategories: boolean
  onResetFilters: () => void
  className?: string
}

export function CategoryRail({
  categories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  totalServicesCount,
  filteredServicesCount,
  showSearch,
  showCategories,
  onResetFilters,
  className
}: CategoryRailProps) {
  const isFiltered = searchQuery.trim().length > 0 || activeCategory !== 'all'
  const activeCategoryObj = categories.find(c => c.id === activeCategory)

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search Input Bar */}
      {showSearch && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search services (e.g. repair, maintenance, inspection)..."
            aria-label="Search services"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
              aria-label="Clear service search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Category Pills Rail */}
      {showCategories && categories.length > 1 && (
        <div
          role="tablist"
          aria-label="Service categories"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => onSelectCategory(cat.id)}
                className={cn(
                  "px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 min-h-[38px]",
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 shadow-2xs"
                )}
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                    isActive
                      ? "bg-blue-700/80 text-white"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                  )}
                >
                  {cat.count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filter / Match Count Subtitle */}
      {isFiltered && (
        <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-zinc-400">
          <span>
            Showing <strong>{filteredServicesCount}</strong> of {totalServicesCount} services
            {activeCategory !== 'all' && activeCategoryObj && (
              <span> in <em>{activeCategoryObj.label}</em></span>
            )}
          </span>
          <button
            type="button"
            onClick={onResetFilters}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  )
}
