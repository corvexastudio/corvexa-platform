import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'invite' | 'magiclink' | 'recovery' | 'email' | null
  const next = searchParams.get('next') ?? '/client/dashboard'

  const errorRedirect = new URL('/client/login?error=link_expired', origin)

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
    let destination = next

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle()

      // If brand new signup with Gmail, direct to 1-step onboarding
      if (!profile || !profile.org_id) {
        destination = '/client/onboarding'
      }
    }

    const redirectResponse = NextResponse.redirect(new URL(destination, origin))
    cookiesToSetOnRedirect.forEach(({ name, value, options }) =>
      redirectResponse.cookies.set(name, value, options)
    )
    return redirectResponse
  }

  return NextResponse.redirect(errorRedirect)
}

