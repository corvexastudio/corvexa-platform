import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  AGENCY_TIER_CAPACITIES,
  DEFAULT_DEMO_AGENCY,
  getAgencyPortfolioOverview,
  deployClientToAgencySlot,
  getAgencyAttributionReport
} from '../src/lib/agency/agency-service.ts'

test('Agency Tier Capacities: Matches contracted slot bounds', () => {
  assert.equal(AGENCY_TIER_CAPACITIES.starter_3, 3)
  assert.equal(AGENCY_TIER_CAPACITIES.growth_10, 10)
  assert.equal(AGENCY_TIER_CAPACITIES.scale_25, 25)
  assert.equal(AGENCY_TIER_CAPACITIES.dominance_50, 50)
})

test('Agency Portfolio: Computes correct slot allocations and capacity metrics', async () => {
  const mockSupabase = {
    from: (table) => {
      if (table === 'partner_agencies') {
        return {
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({
                data: {
                  ...DEFAULT_DEMO_AGENCY,
                  total_slots: 10
                },
                error: null
              })
            })
          })
        }
      }
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'org-1', name: 'Apex Plumbing', slug: 'apex-plumbing', industry: 'plumbing', phone_number: '+12145550101', telnyx_phone_number: '+12145550101', is_missed_call_active: true, carrier_registration_status: 'verified', created_at: new Date().toISOString() },
                  { id: 'org-2', name: 'DFW Air Pro', slug: 'dfw-air-pro', industry: 'hvac', phone_number: '+14695550102', telnyx_phone_number: '+14695550102', is_missed_call_active: true, carrier_registration_status: 'verified', created_at: new Date().toISOString() },
                  { id: 'org-3', name: 'LoneStar Electric', slug: 'lonestar-electric', industry: 'electrical', phone_number: '+19725550103', telnyx_phone_number: '+19725550103', is_missed_call_active: true, carrier_registration_status: 'verified', created_at: new Date().toISOString() }
                ],
                error: null
              })
            }),
            order: () => ({
              limit: async () => ({ data: [], error: null })
            })
          })
        }
      }
      if (table === 'messages' || table === 'invoices' || table === 'appointments') {
        return {
          select: () => ({
            in: () => ({
              gte: async () => ({ data: [], error: null }),
              eq: () => ({
                gte: async () => ({ data: [], error: null })
              })
            })
          })
        }
      }
      return { select: () => ({}) }
    }
  }

  const overview = await getAgencyPortfolioOverview('lokal-media-house', mockSupabase)

  assert.equal(overview.total_slots, 10)
  assert.equal(overview.used_slots, 3)
  assert.equal(overview.available_slots, 7)
  assert.equal(overview.occupancy_rate, 30)

  // Exactly 10 slots must be generated
  assert.equal(overview.slots.length, 10)

  // First 3 slots must be active
  assert.equal(overview.slots[0].status, 'active')
  assert.equal(overview.slots[0].business_name, 'Apex Plumbing')
  assert.equal(overview.slots[1].status, 'active')
  assert.equal(overview.slots[2].status, 'active')

  // Slots 4 to 10 must be available
  assert.equal(overview.slots[3].status, 'available')
  assert.equal(overview.slots[3].organization_id, null)
  assert.equal(overview.slots[9].status, 'available')
  assert.equal(overview.slots[9].organization_id, null)
})

test('Agency Deploy Client: Enforces slot exhaustion limit', async () => {
  const fullAgencyMock = {
    from: (table) => {
      if (table === 'partner_agencies') {
        return {
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({
                data: {
                  ...DEFAULT_DEMO_AGENCY,
                  total_slots: 3
                },
                error: null
              })
            })
          })
        }
      }
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'org-1', name: 'Client 1', slug: 'c1' },
                  { id: 'org-2', name: 'Client 2', slug: 'c2' },
                  { id: 'org-3', name: 'Client 3', slug: 'c3' }
                ],
                error: null
              })
            }),
            order: () => ({ limit: async () => ({ data: [], error: null }) })
          })
        }
      }
      if (table === 'invoices') {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({
                gte: async () => ({
                  data: [
                    { id: 'inv-1', org_id: 'org-1', total: 2400, status: 'paid', created_at: new Date().toISOString() }
                  ],
                  error: null
                })
              })
            })
          })
        }
      }
      return {
        select: () => ({
          in: () => ({
            gte: async () => ({ data: [], error: null }),
            eq: () => ({ gte: async () => ({ data: [], error: null }) })
          })
        })
      }
    }
  }

  const deployResult = await deployClientToAgencySlot(
    'lokal-media-house',
    {
      businessName: 'Fourth Plumber',
      industry: 'plumbing',
      ownerName: 'Dan Green',
      ownerCellPhone: '+12145550999'
    },
    fullAgencyMock
  )

  assert.equal(deployResult.success, false)
  assert.match(deployResult.error, /exhausted all 3 allocated slots/)
})

test('Agency Attribution: Maps UTM campaign sources to client revenue', async () => {
  const mockSupabase = {
    from: (table) => {
      if (table === 'partner_agencies') {
        return {
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({
                data: { ...DEFAULT_DEMO_AGENCY, total_slots: 3 },
                error: null
              })
            })
          })
        }
      }
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'org-1', name: 'Precision HVAC', slug: 'precision-hvac', industry: 'hvac' }
                ],
                error: null
              })
            }),
            order: () => ({ limit: async () => ({ data: [], error: null }) })
          })
        }
      }
      if (table === 'invoices') {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({
                gte: async () => ({
                  data: [
                    { id: 'inv-1', org_id: 'org-1', total: 2400, status: 'paid', created_at: new Date().toISOString() }
                  ],
                  error: null
                })
              })
            })
          })
        }
      }
      return {
        select: () => ({
          in: () => ({
            gte: async () => ({ data: [], error: null }),
            eq: () => ({ gte: async () => ({ data: [], error: null }) })
          })
        })
      }
    }
  }

  const attribution = await getAgencyAttributionReport('lokal-media-house', mockSupabase)

  assert.equal(Array.isArray(attribution), true)
  assert.equal(attribution.length >= 3, true)
  
  const googleAds = attribution.find(a => a.utm_source === 'google-ads')
  assert.ok(googleAds)
  assert.equal(googleAds.client_name, 'Precision HVAC')
  assert.ok(googleAds.invoiced_revenue > 0)
})

test('Proxy Architecture: Subdomain routing includes agency.captodesk.com and /agency', () => {
  const proxyContent = fs.readFileSync(path.join(process.cwd(), 'src/proxy.ts'), 'utf-8')
  assert.ok(proxyContent.includes("hostname.startsWith('agency.')"))
  assert.ok(proxyContent.includes("pathname.startsWith('/agency')"))
  assert.ok(proxyContent.includes('/agency/dashboard'))
})
