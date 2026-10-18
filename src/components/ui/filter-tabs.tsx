'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

export interface FilterTabItem<T extends string = string> {
  id: T
  label: React.ReactNode
  count?: number
  icon?: React.ComponentType<{ className?: string }>
}

export interface FilterTabsProps<T extends string = string> {
  tabs: FilterTabItem<T>[]
  activeTab: T
  onChange: (tabId: T) => void
  className?: string
  size?: 'sm' | 'default' | 'touch'
  ariaLabel?: string
}

export function FilterTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
  size = 'default',
  ariaLabel = 'Filter options'
}: FilterTabsProps<T>) {
  const tablistRef = React.useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = tabs.length - 1
    }

    if (nextIndex !== null) {
      const nextTab = tabs[nextIndex]
      onChange(nextTab.id)
      const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      buttons?.[nextIndex]?.focus()
    }
  }

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-lg bg-muted/70 p-1 border border-border/60 shadow-2xs",
        className
      )}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-all cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === 'sm' && "px-2.5 py-1 text-xs",
              size === 'default' && "px-3 py-1.5 text-xs sm:text-sm",
              size === 'touch' && "px-4 py-2 text-sm min-h-[44px]",
              isActive
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            {Icon && <Icon className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  "ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted-foreground/15 text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
