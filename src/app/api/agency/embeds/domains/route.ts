import { NextRequest, NextResponse } from 'next/server'
import { getAgencyContext } from '@/lib/agency/agency-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getContractorEmbedDomains,
  addContractorEmbedDomain,
  revokeContractorEmbedDomain
} from '@/lib/agency/agency-service'
import { validateAndNormalizeDomain } from '@/lib/agency/embed-domain-sanitizer'

export const dynamic = 'force-dynamic'

/**
 * Authorize that the current authenticated caller (agency owner, contractor owner, or super admin)
 * is permitted to view or manage embed domains for the specified organization ID.
 */
async function verifyOrgAccess(
  orgId: string,
  request: NextRequest,
  queryAgency?: string | null
): Promise<{ allowed: boolean; agencyId?: string; userId?: string; error?: string; status?: number }> {
  const supabase = createAdminClient()

  // 1. Verify organization exists and resolve its managing partner agency
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, partner_agency_id')
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr || !org) {
    return { allowed: false, error: 'Contractor organization not found', status: 404 }
  }

  // 2. Check if caller has agency context
  const authResult = await getAgencyContext(queryAgency)
  if (authResult.ok) {
    const { agency, user, isSuperAdmin } = authResult
    if (isSuperAdmin) {
      return { allowed: true, agencyId: agency?.id, userId: user?.id }
    }
    // Agency must be the managing partner agency of this contractor organization
    if (org.partner_agency_id === agency.id) {
      return { allowed: true, agencyId: agency.id, userId: user?.id }
    }
    return {
      allowed: false,
      error: 'Forbidden: You do not have permission to manage domains for this contractor',
      status: 403
    }
  }

  return { allowed: false, error: 'Unauthorized: Authentication required', status: 401 }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId') || searchParams.get('organizationId')
    const queryAgency = searchParams.get('agency')

    if (!orgId) {
      return NextResponse.json({ error: 'Missing required parameter: orgId' }, { status: 400 })
    }

    const access = await verifyOrgAccess(orgId, request, queryAgency)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status || 403 })
    }

    const domains = await getContractorEmbedDomains(orgId)

    return NextResponse.json({ domains }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error: any) {
    console.error('[EMBED DOMAINS GET ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch embed domains' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryAgency = searchParams.get('agency')

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    const orgId = body.orgId || body.organizationId
    if (!orgId || typeof orgId !== 'string') {
      return NextResponse.json({ error: 'Valid contractor organization ID is required' }, { status: 400 })
    }

    const rawDomain = body.domain
    if (!rawDomain || typeof rawDomain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    const validation = validateAndNormalizeDomain(rawDomain)
    if (!validation.isValid || !validation.normalized) {
      return NextResponse.json({ error: validation.error || 'Invalid domain format' }, { status: 400 })
    }

    const access = await verifyOrgAccess(orgId, request, queryAgency)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status || 403 })
    }

    const created = await addContractorEmbedDomain(orgId, validation.normalized, access.userId)

    return NextResponse.json({ success: true, domain: created }, { status: 201 })
  } catch (error: any) {
    console.error('[EMBED DOMAINS POST ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to authorize embed domain' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryAgency = searchParams.get('agency')

    let orgId = searchParams.get('orgId') || searchParams.get('organizationId')
    let domainOrId = searchParams.get('domainId') || searchParams.get('domain')

    if (!orgId || !domainOrId) {
      try {
        const body = await request.json()
        orgId = orgId || body.orgId || body.organizationId
        domainOrId = domainOrId || body.domainId || body.domain
      } catch {
        // Body was optional if query parameters were provided
      }
    }

    if (!orgId || !domainOrId) {
      return NextResponse.json(
        { error: 'Missing required parameters: organizationId and domain/domainId' },
        { status: 400 }
      )
    }

    const access = await verifyOrgAccess(orgId, request, queryAgency)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status || 403 })
    }

    const result = await revokeContractorEmbedDomain(orgId, domainOrId)
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to revoke domain' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Domain authorization revoked' })
  } catch (error: any) {
    console.error('[EMBED DOMAINS DELETE ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to revoke embed domain' },
      { status: 500 }
    )
  }
}
