'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  ChevronDown,
  Calendar,
  FileText,
  Briefcase,
  MessageSquare,
  Users,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function UniversalQuickCreate() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const quickActions = [
    {
      title: 'Schedule Appointment',
      subtitle: 'Book service slot on calendar',
      href: '/client/calendar',
      icon: Calendar,
      iconColor: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-400'
    },
    {
      title: 'Create Quote',
      subtitle: 'Send estimate or pricing proposal',
      href: '/client/quotes',
      icon: FileText,
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400'
    },
    {
      title: 'Create Job',
      subtitle: 'Track work order and dispatch',
      href: '/client/jobs',
      icon: Briefcase,
      iconColor: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-400'
    },
    {
      title: 'Send Message',
      subtitle: 'Start 2-way SMS with customer',
      href: '/client/inbox',
      icon: MessageSquare,
      iconColor: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-900/60 dark:text-purple-400'
    },
    {
      title: 'Add Customer',
      subtitle: 'Save new client profile',
      href: '/client/customers',
      icon: Users,
      iconColor: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
    }
  ]

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        aria-label="Create new item"
        aria-expanded={isOpen}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>New</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-1.5 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Quick Actions
          </div>
          <div className="py-1 space-y-0.5">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors group"
                >
                  <div className={cn("h-7 w-7 rounded-lg border flex items-center justify-center shrink-0", action.iconColor)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {action.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {action.subtitle}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
