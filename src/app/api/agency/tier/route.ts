import { NextRequest, NextResponse } from 'next/server'
import { updateAgencySubscriptionTier } from '@/lib/agency/agency-service'
import { AgencyTier } from '@/lib/agency/agency-types'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { agencyId, tier } = body

    if (!tier) {
      return NextResponse.json(
        { error: 'Tier is required (starter_3, growth_10, scale_25, dominance_50)' },
        { status: 400 }
      )
    }

    if (!agencyId || agencyId === 'lokal-media-house' || agencyId === 'agency-partner') {
      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const adminSupabase = createAdminClient()
          const { data: agency } = await adminSupabase
            .from('partner_agencies')
            .select('id, slug')
            .or(`primary_owner_id.eq.${user.id},contact_email.eq.${user.email}`)
            .maybeSingle()
          if (agency) {
            agencyId = agency.id
          }
        }
      } catch (authErr) {
        console.warn('[AGENCY TIER API] Auth error:', authErr)
      }
    }

    const updatedOverview = await updateAgencySubscriptionTier(agencyId || 'agency-partner', tier as AgencyTier)

    return NextResponse.json({
      success: true,
      message: `Successfully subscribed to ${tier}`,
      overview: updatedOverview
    })
  } catch (error: any) {
    console.error('[AGENCY TIER SELECTION API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update agency subscription tier' },
      { status: 422 }
    )
  }
}
