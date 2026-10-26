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
    let linkRes = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: payload.email,
      options: {
        redirectTo: `${origin}/client/dashboard`
      }
    })

    // If user was not found, create user and retry generateLink
    if (linkRes.error?.message?.toLowerCase().includes('not found')) {
      try {
        await adminClient.auth.admin.createUser({
          id: payload.userId,
          email: payload.email,
          email_confirm: true,
          user_metadata: {
            org_id: payload.orgId,
            is_placeholder_email: payload.email.endsWith('@claim.captodesk.com')
          }
        })
        linkRes = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: payload.email,
          options: {
            redirectTo: `${origin}/client/dashboard`
          }
        })
      } catch (createErr: any) {
        console.warn('[Claim User Provision Warning]', createErr.message)
      }
    }

    const { data: linkData, error: linkErr } = linkRes

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

      const otpType = (linkData.properties.verification_type as any) || 'magiclink'
      const { error: otpError } = await ssrClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: otpType
      })

      if (!otpError) {
        // Record claim milestone timestamp and audit log
        try {
          await adminClient
            .from('organizations')
            .update({
              claimed_at: new Date().toISOString()
            })
            .eq('id', payload.orgId)
            .is('claimed_at', null)

          await adminClient.from('activity_logs').insert({
            org_id: payload.orgId,
            event_type: 'security.claim_link_opened',
            description: `Workspace owner opened 1-tap claim link (${payload.email})`,
            metadata: {
              user_id: payload.userId,
              email: payload.email,
              timestamp: new Date().toISOString()
            }
          })
        } catch (claimLogErr: any) {
          console.warn('[Claim Log Non-fatal Warning]', claimLogErr?.message)
        }

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

  // Fallback: redirect to login if session could not be established
  return NextResponse.redirect(new URL('/client/login?error=claim_auth_failed', origin))
}
