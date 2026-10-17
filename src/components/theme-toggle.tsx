'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Laptop } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Compact icon button toggle for headers and navigation bars.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn("h-8 w-8 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent animate-pulse", className)} />
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer",
        className
      )}
      title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      aria-label="Toggle display theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 transition-transform rotate-0 scale-100" />
      )}
    </button>
  )
}

/**
 * Full card selector for Settings page allowing selection between Light, Dark, and System.
 */
export function ThemeSettingsSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const options = [
    {
      id: 'light',
      label: 'Light Theme',
      tag: 'Default',
      description: 'Crisp, high-contrast clean interface optimized for daylight, work trucks, and office desks.',
      icon: Sun,
      previewBg: 'bg-slate-50 border-slate-200',
      previewCard: 'bg-white border-slate-200 text-slate-900'
    },
    {
      id: 'dark',
      label: 'Dark Theme',
      tag: 'Night mode',
      description: 'Sleek, low-light theme designed for evening hours, battery saving, and reduced glare.',
      icon: Moon,
      previewBg: 'bg-zinc-950 border-zinc-800',
      previewCard: 'bg-zinc-900 border-zinc-800 text-zinc-100'
    },
    {
      id: 'system',
      label: 'System Preference',
      tag: 'Auto sync',
      description: 'Automatically switches theme according to your operating system or browser settings.',
      icon: Laptop,
      previewBg: 'bg-gradient-to-r from-slate-100 to-zinc-900 border-slate-300 dark:border-zinc-700',
      previewCard: 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs text-slate-900 dark:text-zinc-100'
    }
  ]

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {options.map((opt) => {
        const isSelected = theme === opt.id
        const Icon = opt.icon

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            className={cn(
              "group relative flex flex-col items-start p-4 rounded-xl border text-left transition-all cursor-pointer",
              isSelected
                ? "border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20"
                : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/50 dark:hover:bg-zinc-850"
            )}
          >
            {/* Visual Header */}
            <div className="flex w-full items-center justify-between mb-3">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-200"
              )}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                  isSelected
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                )}>
                  {opt.tag}
                </span>

                <div className={cn(
                  "h-4 w-4 rounded-full border flex items-center justify-center transition-colors",
                  isSelected
                    ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500"
                    : "border-slate-300 dark:border-zinc-700 bg-transparent"
                )}>
                  {isSelected && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </div>

            {/* Label & Description */}
            <h4 className={cn(
              "text-sm font-semibold mb-1 transition-colors",
              isSelected
                ? "text-blue-950 dark:text-blue-100"
                : "text-slate-900 dark:text-zinc-100"
            )}>
              {opt.label}
            </h4>

            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              {opt.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
