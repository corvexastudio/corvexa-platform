import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { createClaimToken } from '@/lib/security/claim-token'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id } = await params
  const { origin } = new URL(request.url)
  const supabase = tenantResult.supabase

  try {
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (orgErr || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Find owner profile
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', id)

    let owner = (profiles || []).find(p => p.role === 'owner') || (profiles || [])[0]

    let userId = owner?.id || crypto.randomUUID()
    let effectiveEmail = owner?.email || `phone.${(org.owner_phone || '').replace(/\D/g, '')}@claim.captodesk.com`
    let ownerName = owner?.full_name || `${org.name} Owner`

    const claimToken = createClaimToken({
      userId,
      email: effectiveEmail,
      orgId: org.id
    })

    const claimUrl = `${origin}/claim/${claimToken}`
    const publicBookingUrl = `${origin}/book/${org.slug}`
    const welcomeSmsText = `Hey ${ownerName}! I just set up the free online booking page for ${org.name} so customers on Google Maps can book slots directly: ${publicBookingUrl} - Tap this link on your cell phone to open your dashboard & test your practice job (no password needed): ${claimUrl}`

    return NextResponse.json({
      success: true,
      organization: org,
      owner: {
        id: userId,
        email: effectiveEmail,
        fullName: ownerName,
        phone: owner?.phone || org.owner_phone
      },
      claimUrl,
      publicBookingUrl,
      welcomeSmsText
    })
  } catch (err: any) {
    console.error('[Admin Tenant Claim Kit Error]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate claim kit' },
      { status: 500 }
    )
  }
}
