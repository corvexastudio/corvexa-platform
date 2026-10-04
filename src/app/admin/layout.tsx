'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Building2, 
  ActivitySquare, 
  Flame, 
  Radio, 
  Terminal,
  ShieldCheck,
  Zap,
  ArrowLeft,
  LogOut,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', label: 'Platform Overview', icon: ActivitySquare, exact: true },
  { href: '/admin/organizations', label: 'Tenant Health', icon: Building2 },
  { href: '/admin/staff', label: 'Staff & Access', icon: Users },
  { href: '/admin/events', label: 'Events & Debugging', icon: Terminal },
  { href: '/admin/system-health', label: 'Observability & SRE', icon: Radio },
  { href: '/admin/simulator', label: 'Live Sales Simulator', icon: Flame, highlight: true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [operator, setOperator] = useState<any>(null)

  const isLoginPage = pathname === '/admin/login' || pathname.startsWith('/admin/login')

  useEffect(() => {
    if (isLoginPage) {
      setAuthorized(true)
      setCheckingAuth(false)
      return
    }

    async function verifyAdminAuth() {
      try {
        // Enforce strict server-side verification against the admin API endpoint
        const res = await fetch('/api/admin/overview')
        if (res.status === 401) {
          router.replace('/admin/login?redirect=' + encodeURIComponent(pathname))
          return
        }
        if (res.status === 403 || !res.ok) {
          router.replace('/admin/login?error=not_super_admin')
          return
        }

        const data = await res.json()
        setOperator(data.operator || null)
        setAuthorized(true)
      } catch {
        router.replace('/admin/login?error=unauthorized')
      } finally {
        setCheckingAuth(false)
      }
    }

    verifyAdminAuth()
  }, [pathname, router, isLoginPage])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#070A12] text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-xs uppercase tracking-widest font-mono text-zinc-300">
            Verifying Platform Super Administrator Privileges...
          </p>
        </div>
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="flex min-h-screen w-full bg-[#070A12] text-zinc-100 font-sans selection:bg-blue-500/30">
      {/* Top Accent Line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-400 z-50" />

      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-800/80 bg-[#0A0E18] sm:flex pt-1">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-800/80 px-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Zap className="h-4 w-4 text-black font-black" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">CaptoDesk Ops</p>
              <p className="text-[10px] text-amber-400 font-mono tracking-wider font-semibold">SUPER_ADMIN</p>
            </div>
          </div>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Operations Console
            </span>
          </div>

          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all group',
                  isActive
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : item.highlight
                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
                    isActive ? 'text-black' : item.highlight ? 'text-amber-400' : 'text-zinc-400'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Footer info & Return to Client App */}
        <div className="border-t border-zinc-800/80 p-3 space-y-2">
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-3 py-2">
            <p className="text-[10px] font-mono text-zinc-400">Logged in as:</p>
            <p className="text-xs font-bold text-zinc-200 truncate">{operator?.fullName || 'Super Admin'}</p>
          </div>
          <Link
            href="/client/dashboard"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Client View</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 sm:pl-64 flex flex-col min-h-screen">
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
