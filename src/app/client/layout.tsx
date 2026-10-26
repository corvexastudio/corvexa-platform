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
  Truck,
  RotateCcw,
  DollarSign
} from 'lucide-react'
import { toast } from 'sonner'
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
      { href: '/client/billing', label: 'Plan & Billing', icon: DollarSign },
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

// Dispatcher & Member navigation (least privilege: operational access without restricted financial modules)
export const dispatcherNavSections = [
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
    title: 'Reputation & Clients',
    items: [
      { href: '/client/reviews', label: 'Reviews', icon: Star },
      { href: '/client/customers', label: 'Customers', icon: Users },
      { href: '/client/services', label: 'Services', icon: Wrench },
    ]
  },
  {
    title: 'Operations',
    items: [
      { href: '/client/team', label: 'Team & Fleet', icon: Truck },
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
  const [resettingDemo, setResettingDemo] = useState(false)

  // White-Glove Phone-First Account Claim Banner State
  const [claimEmailInput, setClaimEmailInput] = useState('')
  const [claimPasswordInput, setClaimPasswordInput] = useState('')
  const [savingClaimAccount, setSavingClaimAccount] = useState(false)

  // 10DLC Carrier Registration Prompt for Paying Users
  const [needs10DlcPrompt, setNeeds10DlcPrompt] = useState(false)
  const [dismissed10Dlc, setDismissed10Dlc] = useState(false)

  const handleSaveRealAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!claimEmailInput.trim() || !claimPasswordInput.trim()) return

    setSavingClaimAccount(true)
    try {
      const res = await fetch('/api/client/account/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: claimEmailInput.trim(),
          password: claimPasswordInput
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('✨ Your login has been saved! You can now sign in with this email and password anytime.')
        setUserEmail(data.email)
        setClaimEmailInput('')
        setClaimPasswordInput('')
      } else {
        toast.error(data.error || 'Failed to save login credentials.')
      }
    } catch {
      toast.error('Network error saving login credentials.')
    } finally {
      setSavingClaimAccount(false)
    }
  }

  const isDemoOrg = orgId === '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7' || orgName?.toLowerCase().includes('demo')

  const [confirmingClientReset, setConfirmingClientReset] = useState(false)

  const handleClientResetDemo = async () => {
    if (!confirmingClientReset) {
      setConfirmingClientReset(true)
      setTimeout(() => setConfirmingClientReset(false), 5000)
      return
    }
    setConfirmingClientReset(false)
    setResettingDemo(true)
    try {
      const res = await fetch('/api/admin/demo/reset', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('✨ Demo account wiped and reset to pristine clean slate!')
        setTimeout(() => {
          window.location.reload()
        }, 800)
      } else {
        toast.error(data.error || 'Failed to reset demo tenant.')
      }
    } catch {
      toast.error('Network error resetting demo tenant.')
    } finally {
      setResettingDemo(false)
    }
  }

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
              .select('name, telnyx_phone_number, timezone, subscription_status, plan_id, legal_business_name, ein, is_sole_proprietor, address_street, carrier_registration_status')
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

            const isPaying = org.subscription_status === 'active' || ['solo', 'fleet', 'multi_crew', 'solo_yearly', 'multi_crew_yearly'].includes(org.plan_id || '')
            const isIncomplete10Dlc = !org.legal_business_name || (!org.is_sole_proprietor && !org.ein) || !org.address_street || org.carrier_registration_status === 'unregistered'
            const isOwnerOrAdmin = profile.role === 'owner' || profile.role === 'admin' || profile.role === 'super_admin'

            if (isPaying && isIncomplete10Dlc && isOwnerOrAdmin) {
              setNeeds10DlcPrompt(true)
            }
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
  const isDispatcher = role?.toLowerCase() === 'dispatcher'
  const isMember = role?.toLowerCase() === 'member'
  const effectiveNavSections = isTechnician
    ? technicianNavSections
    : (isDispatcher || isMember)
    ? dispatcherNavSections
    : navSections

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

  // Route guard for non-financial roles (dispatcher and member)
  useEffect(() => {
    if (authState === 'authorized' && (isDispatcher || isMember)) {
      const forbiddenFinancialPaths = ['/client/invoices', '/client/quotes', '/client/billing']
      const isForbidden = forbiddenFinancialPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (isForbidden) {
        router.replace('/client/dashboard')
      }
    }
  }, [authState, isDispatcher, isMember, pathname, router])

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

        {/* ── Demo Account Walkthrough Banner (Only visible to Super Admins, hidden from prospects) ── */}
        {isSuperAdmin && isDemoOrg && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs z-30">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-bold text-amber-600 dark:text-amber-400">
                ⚡ Live Interactive Demo
              </span>
              <span className="hidden sm:inline text-slate-500 dark:text-zinc-400">
                • Real-Time Owner Workspace (CaptoDesk Demo Services)
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleClientResetDemo}
                disabled={resettingDemo}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                title="Wipe demo test data and restore clean slate"
              >
                <RotateCcw className={cn("h-3 w-3", resettingDemo && "animate-spin")} />
                <span>{resettingDemo ? 'Resetting...' : confirmingClientReset ? 'Confirm Reset?' : 'Reset Demo (Clean Slate)'}</span>
              </button>
            </div>
          </div>
        )}

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
          {/* White-Glove Phone-First Claim Welcome Banner */}
          {userEmail?.endsWith('@claim.captodesk.com') && (
            <div className="mb-6 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 rounded-full bg-amber-500 text-black items-center justify-center text-xs font-bold shrink-0">⚡</span>
                    <h2 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                      Welcome to your pre-built CaptoDesk workspace!
                    </h2>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300/90 pl-8">
                    Tap below to save your real email & password for future logins:
                  </p>
                </div>

                <form onSubmit={handleSaveRealAccount} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="Tap to auto-fill your email"
                    value={claimEmailInput}
                    onChange={e => setClaimEmailInput(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-48"
                  />
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    placeholder="Create password (6+ chars)"
                    value={claimPasswordInput}
                    onChange={e => setClaimPasswordInput(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-40"
                  />
                  <button
                    type="submit"
                    disabled={savingClaimAccount}
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-black shadow-2xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {savingClaimAccount ? 'Saving...' : 'Save My Login'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 10DLC Carrier Registration Prompt for Paying Users */}
          {needs10DlcPrompt && !dismissed10Dlc && !pathname.includes('/client/settings') && (
            <div className="mb-6 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Action Required: Register for US Carrier 10DLC (Missed-Call Text-Back)
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                      US wireless carriers (Verizon, AT&amp;T, T-Mobile) require all automated business text messages to be pre-registered under A2P 10DLC. Complete your legal entity name, EIN, and address so your missed-call text-backs are verified and never filtered.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Link
                    href="/client/settings?tab=retention"
                    className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-2xs transition-colors"
                  >
                    Complete 10DLC Details →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDismissed10Dlc(true)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-2 rounded-lg cursor-pointer"
                    title="Dismiss for now"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

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
