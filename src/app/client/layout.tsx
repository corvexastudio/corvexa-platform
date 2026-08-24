'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Settings, Star, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function SidebarLink({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
        isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

function BottomTab({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
      {label}
    </Link>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/30">

      {/* ── Desktop Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r bg-background shadow-sm sm:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">C</span>
            </div>
            <span className="text-base font-semibold tracking-tight">Corvexa</span>
          </Link>
        </div>

        <div className="flex-1 overflow-auto py-4 px-3">
          <nav className="flex flex-col gap-1">
            {navItems.map(item => <SidebarLink key={item.href} {...item} />)}
          </nav>
        </div>

        <div className="border-t p-3">
          <button
            onClick={handleSignOut}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex flex-col sm:pl-60 w-full">

        {/* Desktop top bar */}
        <div className="hidden sm:flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
          <span className="text-sm text-muted-foreground">Client Portal</span>
        </div>

        {/* Page content — add pb-20 on mobile to clear bottom tab bar */}
        <main className="flex-1 p-4 sm:p-6 pb-24 sm:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t bg-background/95 backdrop-blur sm:hidden">
        {navItems.map(item => <BottomTab key={item.href} {...item} />)}
      </nav>
    </div>
  )
}
