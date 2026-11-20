import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sanitizeRedirectDestination } from '@/lib/security/redirect-sanitizer'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'invite' | 'magiclink' | 'recovery' | 'email' | null
  const next = searchParams.get('next') ?? '/client/dashboard'

  const isAgencyCallback = next.startsWith('/agency') || origin.includes('agency.')
  const errorRedirect = new URL(
    isAgencyCallback 
      ? (origin.includes('agency.') ? '/login?error=link_expired' : '/agency/login?error=link_expired')
      : '/client/login?error=link_expired',
    origin
  )

  // Track cookies to commit onto the outgoing redirect response
  const cookiesToSetOnRedirect: { name: string; value: string; options?: any }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookiesToSetOnRedirect.push({ name, value, options })
          )
        },
      },
    }
  )

  let authSuccess = false

  // 1. PKCE flow — Google OAuth and Magic Link
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) authSuccess = true
  }

  // 2. Implicit / invite flow — OTP or Invite
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) authSuccess = true
  }

  if (authSuccess) {
    // Check if user has an existing profile and organization
    const { data: { user } } = await supabase.auth.getUser()
    // Validate destination is a strictly relative path to prevent Open Redirect (HIGH-01)
    const safeDestination = sanitizeRedirectDestination(next)
    let destination = safeDestination

    if (user) {
      // For agency partners, bypass contractor tenant onboarding and route directly to agency destination
      if (safeDestination.startsWith('/agency') || origin.includes('agency.')) {
        destination = safeDestination
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id, role')
          .eq('id', user.id)
          .maybeSingle()

        // If super_admin, direct them to /admin without forcing tenant onboarding
        const isDefaultDashboard = safeDestination === '/client/dashboard' || safeDestination === '/dashboard'
        if (profile?.role === 'super_admin') {
          destination = !isDefaultDashboard ? safeDestination : '/admin'
        } else if (profile?.role === 'technician') {
          destination = !isDefaultDashboard ? safeDestination : (origin.includes('app.') ? '/field' : '/client/field')
        } else if (!profile || !profile.org_id) {
          // If brand new signup with Gmail, direct to 1-step onboarding
          destination = origin.includes('app.') ? '/onboarding' : '/client/onboarding'
        }
      }
    }

    // In production on captodesk.com (non-agency, non-admin, non-book), redirect contractor destinations to app.captodesk.com
    let targetOrigin = origin
    if (
      !origin.includes('agency.') && 
      !origin.includes('admin.') && 
      !origin.includes('book.') && 
      origin.includes('captodesk.com') && 
      !origin.includes('app.')
    ) {
      targetOrigin = 'https://app.captodesk.com'
    }

    // On app.captodesk.com, strip redundant /client prefix for clean URLs
    if (targetOrigin.includes('app.')) {
      destination = destination.replace(/^\/client/, '') || '/dashboard'
    }

    const redirectResponse = NextResponse.redirect(new URL(destination, targetOrigin))
    cookiesToSetOnRedirect.forEach(({ name, value, options }) =>
      redirectResponse.cookies.set(name, value, options)
    )
    return redirectResponse
  }

  return NextResponse.redirect(errorRedirect)
}

