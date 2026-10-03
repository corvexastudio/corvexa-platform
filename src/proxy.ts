import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const CLIENT_ROUTES = [
  '/dashboard',
  '/inbox',
  '/leads',
  '/customers',
  '/calendar',
  '/automations',
  '/settings',
  '/activity',
  '/reviews',
  '/team'
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = request.nextUrl
  const pathname = url.pathname
  const hostname = request.headers.get('host') || ''

  // 1. Webhooks & Public APIs & Auth callbacks bypass proxy auth guards
  if (pathname.startsWith('/api/webhooks') || pathname.includes('/auth/callback')) {
    return supabaseResponse
  }

  // 2. Initialize Supabase SSR
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 3. Admin Routing
  if (hostname.startsWith('admin.') || pathname.startsWith('/admin')) {
    if (hostname.startsWith('admin.') && !pathname.startsWith('/admin')) {
      return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url))
    }
    return supabaseResponse
  }

  // 4. Route normalization: rewrite bare paths (/dashboard -> /client/dashboard)
  const isBareClientRoute = CLIENT_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (isBareClientRoute) {
    const destination = new URL(`/client${pathname}`, request.url)
    if (!user) {
      return NextResponse.redirect(new URL('/client/login', request.url))
    }
    return NextResponse.rewrite(destination)
  }

  // 5. Root path handling: redirect directly to client portal
  if (pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/client/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/client/login', request.url))
  }

  // 5. Auth protection for /client/*
  const isClientPath = pathname.startsWith('/client')
  const isAuthPage = pathname.startsWith('/client/login') || pathname.startsWith('/client/onboarding')

  if (isClientPath && !isAuthPage && !user) {
    return NextResponse.redirect(new URL('/client/login', request.url))
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/client/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
