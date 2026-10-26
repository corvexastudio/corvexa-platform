import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyClaimToken } from '@/lib/security/claim-token'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { origin } = new URL(request.url)
  const { token } = await params

  const payload = verifyClaimToken(token)
  if (!payload) {
    return NextResponse.redirect(new URL('/client/login?error=claim_expired', origin))
  }

  // Attempt to establish authoritative authenticated Supabase session
  try {
    const adminClient = getAdminClient()
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: payload.email
    })

    if (!linkErr && linkData?.properties?.hashed_token) {
      const cookiesToSetOnRedirect: { name: string; value: string; options?: any }[] = []

      const ssrClient = createServerClient(
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
            }
          }
        }
      )

      const { error: otpError } = await ssrClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink'
      })

      if (!otpError) {
        const redirectResponse = NextResponse.redirect(new URL('/client/dashboard', origin))
        cookiesToSetOnRedirect.forEach(({ name, value, options }) => {
          redirectResponse.cookies.set(name, value, options)
        })
        return redirectResponse
      }

      if (linkData.properties.action_link) {
        return NextResponse.redirect(new URL(linkData.properties.action_link))
      }
    }
  } catch (err: any) {
    console.warn('[Claim Auth Warning]', err.message)
  }

  // Fallback: direct redirect to client dashboard
  return NextResponse.redirect(new URL('/client/dashboard', origin))
}
