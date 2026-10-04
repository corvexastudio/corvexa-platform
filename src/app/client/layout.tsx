'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Target, 
  Users, 
  Calendar, 
  FileText,
  Briefcase,
  CreditCard,
  Star,
  Zap, 
  Settings, 
  PhoneCall,
  LogOut,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

// The exact 11-module information architecture mandated for small-business owners
export const navItems = [
  { href: '/dashboard', clientHref: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', clientHref: '/client/inbox', label: 'Inbox', icon: MessageSquare, badgeKey: 'inbox' },
  { href: '/leads', clientHref: '/client/leads', label: 'Leads', icon: Target },
  { href: '/customers', clientHref: '/client/customers', label: 'Customers', icon: Users },
  { href: '/calendar', clientHref: '/client/calendar', label: 'Calendar', icon: Calendar },
  { href: '/quotes', clientHref: '/client/quotes', label: 'Quotes', icon: FileText },
  { href: '/jobs', clientHref: '/client/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/invoices', clientHref: '/client/invoices', label: 'Invoices', icon: CreditCard },
  { href: '/reviews', clientHref: '/client/reviews', label: 'Reviews', icon: Star },
  { href: '/automations', clientHref: '/client/automations', label: 'Automations', icon: Zap },
  { href: '/settings', clientHref: '/client/settings', label: 'Settings', icon: Settings },
]

function SidebarLink({ 
  href, 
  clientHref, 
  label, 
  icon: Icon,
  unreadCount,
  onClick
}: { 
  href: string
  clientHref: string
  label: string
  icon: any
  unreadCount?: number
  onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname === clientHref || 
    pathname.startsWith(href + '/') || pathname.startsWith(clientHref + '/')

  return (
    <Link
      href={clientHref}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all group',
        isActive 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('h-4 w-4 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-zinc-400')} />
        <span>{label}</span>
      </div>
      {typeof unreadCount === 'number' && unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [orgName, setOrgName] = useState<string>('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Auth pages render clean without dashboard shell
  const isAuthPage = pathname === '/login' || pathname === '/onboarding' ||
    pathname.startsWith('/client/login') || pathname.startsWith('/client/onboarding')

  useEffect(() => {
    if (isAuthPage) return

    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role, organizations(name, is_missed_call_active)')
        .eq('id', user.id)
        .single()

      if (profile && profile.org_id) {
        setIsSuperAdmin(profile.role === 'super_admin')
        const org: any = profile.organizations
        if (org) setOrgName(org.name)

        // Count unread conversations
        const { count } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.org_id)
          .gt('unread_count', 0)
        
        setUnreadTotal(count || 0)
      } else {
        router.push('/client/onboarding')
      }
    }

    loadProfile()
  }, [supabase, isAuthPage, router])

  if (isAuthPage) return <>{children}</>

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/client/login')
  }

  // Top mobile quick touch targets
  const mobileQuickItems = [
    { clientHref: '/client/dashboard', label: 'Home', icon: LayoutDashboard },
    { clientHref: '/client/inbox', label: 'Inbox', icon: MessageSquare, badge: unreadTotal },
    { clientHref: '/client/jobs', label: 'Jobs', icon: Briefcase },
    { clientHref: '/client/invoices', label: 'Invoices', icon: CreditCard },
  ]

  return (
    <div className="flex min-h-screen w-full bg-[#090D16] text-zinc-100 font-sans selection:bg-blue-500/30 selection:text-blue-200">

      {/* ── Desktop Fixed Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-800/80 bg-[#0B101B]/95 backdrop-blur-md sm:flex">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-800/80 px-5">
          <Link href="/client/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/20 transition-transform group-hover:scale-105">
              <PhoneCall className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-white">CaptoDesk</span>
                <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 border border-blue-500/20">Pro</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium truncate max-w-[140px]">
                {orgName || 'Digital Front Desk'}
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Menu (11 Clean Core Modules) */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Main Menu
          </div>
          <nav className="flex flex-col gap-0.5">
            {navItems.map(item => (
              <SidebarLink 
                key={item.clientHref} 
                {...item} 
                unreadCount={item.badgeKey === 'inbox' ? unreadTotal : undefined}
              />
            ))}
          </nav>

          {isSuperAdmin && (
            <div className="mt-5 border-t border-zinc-800/60 pt-4">
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-amber-500/80">
                Administration
              </div>
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                Super Admin Portal
              </Link>
            </div>
          )}
        </div>

        {/* Footer / User Sign Out */}
        <div className="border-t border-zinc-800/80 p-3 bg-zinc-950/40">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-zinc-400" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Container ── */}
      <div className="flex flex-col sm:pl-64 w-full min-h-screen">
        
        {/* Desktop Top Status Bar */}
        <header className="hidden sm:flex h-14 items-center justify-between border-b border-zinc-800/70 bg-[#0B101B]/80 backdrop-blur-md px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 text-xs text-zinc-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-300 font-medium">Front Desk Status:</span>
            <span className="text-emerald-400 font-semibold">Active & Answering Missed Calls</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/client/settings" 
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5"
            >
              <span>Call Forwarding Guide</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-8 pb-24 sm:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (< 640px) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t border-zinc-800/90 bg-[#0B101B]/95 backdrop-blur-lg sm:hidden px-2 shadow-2xl safe-area-bottom">
        {mobileQuickItems.map(item => {
          const isActive = pathname === item.clientHref || pathname.startsWith(item.clientHref + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.clientHref}
              href={item.clientHref}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-blue-500 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* 5th Mobile Tab: "More" Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors cursor-pointer',
            mobileMenuOpen ? 'text-blue-500 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* ── Mobile "More" Full Navigation Drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm sm:hidden flex flex-col justify-end">
          <div className="bg-[#0B101B] border-t border-zinc-800 rounded-t-3xl max-h-[85vh] flex flex-col p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-3">
              <div>
                <h3 className="text-base font-bold text-white">All Menu Items</h3>
                <p className="text-xs text-zinc-400">{orgName || 'CaptoDesk Digital Desk'}</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-2 space-y-1">
              {navItems.map(item => (
                <SidebarLink
                  key={item.clientHref}
                  {...item}
                  onClick={() => setMobileMenuOpen(false)}
                  unreadCount={item.badgeKey === 'inbox' ? unreadTotal : undefined}
                />
              ))}

              {isSuperAdmin && (
                <div className="pt-3 border-t border-zinc-800/60 mt-3">
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Super Admin Portal
                  </Link>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800/80 mt-2">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 py-2.5 text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out of CaptoDesk</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
