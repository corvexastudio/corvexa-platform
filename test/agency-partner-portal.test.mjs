import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  AGENCY_TIER_CAPACITIES,
  DEFAULT_DEMO_AGENCY,
  getAgencyPortfolioOverview,
  deployClientToAgencySlot,
  getAgencyAttributionReport,
  updateAgencySubscriptionTier
} from '../src/lib/agency/agency-service.ts'
import {
  AGENCY_TIERS_CONFIG,
  AGENCY_TIERS_LIST,
  getAgencyTierConfig
} from '../src/lib/agency/agency-types.ts'

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
            }),
            eq: () => ({
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
            }),
            eq: () => ({
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
            }),
            eq: () => ({
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
      if (table === 'appointments') {
        return {
          select: () => ({
            in: () => ({
              gte: async () => ({
                data: [
                  {
                    id: 'apt-1',
                    org_id: 'org-1',
                    source: 'booking_page',
                    utm_source: 'google-ads',
                    utm_campaign: 'hvac-emergency-repair',
                    utm_medium: 'cpc',
                    status: 'completed',
                    created_at: new Date().toISOString()
                  }
                ],
                error: null
              }),
              eq: () => ({ gte: async () => ({ data: [], error: null }) })
            })
          })
        }
      }
      if (table === 'jobs') {
        return {
          select: () => ({
            in: () => ({
              gte: async () => ({
                data: [
                  {
                    id: 'job-1',
                    org_id: 'org-1',
                    appointment_id: 'apt-1',
                    status: 'completed',
                    created_at: new Date().toISOString()
                  }
                ],
                error: null
              }),
              eq: () => ({ gte: async () => ({ data: [], error: null }) })
            })
          })
        }
      }
      if (table === 'invoices') {
        return {
          select: () => ({
            in: () => ({
              gte: async () => ({
                data: [
                  { id: 'inv-1', org_id: 'org-1', job_id: 'job-1', total: 2400, status: 'paid', amount_paid: 2400, created_at: new Date().toISOString() }
                ],
                error: null
              }),
              eq: () => ({
                gte: async () => ({
                  data: [
                    { id: 'inv-1', org_id: 'org-1', job_id: 'job-1', total: 2400, status: 'paid', amount_paid: 2400, created_at: new Date().toISOString() }
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
  assert.equal(attribution.length >= 1, true)
  
  const googleAds = attribution.find(a => a.utm_source === 'google-ads')
  assert.ok(googleAds)
  assert.equal(googleAds.client_name, 'Precision HVAC')
  assert.equal(googleAds.utm_campaign, 'hvac-emergency-repair')
  assert.equal(googleAds.bookings_count, 1)
  assert.equal(googleAds.completed_jobs, 1)
  assert.equal(googleAds.invoiced_revenue, 2400)
})

test('Proxy Architecture: Subdomain routing includes agency.captodesk.com and /agency with unauthenticated login guard', () => {
  const proxyPath = path.resolve(import.meta.dirname || process.cwd(), '../src/proxy.ts')
  const fallbackPath = path.resolve(process.cwd(), 'src/proxy.ts')
  const resolved = fs.existsSync(proxyPath) ? proxyPath : fallbackPath
  const proxyContent = fs.readFileSync(resolved, 'utf-8')
  assert.ok(proxyContent.includes("hostname.startsWith('agency.')"))
  assert.ok(proxyContent.includes("pathname.startsWith('/agency')"))
  assert.ok(proxyContent.includes('/agency/dashboard'))
  assert.ok(proxyContent.includes("user ? '/dashboard' : '/login'"))
  assert.ok(proxyContent.includes('/agency/login'))
  assert.ok(proxyContent.includes("url.searchParams.has('code')"))
})

test('Agency Tier Catalog: Strategy A flagship tiers exported with non-hardcoded pricing and slot capacities', () => {
  assert.equal(AGENCY_TIERS_LIST.length, 3)
  
  const starter = getAgencyTierConfig('starter_3')
  assert.equal(starter.name, 'Starter 3-Pack')
  assert.equal(starter.slots, 3)
  assert.equal(starter.price, 149)
  assert.equal(starter.costPerSlot, 49.67)

  const growth = getAgencyTierConfig('growth_10')
  assert.equal(growth.name, 'Growth 10-Pack')
  assert.equal(growth.slots, 10)
  assert.equal(growth.price, 399)
  assert.equal(growth.costPerSlot, 39.9)

  const scale = getAgencyTierConfig('scale_25')
  assert.equal(scale.name, 'Scale 25+ Pack')
  assert.equal(scale.slots, 25)
  assert.equal(scale.price, 899)
  assert.equal(scale.costPerSlot, 35.96)

  // Backwards compatibility legacy tier
  const dominance = getAgencyTierConfig('dominance_50')
  assert.equal(dominance.slots, 50)
  assert.equal(dominance.price, 1750)
})

test('Agency Tier Switching: Can upgrade or select plan dynamically', async () => {
  let updatedTier = null
  let updatedSlots = null

  const mockSupabase = {
    from: (table) => {
      if (table === 'partner_agencies') {
        return {
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({
                data: {
                  ...DEFAULT_DEMO_AGENCY,
                  subscription_tier: updatedTier || 'growth_10',
                  total_slots: updatedSlots || 10
                },
                error: null
              })
            }),
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  ...DEFAULT_DEMO_AGENCY,
                  subscription_tier: updatedTier || 'growth_10',
                  total_slots: updatedSlots || 10
                },
                error: null
              })
            })
          }),
          update: (payload) => {
            updatedTier = payload.subscription_tier
            updatedSlots = payload.total_slots
            return {
              or: async () => ({ data: null, error: null }),
              eq: async () => ({ data: null, error: null })
            }
          }
        }
      }
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null })
            })
          })
        }
      }
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
  }

  // Switch to Scale 25-Pack
  const result = await updateAgencySubscriptionTier('agency-partner', 'scale_25', mockSupabase)
  assert.equal(updatedTier, 'scale_25')
  assert.equal(updatedSlots, 25)
  assert.equal(result.total_slots, 25)

  // Switch to Dominance 50-Pack
  const result50 = await updateAgencySubscriptionTier('agency-partner', 'dominance_50', mockSupabase)
  assert.equal(updatedTier, 'dominance_50')
  assert.equal(updatedSlots, 50)
  assert.equal(result50.total_slots, 50)
})

test('Agency Tier Downgrade: Prevents switching if active clients exceed target capacity', async () => {
  const mockSupabaseWithOccupancy = {
    from: (table) => {
      if (table === 'partner_agencies') {
        return {
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({
                data: {
                  ...DEFAULT_DEMO_AGENCY,
                  subscription_tier: 'growth_10',
                  total_slots: 10
                },
                error: null
              })
            }),
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  ...DEFAULT_DEMO_AGENCY,
                  subscription_tier: 'growth_10',
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
                // 5 active clients deployed
                data: [
                  { id: '1', name: 'Org 1', industry: 'plumbing' },
                  { id: '2', name: 'Org 2', industry: 'hvac' },
                  { id: '3', name: 'Org 3', industry: 'roofing' },
                  { id: '4', name: 'Org 4', industry: 'electrical' },
                  { id: '5', name: 'Org 5', industry: 'pest' }
                ],
                error: null
              })
            })
          })
        }
      }
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
  }

  // Downgrade to starter_3 (capacity 3) when 5 clients are active must throw
  await assert.rejects(
    async () => {
      await updateAgencySubscriptionTier('agency-partner', 'starter_3', mockSupabaseWithOccupancy)
    },
    /Cannot switch to Starter 3-Pack \(3 slots\): Your agency currently has 5 active client slots deployed/
  )
})

test('Agency Onboarding: First-time sign-up starts in pending_subscription with all plans available and 0 active slots', async () => {
  const newAgencyMockSupabase = {
    from: (table) => {
      if (table === 'partner_agencies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  ...DEFAULT_DEMO_AGENCY,
                  subscription_status: 'pending_subscription',
                  subscription_tier: 'none',
                  total_slots: 0
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
              order: async () => ({ data: [], error: null })
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

  const overview = await getAgencyPortfolioOverview('new-agency', newAgencyMockSupabase)
  assert.equal(overview.total_slots, 0)
  assert.equal(overview.used_slots, 0)
  assert.equal(overview.agency.subscription_status, 'pending_subscription')
  assert.equal(overview.agency.subscription_tier, 'none')
})


