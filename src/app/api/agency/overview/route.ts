import { NextRequest, NextResponse } from 'next/server'
import { getAgencyPortfolioOverview } from '@/lib/agency/agency-service'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryAgency = searchParams.get('agency')

    let agencyIdentifier = queryAgency

    // If no agency explicitly provided in query, look up authenticated user
    if (!agencyIdentifier) {
      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const adminSupabase = createAdminClient()
          // Check if user already owns an agency
          const { data: existingAgency } = await adminSupabase
            .from('partner_agencies')
            .select('id, slug')
            .or(`primary_owner_id.eq.${user.id},contact_email.eq.${user.email}`)
            .maybeSingle()

          if (existingAgency) {
            agencyIdentifier = existingAgency.slug || existingAgency.id
          } else {
            // First-time sign-up! Create their brand new partner agency with pending subscription
            const emailPrefix = user.email ? user.email.split('@')[0] : 'agency'
            const cleanName = user.user_metadata?.full_name
              ? `${user.user_metadata.full_name} Agency`
              : `${emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)} Agency`
            const baseSlug = `${emailPrefix}-agency`.toLowerCase().replace(/[^a-z0-9-]/g, '')
            const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`

            const { data: newAgency, error: createErr } = await adminSupabase
              .from('partner_agencies')
              .insert({
                name: cleanName,
                slug: uniqueSlug,
                contact_email: user.email || 'partner@agency.com',
                primary_owner_id: user.id,
                total_slots: 0,
                subscription_tier: 'none',
                subscription_status: 'pending_subscription'
              })
              .select('id, slug')
              .single()

            if (!createErr && newAgency) {
              agencyIdentifier = newAgency.slug || newAgency.id
            }
          }
        }
      } catch (authErr) {
        console.warn('[AGENCY OVERVIEW] Auth check warning:', authErr)
      }
    }

    const overview = await getAgencyPortfolioOverview(agencyIdentifier || 'agency-partner')

    return NextResponse.json(overview, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error: any) {
    console.error('[AGENCY OVERVIEW API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch agency portfolio overview' },
      { status: 500 }
    )
  }
}
