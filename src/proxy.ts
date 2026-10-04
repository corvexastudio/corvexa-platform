import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { telemetryStore } from '@/lib/observability/telemetry-store'

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
  '/jobs',
  '/invoices',
  '/team'
]

export async function proxy(request: NextRequest) {
  const startTime = performance.now()
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  // Clone headers with standard request ID
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
  supabaseResponse.headers.set('x-request-id', requestId)

  const url = request.nextUrl
  const pathname = url.pathname
  const hostname = request.headers.get('host') || ''

  // Helper to record API metric on response
  const finalizeResponse = (res: NextResponse) => {
    res.headers.set('x-request-id', requestId)
    if (pathname.startsWith('/api')) {
      const durationMs = Math.round(performance.now() - startTime)
      telemetryStore.recordApiRequest({
        path: pathname,
        method: request.method,
        statusCode: res.status || 200,
        durationMs,
        requestId
      })
    }
    return res
  }

  // 1. Webhooks, Health Check, & Auth callbacks bypass proxy auth guards
  if (
    pathname.startsWith('/api/webhooks') ||
    pathname.includes('/auth/callback') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/health')
  ) {
    return finalizeResponse(supabaseResponse)
  }

  // 2. Subdomain Routing: book.<domain> for public booking portal
  const isBookSubdomain = hostname.startsWith('book.')
  if (isBookSubdomain) {
    // If user accesses book.domain.com/manage/:token -> /book/manage/:token
    if (pathname.startsWith('/manage/')) {
      return finalizeResponse(NextResponse.rewrite(new URL(`/book${pathname}`, request.url)))
    }
    // If user accesses book.domain.com/:slug (and not already /book or /api/book)
    if (!pathname.startsWith('/book') && !pathname.startsWith('/api/book') && pathname !== '/') {
      return finalizeResponse(NextResponse.rewrite(new URL(`/book${pathname}`, request.url)))
    }
  }

  // 3. Initialize Supabase SSR
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders
            }
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 4. Admin Routing - SEC-05: Enforce authentication on all admin endpoints
  const isAdminPath = hostname.startsWith('admin.') || pathname.startsWith('/admin')
  const isAdminLogin = pathname === '/admin/login' || pathname.startsWith('/admin/login')

  if (isAdminPath) {
    if (isAdminLogin) {
      return finalizeResponse(supabaseResponse)
    }
    if (!user) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return finalizeResponse(NextResponse.redirect(loginUrl))
    }
    if (hostname.startsWith('admin.') && !pathname.startsWith('/admin')) {
      return finalizeResponse(NextResponse.rewrite(new URL(`/admin${pathname}`, request.url)))
    }
    return finalizeResponse(supabaseResponse)
  }

  // 5. Route normalization: rewrite bare paths (/dashboard -> /client/dashboard)
  const isBareClientRoute = CLIENT_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (isBareClientRoute) {
    const destination = new URL(`/client${pathname}`, request.url)
    if (!user) {
      return finalizeResponse(NextResponse.redirect(new URL('/client/login', request.url)))
    }
    return finalizeResponse(NextResponse.rewrite(destination))
  }

  // 6. Root path handling: redirect directly to client portal
  if (pathname === '/') {
    if (user) {
      return finalizeResponse(NextResponse.redirect(new URL('/client/dashboard', request.url)))
    }
    return finalizeResponse(NextResponse.redirect(new URL('/client/login', request.url)))
  }

  // 7. Auth protection for /client/*
  const isClientPath = pathname.startsWith('/client')
  const isAuthPage = pathname.startsWith('/client/login') || pathname.startsWith('/client/onboarding')

  if (isClientPath && !isAuthPage && !user) {
    return finalizeResponse(NextResponse.redirect(new URL('/client/login', request.url)))
  }

  if (isAuthPage && user) {
    return finalizeResponse(NextResponse.redirect(new URL('/client/dashboard', request.url)))
  }

  return finalizeResponse(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
