import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../lib/security/tenant-context.ts'
import { getIndustryPreset, INDUSTRY_PRESETS } from '../../../../../lib/constants/industries.ts'

export interface ImportPresetRouteDependencies {
  customSupabase?: any
}

export async function POST(
  request: Request,
  contextOrDeps?: any,
  deps?: ImportPresetRouteDependencies
) {
  const actualDeps: ImportPresetRouteDependencies | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)

  // Requires tenant management permission (Owner / Admin)
  const tenantResult = await getTenantContext('org:update', actualDeps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const rawIndustry = body.industry || body.industry_id || ''

    if (!rawIndustry || typeof rawIndustry !== 'string') {
      return NextResponse.json({ error: 'Industry identifier is required.' }, { status: 400 })
    }

    const industryPreset = getIndustryPreset(rawIndustry)
    if (!industryPreset) {
      return NextResponse.json({ error: `Unknown industry preset: "${rawIndustry}"` }, { status: 400 })
    }

    // 1. Fetch existing services to prevent duplicates and calculate sort order
    const { data: existingServices, error: fetchErr } = await supabase
      .from('services')
      .select('id, name, sort_order')
      .eq('org_id', orgId)

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message || 'Failed to check existing services' }, { status: 500 })
    }

    const existingNames = new Set((existingServices || []).map((s: { name: string }) => s.name.trim().toLowerCase()))
    const maxSortOrder = (existingServices || []).reduce((max: number, s: { sort_order?: number | null }) => {
      const order = s.sort_order ?? 0
      return order > max ? order : max
    }, 0)

    // 2. Filter preset services to those not already present
    const servicesToInsert = industryPreset.services
      .filter(svc => !existingNames.has(svc.name.trim().toLowerCase()))
      .map((svc, idx) => ({
        org_id: orgId,
        name: svc.name,
        description: svc.description,
        duration_minutes: svc.duration_minutes,
        price: svc.price,
        requires_address: svc.requires_address,
        is_active: svc.is_active,
        sort_order: maxSortOrder + idx + 1
      }))

    let insertedRecords: any[] = []

    if (servicesToInsert.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('services')
        .insert(servicesToInsert)
        .select('*')

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message || 'Failed to import preset services' }, { status: 400 })
      }
      insertedRecords = inserted || []
    }

    // 3. Optionally update organization industry if not set
    try {
      await supabase
        .from('organizations')
        .update({
          industry: industryPreset.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgId)
    } catch {
      // Organization industry column update is non-fatal
    }

    return NextResponse.json({
      success: true,
      industry: industryPreset.name,
      importedCount: insertedRecords.length,
      skippedCount: industryPreset.services.length - insertedRecords.length,
      services: insertedRecords
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
