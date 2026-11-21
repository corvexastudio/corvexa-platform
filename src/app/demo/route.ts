import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateProfileCache } from '@/lib/security/tenant-context'

export const dynamic = 'force-dynamic'

const DEMO_EMAIL = 'demo@captodesk.com'
const DEMO_USER_ID = '7280f4fd-3368-4a14-9694-d7e40206754e'

/**
 * Deterministic mapping of supported trade parameters to their verified synthetic demo organizations.
 * Prevents PostgREST PGRST116 multiple-row query failures and guarantees accurate trade routing.
 */
const DEMO_TRADE_ORGS: Record<string, { id: string; slug: string; name: string }> = {
  // Auto Detailing
  'detailing': {
    id: '57e198ff-935e-4408-b7fb-6a85a4f8d20c',
    slug: 'auto-detailing',
    name: 'CaptoDesk Auto Detailing Demo'
  },
  'auto-detailing': {
    id: '57e198ff-935e-4408-b7fb-6a85a4f8d20c',
    slug: 'auto-detailing',
    name: 'CaptoDesk Auto Detailing Demo'
  },
  'auto_detailing': {
    id: '57e198ff-935e-4408-b7fb-6a85a4f8d20c',
    slug: 'auto-detailing',
    name: 'CaptoDesk Auto Detailing Demo'
  },
  // Plumbing
  'plumbing': {
    id: '3776e1c0-0271-4ebf-a465-3e1097fce1d4',
    slug: 'plumbing',
    name: 'CaptoDesk Plumbing & Drain Demo'
  },
  'plumbing-and-drain': {
    id: '3776e1c0-0271-4ebf-a465-3e1097fce1d4',
    slug: 'plumbing',
    name: 'CaptoDesk Plumbing & Drain Demo'
  },
  // HVAC
  'hvac': {
    id: '890ef758-fb2c-4438-9841-d0b5642861cd',
    slug: 'hvac',
    name: 'CaptoDesk HVAC & Heating Demo'
  },
  'hvac-and-heating': {
    id: '890ef758-fb2c-4438-9841-d0b5642861cd',
    slug: 'hvac',
    name: 'CaptoDesk HVAC & Heating Demo'
  },
  // Roofing
  'roofing': {
    id: 'c01902e5-ef7c-40ef-9d11-982c74121650',
    slug: 'roofing',
    name: 'CaptoDesk Roofing & Gutters Demo'
  },
  'roofing-and-gutters': {
    id: 'c01902e5-ef7c-40ef-9d11-982c74121650',
    slug: 'roofing',
    name: 'CaptoDesk Roofing & Gutters Demo'
  },
  // Electrical
  'electrical': {
    id: '3e21cf6a-9821-4419-948f-db62cf976503',
    slug: 'electrical',
    name: 'CaptoDesk Electrical Services Demo'
  },
  'electrical-services': {
    id: '3e21cf6a-9821-4419-948f-db62cf976503',
    slug: 'electrical',
    name: 'CaptoDesk Electrical Services Demo'
  },
  // Landscaping
  'landscaping': {
    id: '65b29a4a-446d-4dca-aa40-fe68310c1bd4',
    slug: 'landscaping',
    name: 'CaptoDesk Landscaping & Lawn Demo'
  },
  // Cleaning
  'cleaning': {
    id: 'cb9372fc-48ed-4846-8e77-96a4e784addc',
    slug: 'cleaning',
    name: 'CaptoDesk House Cleaning Demo'
  },
  // Pressure Washing
  'pressure-washing': {
    id: '40308b5d-43b3-47bf-b647-32b11f107198',
    slug: 'pressure-washing',
    name: 'CaptoDesk Pressure Washing Demo'
  },
}

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
      const cleanKey = tradeParam.toLowerCase().trim()
      const normalizedSlug = cleanKey.replace(/_/g, '-')

      let targetOrgId: string | null = null

      if (DEMO_TRADE_ORGS[cleanKey]) {
        targetOrgId = DEMO_TRADE_ORGS[cleanKey].id
      } else if (DEMO_TRADE_ORGS[normalizedSlug]) {
        targetOrgId = DEMO_TRADE_ORGS[normalizedSlug].id
      } else {
        // Fallback: search organizations with .limit(1) to prevent PostgREST PGRST116 errors
        const { data: matchedOrgs } = await supabase
          .from('organizations')
          .select('id, slug, name')
          .or(`slug.eq.${normalizedSlug},industry.eq.${cleanKey}`)
          .limit(1)

        if (matchedOrgs && matchedOrgs.length > 0) {
          targetOrgId = matchedOrgs[0].id
        }
      }

      if (targetOrgId) {
        await supabase
          .from('profiles')
          .update({ org_id: targetOrgId })
          .eq('email', DEMO_EMAIL)

        invalidateProfileCache(DEMO_USER_ID)
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
    
    // Add cache-busting timestamp and trade context to destination
    const separator = destination.includes('?') ? '&' : '?'
    const freshDestination = `${destination}${separator}t=${Date.now()}${tradeParam ? `&trade=${encodeURIComponent(tradeParam)}` : ''}`
    callbackUrl.searchParams.set('next', freshDestination)

    return NextResponse.redirect(callbackUrl)
  } catch (err) {
    console.error('[DEMO_AUTH_FATAL]', err)
    const errorLoginPath = targetOrigin.includes('app.') ? '/login?error=demo_unavailable' : '/client/login?error=demo_unavailable'
    return NextResponse.redirect(new URL(errorLoginPath, targetOrigin))
  }
}
