'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, LayoutDashboard, Settings, Users, Activity, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/activity', label: 'Activity Feed', icon: Activity },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function NavLink({ href, label, icon: Icon, mobile = false }: { href: string; label: string; icon: any; mobile?: boolean }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  if (mobile) {
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-4 px-2.5 py-2 rounded-lg transition-all',
          isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background shadow-sm sm:flex">
        {/* Brand */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">C</span>
            </div>
            <span className="text-base font-semibold tracking-tight">Corvexa App</span>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-auto py-4 px-3">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">My Account</p>
              <p className="text-xs text-muted-foreground truncate">client</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-col sm:pl-64 w-full">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 sm:hidden">
          <Sheet>
            {/* @ts-ignore */}
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 pt-6">
              <div className="flex items-center gap-2 mb-6 px-2">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xs">C</span>
                </div>
                <span className="font-semibold">Corvexa App</span>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => <NavLink key={item.href} {...item} mobile />)}
              </nav>
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Corvexa App</span>
          <div className="ml-auto">
            <Button size="icon" variant="ghost" className="rounded-full">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Top bar desktop */}
        <div className="hidden sm:flex h-14 items-center justify-end border-b bg-background/95 backdrop-blur px-6">
          <Button size="icon" variant="ghost" className="rounded-full">
            <Bell className="h-4 w-4" />
          </Button>
        </div>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
