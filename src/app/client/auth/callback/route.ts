import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'invite' | 'magiclink' | 'recovery' | 'email' | null
  const next = searchParams.get('next') ?? '/dashboard'

  const redirectTo = new URL(next, origin)
  const errorRedirect = new URL('/login?error=link_expired', origin)

  const supabaseResponse = NextResponse.redirect(redirectTo)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // PKCE flow — magic link sent from the app's own login form
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return supabaseResponse
  }

  // Implicit / invite flow — Supabase dashboard invite or email OTP
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) return supabaseResponse
  }

  return NextResponse.redirect(errorRedirect)
}
