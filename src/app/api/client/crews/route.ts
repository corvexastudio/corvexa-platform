import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { listCrews, createCrew } from '@/lib/crews/crew-manager'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('crews:view')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('include_inactive') === 'true'

  try {
    const crews = await listCrews(supabase, orgId, { includeInactive })
    return NextResponse.json({ crews })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list crews' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('crews:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const { name, colorCode, phoneNumber, serviceArea, crewLeadId, memberIds } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Crew or Van name is required' }, { status: 400 })
    }

    const result = await createCrew(supabase, {
      orgId,
      name,
      colorCode: colorCode || '#3B82F6',
      phoneNumber,
      serviceArea,
      crewLeadId,
      memberIds
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create crew' }, { status: 400 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request body' }, { status: 500 })
  }
}
