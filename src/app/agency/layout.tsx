'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Building2, 
  BarChart3, 
  Code2, 
  CreditCard, 
  Layers, 
  ExternalLink,
  ChevronRight,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgencyPortfolioOverview, getAgencyTierConfig } from '@/lib/agency/agency-types'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandIcon, BrandWordmark } from '@/components/brand/brand-logo'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const BASE_NAV_ITEMS = [
  { path: '/dashboard', label: 'Clients & Slots', icon: Layers, exact: true },
  { path: '/attribution', label: 'Lead Attribution', icon: BarChart3 },
  { path: '/embeds', label: 'Client Embeds', icon: Code2 },
  { path: '/billing', label: 'Capacity & Billing', icon: CreditCard },
]

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const cleanPathname = pathname.replace(/^\/agency/, '') || '/'
  const isLoginPage = cleanPathname === '/login' || cleanPathname.startsWith('/login')
  const isSubdomain = typeof window !== 'undefined' ? window.location.hostname.startsWith('agency.') : !pathname.startsWith('/agency')
  const prefix = isSubdomain ? '' : '/agency'

  const navItems = BASE_NAV_ITEMS.map(item => ({
    ...item,
    href: `${prefix}${item.path}`
  }))

  const [overview, setOverview] = useState<AgencyPortfolioOverview | null>(null)
  const [loading, setLoading] = useState(true)

  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('[SIGN OUT] Error:', err)
    } finally {
      window.location.href = isSubdomain ? '/login' : '/agency/login'
    }
  }

  useEffect(() => {
    // Skip overview fetch entirely when on the login screen
    if (isLoginPage) {
      setLoading(false)
      return
    }

    async function loadAgencyOverview() {
      try {
        const res = await fetch('/api/agency/overview')
        if (res.ok) {
          const data = await res.json()
          setOverview(data)
        }
      } catch (err) {
        console.warn('[AGENCY LAYOUT] Failed to fetch overview:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAgencyOverview()
  }, [isLoginPage])

  // If on login route, render standalone without authenticated dashboard chrome
  if (isLoginPage) {
    return <>{children}</>
  }

  const hasActiveSubscription = overview?.agency?.subscription_status === 'active' && Boolean(overview?.agency?.subscription_tier) && overview?.agency?.subscription_tier !== 'none'
  const totalSlots = overview?.total_slots ?? 0
  const usedSlots = overview?.used_slots ?? 0
  const availableSlots = overview?.available_slots ?? 0
  const occupancyRate = overview?.occupancy_rate ?? 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200 transition-colors">
      
      {/* Topmost Partner Console Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            
            {/* Left Brand & Agency Selector */}
            <div className="flex items-center gap-3">
              <Link 
                href={isSubdomain ? '/dashboard' : '/agency/dashboard'} 
                className="flex items-center gap-2.5 group hover:opacity-95 transition-opacity"
              >
                <BrandIcon className="h-8 w-8 group-hover:scale-105 transition-transform shrink-0" size={32} priority />
                <div className="flex items-center gap-2 leading-none">
                  <BrandWordmark size="text-lg" theme="auto" />
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                    Agency
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center text-slate-400 dark:text-zinc-600 mx-1">
                <ChevronRight className="h-4 w-4" />
              </div>

              {/* Active Agency Identity Pill */}
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-700 dark:text-zinc-300">
                <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {overview?.agency?.name || 'Agency Partner'}
                </span>
                {hasActiveSubscription ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                    {getAgencyTierConfig(overview?.agency?.subscription_tier).name}
                  </span>
                ) : (
                  <Link
                    href={isSubdomain ? '/billing' : '/agency/billing'}
                    className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                  >
                    Select Plan
                  </Link>
                )}
              </div>
            </div>

            {/* Center / Right: High-Density Slot Capacity Bar + ThemeToggle + Sign Out */}
            <div className="flex items-center gap-3">
              
              {/* Capacity Progress Pill */}
              <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-850/80 border border-slate-200 dark:border-zinc-750">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] gap-4">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">Slot Capacity</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {hasActiveSubscription ? (
                        `${usedSlots} / ${totalSlots}`
                      ) : (
                        <span className="text-slate-500 font-normal">No plan</span>
                      )}
                    </span>
                  </div>
                  {/* Visual Segmented Progress Bar */}
                  <div className="w-32 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500 rounded-full" 
                      style={{ width: `${Math.min(100, occupancyRate)}%` }}
                    />
                  </div>
                </div>

                {!hasActiveSubscription && (
                  <div className="border-l border-slate-200 dark:border-zinc-700 pl-2.5">
                    <Link 
                      href={isSubdomain ? '/billing' : '/agency/billing'} 
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Select Plan
                    </Link>
                  </div>
                )}
              </div>

              {/* External Contractor App Link */}
              <a
                href={isSubdomain ? "https://captodesk.com/client/dashboard" : "/client/dashboard"}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 transition-colors cursor-pointer"
                title="Open Contractor App"
              >
                <span>Contractor View</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </a>

              {/* Theme Toggle (Light / Dark Switcher) */}
              <ThemeToggle className="h-8 w-8" />

              {/* Sign Out Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="h-8 px-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 gap-1.5 cursor-pointer"
                title="Sign out of Partner Network"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>

          </div>

          {/* Subnavigation Bar */}
          <nav className="flex space-x-1 border-t border-slate-100 dark:border-zinc-800 pt-1 pb-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const isActive = item.exact 
                ? cleanPathname === item.path 
                : cleanPathname.startsWith(item.path)

              const Icon = item.icon

              return (
                <Link
                  key={item.path}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
                    isActive
                      ? "bg-slate-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 shadow-2xs border border-slate-200 dark:border-zinc-700"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100/60 dark:hover:bg-zinc-850/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500")} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Agency Workspace Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Clean Enterprise Partner Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-4 text-xs text-slate-500 dark:text-zinc-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-600 dark:text-zinc-400">© 2026 CaptoDesk Agency Partner Network</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400">
            <Link href="/privacy" className="hover:text-slate-800 dark:hover:text-zinc-200">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-800 dark:hover:text-zinc-200">Terms of Service</Link>
            <a href="mailto:partners@captodesk.com" className="hover:text-slate-800 dark:hover:text-zinc-200">Partner Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
