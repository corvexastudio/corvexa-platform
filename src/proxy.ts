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
  '/quotes',
  '/team',
  '/field',
  '/billing',
  '/onboarding'
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

  // 1.1 Catch orphan OAuth/Magic Link callbacks landing on root or other paths with ?code=
  if (url.searchParams.has('code') && !pathname.includes('/auth/callback')) {
    const callbackUrl = new URL('/auth/callback', request.url)
    url.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value)
    })
    return finalizeResponse(NextResponse.redirect(callbackUrl))
  }

  // 1.2 Catch OAuth errors landing on bare root
  if (url.searchParams.has('error') && pathname === '/') {
    if (hostname.startsWith('agency.')) {
      const loginUrl = new URL('/agency/login', request.url)
      url.searchParams.forEach((v, k) => loginUrl.searchParams.set(k, v))
      return finalizeResponse(NextResponse.redirect(loginUrl))
    }
  }

  // 2. Subdomain Routing: book.<domain> for public booking portal
  const isBookSubdomain = hostname.startsWith('book.')
  if (isBookSubdomain) {
    // Bare root on book subdomain redirects to main brand landing page
    if (pathname === '/' || pathname === '') {
      return finalizeResponse(NextResponse.redirect(new URL('https://captodesk.com', request.url)))
    }
    // Normalize redundant book.domain.com/book/manage/:token -> /manage/:token
    if (pathname.startsWith('/book/manage/')) {
      const cleanPath = pathname.replace('/book/manage/', '/manage/')
      return finalizeResponse(NextResponse.redirect(new URL(cleanPath, request.url)))
    }
    // If user accesses book.domain.com/manage/:token -> internal rewrite to /book/manage/:token
    if (pathname.startsWith('/manage/')) {
      return finalizeResponse(NextResponse.rewrite(new URL(`/book${pathname}`, request.url)))
    }
    // Allow tracking, invoices, quotes, reviews, claims, APIs, and legal pages to pass through without booking slug rewrite
    if (
      pathname.startsWith('/t/') ||
      pathname.startsWith('/track/') ||
      pathname.startsWith('/invoice/') ||
      pathname.startsWith('/quote/') ||
      pathname.startsWith('/r/') ||
      pathname.startsWith('/claim/') ||
      pathname.startsWith('/api/') ||
      pathname === '/privacy' ||
      pathname === '/terms'
    ) {
      return finalizeResponse(supabaseResponse)
    }
    // If user accesses book.domain.com/:slug (and not already /book)
    if (!pathname.startsWith('/book')) {
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

  // 4.2. Agency Subdomain & Path Routing: agency.<domain> or /agency for B2B Partner Portal
  const isAgencySubdomain = hostname.startsWith('agency.')
  const isAgencyPath = isAgencySubdomain || pathname.startsWith('/agency')

  if (isAgencyPath) {
    // Pass API requests, static assets, and auth callbacks through directly
    if (
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/brand') ||
      pathname.includes('.')
    ) {
      return finalizeResponse(supabaseResponse)
    }

    // A. Clean Subdomain Routing: agency.captodesk.com
    if (isAgencySubdomain) {
      // 1. Strip redundant /agency prefix on agency subdomain (e.g. /agency/login -> /login, /agency/dashboard -> /dashboard)
      if (pathname.startsWith('/agency')) {
        const cleanPath = pathname.replace(/^\/agency/, '') || '/'
        const cleanUrl = new URL(cleanPath, request.url)
        url.searchParams.forEach((v, k) => cleanUrl.searchParams.set(k, v))
        return finalizeResponse(NextResponse.redirect(cleanUrl))
      }

      // 1.5. If request on agency subdomain is targeting contractor app (/client/*), route to captodesk.com
      if (pathname.startsWith('/client')) {
        const targetHost = hostname.includes('localhost') ? request.headers.get('host') || 'localhost:3000' : 'captodesk.com'
        const protocol = request.nextUrl.protocol || 'https:'
        const contractorUrl = new URL(`${protocol}//${targetHost}${pathname}`)
        url.searchParams.forEach((v, k) => contractorUrl.searchParams.set(k, v))
        return finalizeResponse(NextResponse.redirect(contractorUrl))
      }

      // 2. Bare root on agency subdomain: / -> /dashboard (if authenticated) or /login (if unauthenticated)
      if (pathname === '/' || pathname === '') {
        const target = user ? '/dashboard' : '/login'
        const targetUrl = new URL(target, request.url)
        url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v))
        return finalizeResponse(NextResponse.redirect(targetUrl))
      }

      // 3. Login route on agency subdomain: /login
      if (pathname === '/login' || pathname === '/login/') {
        if (user) {
          return finalizeResponse(NextResponse.redirect(new URL('/dashboard', request.url)))
        }
        return finalizeResponse(NextResponse.rewrite(new URL('/agency/login', request.url)))
      }

      // 4. SEC: Enforce authentication on all protected agency console routes
      if (!user) {
        const loginUrl = new URL('/login', request.url)
        if (pathname !== '/dashboard') {
          loginUrl.searchParams.set('redirect', pathname)
        }
        return finalizeResponse(NextResponse.redirect(loginUrl))
      }

      // 5. Rewrite clean path to internal /agency route (/dashboard -> /agency/dashboard, /attribution -> /agency/attribution)
      return finalizeResponse(NextResponse.rewrite(new URL(`/agency${pathname}`, request.url)))
    }

    // B. Path-based Routing on main brand domain: captodesk.com/agency/*
    // In production on captodesk.com, redirect to clean agency subdomain
    if (hostname.includes('captodesk.com') && !isAgencySubdomain) {
      const cleanPath = pathname.replace(/^\/agency/, '') || '/dashboard'
      return finalizeResponse(NextResponse.redirect(new URL(`https://agency.captodesk.com${cleanPath}`, request.url)))
    }

    // Localhost / preview fallback
    if (pathname === '/agency' || pathname === '/agency/') {
      return finalizeResponse(NextResponse.redirect(new URL('/agency/dashboard', request.url)))
    }

    const isLegacyLogin = pathname === '/agency/login' || pathname.startsWith('/agency/login')
    if (isLegacyLogin) {
      if (user) return finalizeResponse(NextResponse.redirect(new URL('/agency/dashboard', request.url)))
      return finalizeResponse(supabaseResponse)
    }

    if (!user) {
      const loginUrl = new URL('/agency/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return finalizeResponse(NextResponse.redirect(loginUrl))
    }

    return finalizeResponse(supabaseResponse)
  }

  // 4.5. App Subdomain Routing: app.<domain> for contractor SaaS client portal
  const isAppSubdomain = hostname.startsWith('app.')
  if (isAppSubdomain) {
    // Bare root on app subdomain redirects straight to client dashboard or login
    if (pathname === '/' || pathname === '') {
      return finalizeResponse(
        NextResponse.redirect(new URL(user ? '/client/dashboard' : '/client/login', request.url))
      )
    }
    if (pathname === '/login') {
      return finalizeResponse(
        NextResponse.redirect(new URL(user ? '/client/dashboard' : '/client/login', request.url))
      )
    }
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

  // 6. Root path (/) serves the public marketing landing page to all visitors

  // 7. Auth protection for /client/*
  const isClientPath = pathname.startsWith('/client')
  const isLoginPage = pathname === '/client/login' || pathname.startsWith('/client/login')
  const isOnboardingPage = pathname === '/client/onboarding' || pathname.startsWith('/client/onboarding')

  // Unauthenticated users trying to access protected client routes go to login
  if (isClientPath && !isLoginPage && !isOnboardingPage && !user) {
    return finalizeResponse(NextResponse.redirect(new URL('/client/login', request.url)))
  }

  // Authenticated users on the login page go to dashboard
  if (isLoginPage && user) {
    return finalizeResponse(NextResponse.redirect(new URL('/client/dashboard', request.url)))
  }

  return finalizeResponse(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
