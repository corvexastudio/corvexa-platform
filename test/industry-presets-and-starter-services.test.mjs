import test from 'node:test'
import assert from 'node:assert/strict'
import { INDUSTRY_PRESETS, INDUSTRY_LIST, getIndustryPreset } from '../src/lib/constants/industries.ts'
import { POST as onboardingHandler } from '../src/app/api/onboarding/route.ts'
import { PATCH as organizationPatchHandler } from '../src/app/api/client/organization/route.ts'

test('1. Industry Catalog: All 21 US small business trade presets are registered', () => {
  const expectedKeys = [
    'hvac',
    'plumbing',
    'electrical',
    'roofing',
    'landscaping',
    'cleaning',
    'pest_control',
    'auto_detailing',
    'handyman',
    'appliance_repair',
    'painting',
    'garage_doors',
    'locksmith',
    'pressure_washing',
    'carpet_cleaning',
    'tree_service',
    'fencing_decking',
    'general_contracting',
    'pool_maintenance',
    'window_services',
    'general'
  ]

  assert.strictEqual(INDUSTRY_LIST.length, 21, 'Must have all 21 industry presets')

  for (const key of expectedKeys) {
    const preset = INDUSTRY_PRESETS[key]
    assert.ok(preset, `Preset '${key}' must exist`)
    assert.strictEqual(preset.id, key)
    assert.ok(preset.name.length > 0)
    assert.ok(preset.icon.length > 0)
    assert.ok(preset.badge.length > 0)
    assert.ok(preset.description.length > 0)
  }
})

test('2. Industry Starter Services: Every preset has 3 realistic services with durations and valid prices', () => {
  for (const preset of INDUSTRY_LIST) {
    assert.strictEqual(preset.services.length, 3, `Industry '${preset.id}' must provide exactly 3 starter services`)

    for (const svc of preset.services) {
      assert.ok(svc.name.length > 3, `Service name '${svc.name}' must be descriptive`)
      assert.ok(svc.duration_minutes >= 15, `Duration for '${svc.name}' must be at least 15 min`)
      assert.ok(svc.price === null || svc.price >= 0, `Price for '${svc.name}' must be null or non-negative`)
      assert.strictEqual(typeof svc.requires_address, 'boolean')
      assert.strictEqual(svc.is_active, true)
      assert.ok(svc.sort_order >= 1)
    }
  }
})

test('3. Industry Templates: Every trade preset includes tailored missed-call SMS templates with {booking_url}', () => {
  for (const preset of INDUSTRY_LIST) {
    const { auto_reply, after_hours, busy } = preset.templates
    assert.ok(auto_reply.includes('{business_name}'), `${preset.id} auto_reply must contain {business_name}`)
    assert.ok(auto_reply.includes('{booking_url}'), `${preset.id} auto_reply must contain {booking_url}`)

    assert.ok(after_hours.includes('{business_name}'), `${preset.id} after_hours must contain {business_name}`)
    assert.ok(after_hours.includes('{booking_url}'), `${preset.id} after_hours must contain {booking_url}`)

    assert.ok(busy.includes('{business_name}'), `${preset.id} busy must contain {business_name}`)
    assert.ok(busy.includes('{booking_url}'), `${preset.id} busy must contain {booking_url}`)
  }
})

test('4. getIndustryPreset: Correctly looks up preset or defaults to general', () => {
  assert.strictEqual(getIndustryPreset('HVAC').id, 'hvac')
  assert.strictEqual(getIndustryPreset('plumbing').id, 'plumbing')
  assert.strictEqual(getIndustryPreset('cleaning').id, 'cleaning')
  assert.strictEqual(getIndustryPreset('unknown_trade').id, 'general')
  assert.strictEqual(getIndustryPreset(null).id, 'general')
  assert.strictEqual(getIndustryPreset(undefined).id, 'general')
  assert.strictEqual(getIndustryPreset('').id, 'general')
})

test('5. Onboarding API: Seeds 3 industry-tailored services when industry is specified', async () => {
  const insertedServices = []
  let insertedOrg = null

  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'usr-hvac-owner', email: 'owner@hvacpros.com', user_metadata: { full_name: 'Dan Frost' } } },
        error: null
      })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          limit: async () => ({ data: [], error: null }),
          single: async () => ({ data: { id: 'usr-hvac-owner', org_id: null }, error: null })
        }),
        limit: async () => ({ data: [], error: null })
      }),
      insert: async (payload) => {
        if (table === 'organizations') {
          insertedOrg = payload
        }
        return { data: payload, error: null }
      },
      upsert: async (payload) => {
        if (table === 'services') {
          insertedServices.push(payload)
        }
        return { data: payload, error: null }
      }
    })
  }

  const req = new Request('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Frost HVAC Experts',
      industry: 'hvac',
      phone: '555-432-8765'
    })
  })

  const res = await onboardingHandler(req, { customSupabase: mockSupabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)

  // Verify Organization received industry and HVAC tailored templates
  assert.ok(insertedOrg, 'Organization should have been created')
  assert.strictEqual(insertedOrg.industry, 'hvac')
  assert.ok(insertedOrg.auto_reply_template.includes('{booking_url}'))
  assert.ok(insertedOrg.after_hours_template.includes('heating and cooling team'))

  // Verify 3 HVAC starter services were seeded
  assert.strictEqual(insertedServices.length, 3, 'Should seed 3 starter services for HVAC')
  const serviceNames = insertedServices.map(s => s.name)
  assert.ok(serviceNames.includes('AC & Heating Diagnostic Inspection'))
  assert.ok(serviceNames.includes('Seasonal HVAC Precision Tune-Up'))
  assert.ok(serviceNames.includes('Emergency Heating & AC Repair Service'))
})

test('6. Onboarding API: Handles legacy DB schema missing "industry" column without failing (Fallback)', async () => {
  let attemptCount = 0
  let fallbackInserted = null

  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'usr-legacy-db', email: 'legacy@example.com' } },
        error: null
      })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
          limit: async () => ({ data: [] }),
          single: async () => ({ data: null })
        }),
        limit: async () => ({ data: [] })
      }),
      insert: async (payload) => {
        if (table === 'organizations') {
          attemptCount++
          if (attemptCount === 1) {
            // First attempt fails with 42703 (undefined column: industry)
            return {
              data: null,
              error: { code: '42703', message: 'column "industry" of relation "organizations" does not exist' }
            }
          }
          fallbackInserted = payload
          return { data: payload, error: null }
        }
        return { data: payload, error: null }
      },
      upsert: async () => ({ error: null })
    })
  }

  const req = new Request('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Legacy Electric',
      industry: 'electrical'
    })
  })

  const res = await onboardingHandler(req, { customSupabase: mockSupabase })
  assert.strictEqual(res.status, 200, 'Must succeed despite legacy schema')
  assert.ok(fallbackInserted, 'Should insert stripped payload without industry column')
  assert.strictEqual(fallbackInserted.industry, undefined, 'Stripped payload must not have industry key')
})
