import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const DEMO_EMAIL = 'demo@captodesk.com'

/**
 * Public Frictionless Demo Entrypoint
 * Allows prospects to experience the full CaptoDesk owner workspace without signing in.
 * Strictly locked to the official synthetic demo account (demo@captodesk.com).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const view = searchParams.get('view')
  
  let destination = '/client/dashboard'
  if (view === 'field') destination = '/client/field'
  if (view === 'inbox') destination = '/client/inbox'
  if (view === 'calendar') destination = '/client/calendar'
  if (view === 'jobs') destination = '/client/jobs'

  try {
    const supabase = createAdminClient()

    // Generate single-use magic link token strictly for the demo owner
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: DEMO_EMAIL
    })

    if (error || !data?.properties?.hashed_token) {
      console.error('[DEMO_AUTH_ERROR] Failed to generate demo magic link:', error)
      return NextResponse.redirect(new URL('/client/login?error=demo_unavailable', origin))
    }

    const tokenHash = data.properties.hashed_token
    const callbackUrl = new URL('/client/auth/callback', origin)
    callbackUrl.searchParams.set('token_hash', tokenHash)
    callbackUrl.searchParams.set('type', 'magiclink')
    callbackUrl.searchParams.set('next', destination)

    return NextResponse.redirect(callbackUrl)
  } catch (err) {
    console.error('[DEMO_AUTH_FATAL]', err)
    return NextResponse.redirect(new URL('/client/login?error=demo_unavailable', origin))
  }
}
