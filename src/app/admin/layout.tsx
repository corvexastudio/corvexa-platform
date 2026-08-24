'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert, ActivitySquare, LayoutList, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/organizations', label: 'Organizations', icon: LayoutList },
  { href: '/system-health', label: 'System Health', icon: ShieldAlert },
  { href: '/analytics', label: 'Analytics', icon: ActivitySquare },
]

function NavLink({ href, label, icon: Icon, mobile = false }: { href: string; label: string; icon: any; mobile?: boolean }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
        isActive
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-50">
      {/* Top accent line */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-400 z-50" />

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-slate-800 bg-slate-900 sm:flex pt-0.5">
        <div className="flex h-16 items-center border-b border-slate-800 px-6">
          <Link href="/organizations" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Agency Admin</p>
              <p className="text-xs text-slate-500">Corvexa Studio</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-auto py-4 px-3">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wider px-3 mb-2">Navigation</p>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-xs font-semibold text-blue-400">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Super Admin</p>
              <p className="text-xs text-slate-500 truncate">Corvexa Studio</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-col sm:pl-64 w-full pt-0.5">
        {/* Mobile Header */}
        <header className="sticky top-0.5 z-30 flex h-14 items-center gap-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-4 sm:hidden">
          <Sheet>
            {/* @ts-ignore */}
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="text-slate-400 hover:text-white">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-slate-900 border-slate-800 text-slate-50 pt-6">
              <div className="flex items-center gap-2 mb-6 px-2">
                <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">C</span>
                </div>
                <span className="font-semibold">Agency Admin</span>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => <NavLink key={item.href} {...item} mobile />)}
              </nav>
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-white">Agency Admin</span>
        </header>

        {/* Desktop top bar */}
        <div className="hidden sm:flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6">
          <p className="text-xs text-slate-500">Agency Command Center</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">All systems operational</span>
          </div>
        </div>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
