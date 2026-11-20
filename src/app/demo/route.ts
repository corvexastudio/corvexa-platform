import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateProfileCache } from '@/lib/security/tenant-context'

export const dynamic = 'force-dynamic'

const DEMO_EMAIL = 'demo@captodesk.com'

/**
 * Public Frictionless Demo Entrypoint
 * Allows prospects to experience the full CaptoDesk owner workspace without signing in.
 * Strictly locked to the official synthetic demo account (demo@captodesk.com).
 * Dynamically switches demo workspace organization to match target trade if ?trade= or ?industry= is passed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const view = searchParams.get('view')
  const tradeParam = searchParams.get('trade') || searchParams.get('industry')
  
  const targetOrigin = (origin.includes('captodesk.com') && !origin.includes('localhost'))
    ? 'https://app.captodesk.com'
    : origin

  let destination = targetOrigin.includes('app.') ? '/dashboard' : '/client/dashboard'
  if (view === 'field') destination = targetOrigin.includes('app.') ? '/field' : '/client/field'
  if (view === 'inbox') destination = targetOrigin.includes('app.') ? '/inbox' : '/client/inbox'
  if (view === 'calendar') destination = targetOrigin.includes('app.') ? '/calendar' : '/client/calendar'
  if (view === 'jobs') destination = targetOrigin.includes('app.') ? '/jobs' : '/client/jobs'

  try {
    const supabase = createAdminClient()

    // 1. Dynamic Trade Switching: Switch demo owner profile to target trade org if specified
    if (tradeParam) {
      const normalizedSlug = tradeParam.toLowerCase().replace(/_/g, '-')
      const { data: tradeOrg } = await supabase
        .from('organizations')
        .select('id, slug, name')
        .or(`slug.eq.${normalizedSlug},industry.eq.${tradeParam.toLowerCase()}`)
        .maybeSingle()

      if (tradeOrg) {
        const { data: usersData } = await supabase.auth.admin.listUsers()
        const demoUser = usersData?.users?.find((u) => u.email === DEMO_EMAIL)
        if (demoUser) {
          await supabase
            .from('profiles')
            .update({ org_id: tradeOrg.id })
            .eq('id', demoUser.id)
          invalidateProfileCache(demoUser.id)
        }
      }
    }

    // 2. Generate single-use magic link token strictly for the demo owner
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: DEMO_EMAIL
    })

    if (error || !data?.properties?.hashed_token) {
      console.error('[DEMO_AUTH_ERROR] Failed to generate demo magic link:', error)
      const errorLoginPath = targetOrigin.includes('app.') ? '/login?error=demo_unavailable' : '/client/login?error=demo_unavailable'
      return NextResponse.redirect(new URL(errorLoginPath, targetOrigin))
    }

    const tokenHash = data.properties.hashed_token
    const callbackUrl = new URL('/client/auth/callback', targetOrigin)
    callbackUrl.searchParams.set('token_hash', tokenHash)
    callbackUrl.searchParams.set('type', 'magiclink')
    callbackUrl.searchParams.set('next', destination)

    return NextResponse.redirect(callbackUrl)
  } catch (err) {
    console.error('[DEMO_AUTH_FATAL]', err)
    const errorLoginPath = targetOrigin.includes('app.') ? '/login?error=demo_unavailable' : '/client/login?error=demo_unavailable'
    return NextResponse.redirect(new URL(errorLoginPath, targetOrigin))
  }
}
