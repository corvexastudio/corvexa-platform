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
  Plus, 
  Wrench,
  Navigation,
  Truck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { UniversalQuickCreate } from '@/components/universal-quick-create'
import { ThemeToggle } from '@/components/theme-toggle'
import { WorkspaceContext, WorkspaceContextValue } from '@/lib/context/workspace-context'

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
      { href: '/client/field', label: 'Field Portal', icon: Navigation },
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
      { href: '/client/services', label: 'Services', icon: Wrench },
      { href: '/client/team', label: 'Team & Fleet', icon: Truck },
      { href: '/client/automations', label: 'Automations', icon: Zap },
      { href: '/client/settings', label: 'Settings', icon: Settings },
    ]
  }
]

// Strict field-only navigation for technician role
export const technicianNavSections = [
  {
    title: 'Field Operations',
    items: [
      { href: '/client/field', label: "Today's Route", icon: Navigation },
      { href: '/client/calendar', label: 'My Schedule', icon: Calendar },
      { href: '/client/inbox', label: 'Customer Chat', icon: MessageSquare, badgeKey: 'inbox' },
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
  const rawPathname = usePathname()
  const pathname = rawPathname || ''
  const isActive = pathname === href || (href !== '/client/dashboard' && pathname.startsWith(href + '/'))

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all cursor-pointer',
        isActive
          ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/70 shadow-2xs dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/60'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300')} />
        <span className="truncate">{label}</span>
      </div>
      {typeof unreadCount === 'number' && unreadCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white tabular-nums shadow-2xs">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const rawPathname = usePathname()
  const pathname = rawPathname || ''
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [orgName, setOrgName] = useState<string>('')
  const [orgPhone, setOrgPhone] = useState<string>('')
  const [orgTimezone, setOrgTimezone] = useState<string>('America/Chicago')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userFullName, setUserFullName] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'redirecting'>('checking')

  // Auth pages render without shell
  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/onboarding' ||
    pathname.startsWith('/client/login') || 
    pathname.startsWith('/client/onboarding')

  useEffect(() => {
    if (isAuthPage) {
      setAuthState('authorized')
      return
    }

    let isMounted = true

    const loadProfile = async () => {
      try {
        // Fast local session read first
        const sessionRes = await supabase.auth.getSession()
        let activeUser = sessionRes?.data?.session?.user

        // If no user immediately found, check getUser
        if (!activeUser) {
          const userRes = await supabase.auth.getUser()
          activeUser = userRes?.data?.user
        }

        // If still no user, wait 350ms to allow browser cookies to finish hydrating and try once more
        if (!activeUser) {
          await new Promise((resolve) => setTimeout(resolve, 350))
          if (!isMounted) return
          const retryRes = await supabase.auth.getUser()
          activeUser = retryRes?.data?.user
        }

        if (!isMounted) return

        if (!activeUser) {
          setAuthState('redirecting')
          router.replace('/client/login')
          return
        }

        // Direct profile lookup
        let { data: profile } = await supabase
          .from('profiles')
          .select('org_id, role, full_name, email')
          .eq('id', activeUser.id)
          .maybeSingle()

        if (!isMounted) return

        // Auto-heal/provision organization if profile or org_id is missing
        if (!profile || !profile.org_id) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const defaultName = activeUser.user_metadata?.full_name 
              ? `${activeUser.user_metadata.full_name}'s Business`
              : (activeUser.email ? `${activeUser.email.split('@')[0]}'s Services` : 'My Business')

            const onboardRes = await fetch('/api/onboarding', {
              method: 'POST',
              headers,
              body: JSON.stringify({ businessName: defaultName })
            })

            if (onboardRes.ok) {
              const { data: freshProfile } = await supabase
                .from('profiles')
                .select('org_id, role, full_name, email')
                .eq('id', activeUser.id)
                .maybeSingle()
              profile = freshProfile
            }
          } catch (e) {
            console.warn('[LAYOUT] Auto-onboarding error:', e)
          }
        }

        if (!isMounted) return

        if (!profile || !profile.org_id) {
          setAuthState('redirecting')
          router.replace('/client/onboarding')
          return
        }

        setUserId(activeUser.id)
        setUserEmail(activeUser.email || profile.email || null)
        setUserFullName(profile.full_name || activeUser.user_metadata?.full_name || null)
        setIsSuperAdmin(profile.role === 'super_admin')
        setRole(profile.role || null)
        setOrgId(profile.org_id)

        // Non-fatal parallel enrichment: organization metadata and unread counts
        try {
          const [{ data: org }, { count }] = await Promise.all([
            supabase
              .from('organizations')
              .select('name, telnyx_phone_number, timezone')
              .eq('id', profile.org_id)
              .maybeSingle(),
            supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('org_id', profile.org_id)
              .gt('unread_count', 0)
          ])

          if (org && isMounted) {
            setOrgName(org.name || 'My Business')
            setOrgPhone(org.telnyx_phone_number || '')
            if (org.timezone) setOrgTimezone(org.timezone)
          }

          if (isMounted) {
            setUnreadTotal(count || 0)
          }
        } catch (enrichErr) {
          console.warn('[LAYOUT] Non-fatal metadata enrichment error:', enrichErr)
        }

        if (isMounted) {
          setAuthState('authorized')
        }
      } catch (err) {
        console.error('[LAYOUT] Unexpected profile load failure:', err)
        // Never redirect into an onboarding loop on unexpected error; allow layout to render
        if (isMounted) {
          setAuthState('authorized')
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [supabase, isAuthPage, router])

  const isTechnician = role?.toLowerCase() === 'technician'
  const effectiveNavSections = isTechnician ? technicianNavSections : navSections

  // Strict route guard for technician role (Hook declared unconditionally at top level)
  useEffect(() => {
    if (authState === 'authorized' && isTechnician) {
      const allowedPaths = ['/client/field', '/client/calendar', '/client/inbox']
      const isAllowed = allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (!isAllowed) {
        router.replace('/client/field')
      }
    }
  }, [authState, isTechnician, pathname, router])

  // Close drawer on path change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [pathname])

  if (isAuthPage) return <>{children}</>

  if (authState === 'checking' || authState === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-center animate-pulse">
            <span className="text-blue-600 dark:text-blue-400 font-extrabold text-base">C</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-500 font-medium">
            {authState === 'redirecting' ? 'Redirecting to workspace setup...' : 'Loading workspace...'}
          </span>
        </div>
      </div>
    )
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/client/login')
  }

  const currentItem = navItems.find(item => 
    pathname === item.href || (item.href !== '/client/dashboard' && pathname.startsWith(item.href + '/'))
  )
  const pageTitle = currentItem ? currentItem.label : 'CaptoDesk'
  const workspaceValue: WorkspaceContextValue = {
    orgId,
    orgName,
    orgPhone,
    orgTimezone,
    isSuperAdmin,
    role,
    userId,
    userEmail,
    userFullName,
    unreadTotal
  }

  return (
    <WorkspaceContext.Provider value={workspaceValue}>
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans antialiased">

      {/* ── Desktop Persistent Sidebar (>= 768px) ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 md:flex shadow-2xs">
        
        {/* Workspace Identity */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-4">
          <Link href={isTechnician ? "/client/field" : "/client/dashboard"} className="flex items-center gap-2.5 min-w-0 group">
            <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-blue-700 transition-colors">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                {orgName || 'CaptoDesk'}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                {isTechnician ? 'Field Technician' : (orgPhone ? orgPhone : 'Digital Front Desk')}
              </span>
            </div>
          </Link>

          <span 
            className="relative flex h-2 w-2 shrink-0" 
            title="Front desk safety net active" 
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>

        {/* Structured Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {effectiveNavSections.map(sec => (
            <div key={sec.title} className="space-y-0.5">
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
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
            <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                System
              </div>
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Super Admin</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer / Account Actions & Quick Theme Switcher */}
        <div className="border-t border-slate-200 dark:border-zinc-800 p-3 bg-slate-50/60 dark:bg-zinc-950 flex items-center justify-between gap-2">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Main Layout Column ── */}
      <div className="flex flex-col md:pl-64 w-full min-h-screen">

        {/* ── Mobile Top Header (< 768px) ── */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 md:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Solo Operator / Owner 1-Tap Mode Switcher */}
            {!isTechnician && (
              <Link
                href={pathname === '/client/field' ? '/client/dashboard' : '/client/field'}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px]",
                  pathname === '/client/field'
                    ? "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700"
                    : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                )}
                title={pathname === '/client/field' ? 'Switch to Office Dashboard' : 'Switch to Field Route'}
              >
                {pathname === '/client/field' ? (
                  <>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Office</span>
                  </>
                ) : (
                  <>
                    <Navigation className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Route</span>
                  </>
                )}
              </Link>
            )}
            <ThemeToggle />
            <ErrorBoundary fallback={<div className="h-8 w-8" />}>
              <NotificationCenter orgId={orgId} />
            </ErrorBoundary>
            {unreadTotal > 0 && (
              <Link
                href="/client/inbox"
                className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-600/10 dark:border-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 min-h-[36px]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{unreadTotal}</span>
              </Link>
            )}
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Safety net active" />
          </div>
        </header>

        {/* ── Desktop Modern Top Navigation Bar (>= 768px) ── */}
        <header className="hidden md:flex h-14 items-center justify-between border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              {pageTitle}
            </h1>
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Digital Front Desk: {orgPhone || 'Active'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Solo Operator / Owner 1-Tap Mode Switcher */}
            {!isTechnician && (
              <Link
                href={pathname === '/client/field' ? '/client/dashboard' : '/client/field'}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs",
                  pathname === '/client/field'
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700"
                    : "bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                )}
                title={pathname === '/client/field' ? 'Switch to Office Dashboard' : 'Switch to Field Route'}
              >
                {pathname === '/client/field' ? (
                  <>
                    <LayoutDashboard className="h-3.5 w-3.5 text-slate-600 dark:text-zinc-400" />
                    <span>Office Dashboard</span>
                  </>
                ) : (
                  <>
                    <Navigation className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Field Route</span>
                  </>
                )}
              </Link>
            )}
            {!isTechnician && <UniversalQuickCreate />}
            <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800" />
            <ErrorBoundary fallback={<div className="h-8 w-8" />}>
              <NotificationCenter orgId={orgId} />
            </ErrorBoundary>
            <ThemeToggle />
          </div>
        </header>

        {/* ── Page Content Container ── */}
        <main className={cn(
          "flex-1 w-full mx-auto",
          pathname.startsWith('/client/inbox')
            ? "p-0 pb-16 md:p-6 md:pb-6 max-w-7xl"
            : "p-4 sm:p-6 pb-20 md:pb-6 max-w-6xl"
        )}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Mobile Slide-Out Drawer Overlay ── */}
      {mobileDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div 
            className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 p-4 flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">{orgName || 'CaptoDesk'}</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">{orgPhone || 'Digital Front Desk'}</div>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation List with 44px+ touch targets */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {effectiveNavSections.map(sec => (
                <div key={sec.title} className="space-y-1">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
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
                          'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/70 dark:bg-zinc-800 dark:text-zinc-100 dark:border-transparent'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn('h-4 w-4', isActive ? 'text-blue-600 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-400')} />
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

            {/* Drawer Footer with Theme Toggle */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors min-h-[44px]"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Purpose-Built Bottom Action Bar (< 768px) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 md:hidden px-1 backdrop-blur-md safe-area-bottom">
        {isTechnician ? (
          <>
            <Link
              href="/client/field"
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
                pathname.startsWith('/client/field') ? 'text-blue-600 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              <Navigation className="h-4 w-4" />
              <span>Route</span>
            </Link>

            <Link
              href="/client/calendar"
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
                pathname.startsWith('/client/calendar') ? 'text-blue-600 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              <Calendar className="h-4 w-4" />
              <span>Schedule</span>
            </Link>

            <Link
              href="/client/inbox"
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
                pathname.startsWith('/client/inbox') ? 'text-blue-600 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              <div className="relative">
                <MessageSquare className="h-4 w-4" />
                {unreadTotal > 0 && (
                  <span className="absolute -top-1 -right-2 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-zinc-950" />
                )}
              </div>
              <span>Inbox</span>
            </Link>

            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 min-h-[44px]"
            >
              <Menu className="h-4 w-4" />
              <span>More</span>
            </button>
          </>
        ) : (
          <>
            <Link
              href="/client/dashboard"
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
                pathname === '/client/dashboard' ? 'text-blue-600 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Today</span>
            </Link>

            <Link
              href="/client/inbox"
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
                pathname.startsWith('/client/inbox') ? 'text-blue-600 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              <div className="relative">
                <MessageSquare className="h-4 w-4" />
                {unreadTotal > 0 && (
                  <span className="absolute -top-1 -right-2 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-zinc-950" />
                )}
              </div>
              <span>Inbox</span>
            </Link>

            <Link
              href="/client/jobs"
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
                pathname.startsWith('/client/jobs') ? 'text-blue-600 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              <Briefcase className="h-4 w-4" />
              <span>Jobs</span>
            </Link>

            <Link
              href="/client/invoices"
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-[44px]',
                pathname.startsWith('/client/invoices') ? 'text-blue-600 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              <CreditCard className="h-4 w-4" />
              <span>Invoices</span>
            </Link>

            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 min-h-[44px]"
            >
              <Menu className="h-4 w-4" />
              <span>More</span>
            </button>
          </>
        )}
      </nav>
      </div>
    </WorkspaceContext.Provider>
  )
}
