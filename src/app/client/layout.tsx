'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Target, 
  Calendar, 
  Briefcase,
  FileText,
  CreditCard,
  Star,
  Users, 
  Zap, 
  Settings, 
  PhoneCall,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// Workflow-centric information architecture for field service businesses
export const navSections = [
  {
    title: 'Daily Work',
    items: [
      { href: '/client/dashboard', label: 'Today', icon: LayoutDashboard },
      { href: '/client/inbox', label: 'Inbox', icon: MessageSquare, badgeKey: 'inbox' },
      { href: '/client/leads', label: 'Leads', icon: Target },
      { href: '/client/calendar', label: 'Calendar', icon: Calendar },
      { href: '/client/jobs', label: 'Jobs', icon: Briefcase },
    ]
  },
  {
    title: 'Finances & Reviews',
    items: [
      { href: '/client/quotes', label: 'Quotes', icon: FileText },
      { href: '/client/invoices', label: 'Invoices', icon: CreditCard },
      { href: '/client/reviews', label: 'Reviews', icon: Star },
    ]
  },
  {
    title: 'Management',
    items: [
      { href: '/client/customers', label: 'Customers', icon: Users },
      { href: '/client/automations', label: 'Automations', icon: Zap },
      { href: '/client/settings', label: 'Settings', icon: Settings },
    ]
  }
]

// Flattened list for lookup
export const navItems = navSections.flatMap(s => s.items)

function NavLinkItem({
  href,
  label,
  icon: Icon,
  unreadCount,
  onClick
}: {
  href: string
  label: string
  icon: any
  unreadCount?: number
  onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/client/dashboard' && pathname.startsWith(href + '/'))

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        isActive
          ? 'bg-zinc-800 text-zinc-100 font-semibold'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-300')} />
        <span>{label}</span>
      </div>
      {typeof unreadCount === 'number' && unreadCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white tabular-nums">
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
  const [orgPhone, setOrgPhone] = useState<string>('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Auth pages render without shell
  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/onboarding' ||
    pathname.startsWith('/client/login') || 
    pathname.startsWith('/client/onboarding')

  useEffect(() => {
    if (isAuthPage) return

    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role, organizations(name, telnyx_phone_number)')
        .eq('id', user.id)
        .single()

      if (profile && profile.org_id) {
        setIsSuperAdmin(profile.role === 'super_admin')
        const org: any = profile.organizations
        if (org) {
          setOrgName(org.name || 'My Business')
          setOrgPhone(org.telnyx_phone_number || '')
        }

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

  // Close drawer on path change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [pathname])

  if (isAuthPage) return <>{children}</>

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/client/login')
  }

  // Current active page title for mobile top bar
  const currentItem = navItems.find(item => 
    pathname === item.href || (item.href !== '/client/dashboard' && pathname.startsWith(item.href + '/'))
  )
  const pageTitle = currentItem ? currentItem.label : 'CaptoDesk'

  return (
    <div className="flex min-h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased">

      {/* ── Desktop Persistent Sidebar (>= 768px) ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
        
        {/* Workspace Identity */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <Link href="/client/dashboard" className="flex items-center gap-2.5 min-w-0 group">
            <div className="h-7 w-7 rounded-md bg-zinc-900 border border-zinc-700/80 flex items-center justify-center shrink-0 text-zinc-200">
              <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-zinc-100 truncate">
                {orgName || 'CaptoDesk'}
              </span>
              <span className="block text-[11px] text-zinc-400 truncate">
                {orgPhone ? orgPhone : 'Front Desk'}
              </span>
            </div>
          </Link>

          <span 
            className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" 
            title="Front desk safety net active" 
          />
        </div>

        {/* Structured Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navSections.map(sec => (
            <div key={sec.title} className="space-y-0.5">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {sec.title}
              </div>
              <nav className="flex flex-col gap-0.5">
                {sec.items.map(item => (
                  <NavLinkItem
                    key={item.href}
                    {...item}
                    unreadCount={item.badgeKey === 'inbox' ? unreadTotal : undefined}
                  />
                ))}
              </nav>
            </div>
          ))}

          {isSuperAdmin && (
            <div className="pt-2 border-t border-zinc-800">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500/80">
                System
              </div>
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Super Admin</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer / Account Actions */}
        <div className="border-t border-zinc-800 p-2.5 bg-zinc-950">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Layout Column ── */}
      <div className="flex flex-col md:pl-60 w-full min-h-screen">

        {/* ── Mobile Top Header (< 768px) ── */}
        <header className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 md:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-sm font-semibold text-zinc-100 truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {unreadTotal > 0 && (
              <Link
                href="/client/inbox"
                className="flex items-center gap-1 rounded-full bg-blue-600/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-400"
              >
                <MessageSquare className="h-3 w-3" />
                <span>{unreadTotal}</span>
              </Link>
            )}
            <span className="h-2 w-2 rounded-full bg-emerald-500" title="Safety net active" />
          </div>
        </header>

        {/* ── Desktop Subtle Top Status Bar (>= 768px) ── */}
        <header className="hidden md:flex h-11 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-300">Front desk answering calls & messages</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link 
              href="/client/settings" 
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Forwarding status
            </Link>
          </div>
        </header>

        {/* ── Page Content Container ── */}
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ── Mobile Slide-Out Drawer Overlay ── */}
      {mobileDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div 
            className="fixed inset-y-0 left-0 w-72 bg-zinc-950 border-r border-zinc-800 p-4 flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-md bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-blue-400 shrink-0">
                  <PhoneCall className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-100 truncate">{orgName || 'CaptoDesk'}</div>
                  <div className="text-[11px] text-zinc-400 truncate">{orgPhone || 'Digital Front Desk'}</div>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Navigation List with 44px+ touch targets */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {navSections.map(sec => (
                <div key={sec.title} className="space-y-1">
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {sec.title}
                  </div>
                  {sec.items.map(item => {
                    const isActive = pathname === item.href || (item.href !== '/client/dashboard' && pathname.startsWith(item.href + '/'))
                    const Icon = item.icon
                    const unread = item.badgeKey === 'inbox' ? unreadTotal : 0
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={cn(
                          'flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                          isActive
                            ? 'bg-zinc-800 text-zinc-100 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn('h-4 w-4', isActive ? 'text-zinc-100' : 'text-zinc-400')} />
                          <span>{item.label}</span>
                        </div>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white tabular-nums">
                            {unread}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Drawer Sign Out */}
            <div className="pt-3 border-t border-zinc-800">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors min-h-[44px]"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Purpose-Built Bottom Action Bar (< 768px) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 border-t border-zinc-800 bg-zinc-950 md:hidden px-1 safe-area-bottom">
        <Link
          href="/client/dashboard"
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
            pathname === '/client/dashboard' ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Today</span>
        </Link>

        <Link
          href="/client/inbox"
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
            pathname.startsWith('/client/inbox') ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <div className="relative">
            <MessageSquare className="h-4 w-4" />
            {unreadTotal > 0 && (
              <span className="absolute -top-1 -right-2 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-zinc-950" />
            )}
          </div>
          <span>Inbox</span>
        </Link>

        <Link
          href="/client/jobs"
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
            pathname.startsWith('/client/jobs') ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <Briefcase className="h-4 w-4" />
          <span>Jobs</span>
        </Link>

        <Link
          href="/client/invoices"
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
            pathname.startsWith('/client/invoices') ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <CreditCard className="h-4 w-4" />
          <span>Invoices</span>
        </Link>

        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 min-h-[44px]"
        >
          <Menu className="h-4 w-4" />
          <span>More</span>
        </button>
      </nav>

    </div>
  )
}
