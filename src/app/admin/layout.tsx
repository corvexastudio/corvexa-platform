'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Building2, 
  ShieldAlert, 
  ActivitySquare, 
  Flame, 
  ArrowLeft,
  PhoneCall,
  Zap,
  Radio
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/organizations', label: 'Client Tenants', icon: Building2 },
  { href: '/admin/simulator', label: 'Live Sales Simulator', icon: Flame, highlight: true },
  { href: '/admin/system-health', label: 'Carrier & Webhooks', icon: Radio },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

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
              <p className="text-sm font-extrabold text-white">CaptoDesk Admin</p>
              <p className="text-[10px] text-amber-400/90 font-semibold uppercase tracking-wider">Super Control</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-5 px-3">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
            Platform Operations
          </p>
          <nav className="flex flex-col gap-1.5">
            {navItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : item.highlight
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.highlight && !isActive && (
                    <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Back to Client View Link */}
        <div className="border-t border-zinc-800/80 p-3 bg-zinc-950/40">
          <Link
            href="/client/dashboard"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-400" />
            <span>Switch to Client Portal</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col sm:pl-64 w-full min-h-screen">
        <header className="h-14 border-b border-zinc-800/70 bg-[#0A0E18]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telnyx Telephony &amp; Carrier Forwarding:</span>
            <span className="text-emerald-400 font-bold">Live Production</span>
          </div>

          <Link
            href="/admin/simulator"
            className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Open Cold-Call Demo Simulator</span>
          </Link>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  )
}
