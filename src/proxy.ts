import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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

  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const pathname = url.pathname

  // ── Subdomain routing ──────────────────────────────────
  if (hostname.startsWith('admin.')) {
    if (!pathname.startsWith('/admin')) {
      return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url))
    }
    return supabaseResponse
  }

  if (hostname.startsWith('app.')) {
    // Auth guard: protected client routes
    const isProtected =
      pathname.startsWith('/client/dashboard') ||
      pathname.startsWith('/client/activity') ||
      pathname.startsWith('/client/reviews') ||
      pathname.startsWith('/client/settings') ||
      pathname.startsWith('/client/team')

    const isAuthPage =
      pathname.startsWith('/client/login') ||
      pathname.startsWith('/client/onboarding')

    // Rewrite bare paths to /client/...
    if (!pathname.startsWith('/client')) {
      const rewritten = new URL(`/client${pathname}`, request.url)

      // Check auth on the rewritten destination
      const rewrittenProtected =
        rewritten.pathname.startsWith('/client/dashboard') ||
        rewritten.pathname.startsWith('/client/activity') ||
        rewritten.pathname.startsWith('/client/reviews') ||
        rewritten.pathname.startsWith('/client/settings') ||
        rewritten.pathname.startsWith('/client/team')

      if (rewrittenProtected && !user) {
        return NextResponse.redirect(new URL('/login', request.url))
      }

      return NextResponse.rewrite(rewritten)
    }

    // Already under /client/...
    if (isProtected && !user) {
      return NextResponse.redirect(new URL(`${pathname.replace('/client', '')}/login`.replace('//', '/'), request.url))
    }

    // Logged-in user hitting login page → send home
    if (isAuthPage && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
