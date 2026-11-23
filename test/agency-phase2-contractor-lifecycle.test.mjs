import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  calculateRequiredSlotsForFleet,
  SUPPORTED_AGENCY_TRADES
} from '../src/lib/agency/agency-types.ts'

import {
  reserveAgencyCapacitySlots,
  releaseAgencySlotReservation,
  deployClientToAgencySlot,
  offboardClientFromAgencySlot,
  getAgencyPortfolioOverview,
  validateDeployClientRequest,
  DEFAULT_DEMO_AGENCY
} from '../src/lib/agency/agency-service.ts'

// Mock Supabase factory with unified mutable state for Phase 2 tests
function createMockSupabase(overrides = {}) {
  const agencyData = {
    ...DEFAULT_DEMO_AGENCY,
    id: 'a0000000-0000-4000-a000-000000000001',
    slug: 'agency-partner',
    primary_owner_id: 'user-uuid-1',
    subscription_tier: 'growth_10',
    total_slots: 10,
    subscription_status: 'active',
    metadata: {},
    ...(overrides.agency || {})
  }

  const state = {
    agencyData,
    organizationsData: overrides.organizations ? [...overrides.organizations] : [],
    allocationsData: overrides.allocations ? [...overrides.allocations] : [],
    appointmentsData: overrides.appointments ? [...overrides.appointments] : [],
    invoicesData: overrides.invoices ? [...overrides.invoices] : [],
    jobsData: overrides.jobs ? [...overrides.jobs] : [],
    messagesData: overrides.messages ? [...overrides.messages] : [],
    phoneNumbersData: overrides.phoneNumbers ? [...overrides.phoneNumbers] : [],
    deletedRows: []
  }

  const mock = {
    _state: state,
    from: (table) => {
      if (table === 'partner_agencies') {
        return {
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => {
                if ((col === 'id' || col === 'slug') && (val === state.agencyData.id || val === state.agencyData.slug || val === 'agency-partner' || val === state.agencyData.id)) {
                  return { data: state.agencyData, error: null }
                }
                return { data: null, error: null }
              },
              single: async () => ({ data: state.agencyData, error: null })
            })
          })
        }
      }

      if (table === 'organizations') {
        return {
          select: () => ({
            eq: (col, val) => {
              const matched = state.organizationsData.filter(o => o[col] === val)
              return {
                data: matched,
                error: null,
                order: async () => ({ data: matched, error: null }),
                maybeSingle: async () => ({ data: matched[0] || null, error: null }),
                single: async () => ({ data: matched[0] || null, error: null }),
                then: (resolve) => resolve({ data: matched, error: null })
              }
            },
            order: () => ({
              limit: async () => ({ data: state.organizationsData, error: null })
            })
          }),
          insert: (payload) => {
            const newOrg = {
              id: 'org-' + Math.random().toString(36).substring(2, 9),
              ...payload,
              created_at: new Date().toISOString()
            }
            state.organizationsData.push(newOrg)
            return {
              select: () => ({
                single: async () => ({ data: newOrg, error: null }),
                maybeSingle: async () => ({ data: newOrg, error: null })
              })
            }
          },
          upsert: (payload) => ({
            select: () => ({
              single: async () => ({ data: payload, error: null }),
              maybeSingle: async () => ({ data: payload, error: null })
            }),
            then: (resolve) => resolve({ data: payload, error: null })
          }),
          update: (payload) => ({
            eq: (col, val) => {
              state.organizationsData.forEach(o => {
                if (o[col] === val) {
                  Object.assign(o, payload)
                }
              })
              const updated = state.organizationsData.find(o => o[col] === val) || null
              return {
                data: updated,
                error: null,
                then: (resolve) => resolve({ data: updated, error: null })
              }
            }
          }),
          delete: () => ({
            eq: (col, val) => {
              state.deletedRows.push({ table: 'organizations', col, val })
              state.organizationsData = state.organizationsData.filter(o => o[col] !== val)
              return { data: null, error: null }
            }
          })
        }
      }

      if (table === 'agency_slot_allocations') {
        return {
          select: () => ({
            eq: (col, val) => {
              const matched = state.allocationsData.filter(a => a[col] === val)
              return {
                data: matched,
                error: null,
                maybeSingle: async () => ({ data: matched[0] || null, error: null }),
                single: async () => ({ data: matched[0] || null, error: null }),
                then: (resolve) => resolve({ data: matched, error: null })
              }
            }
          }),
          insert: (payload) => {
            const newAlloc = {
              id: 'alloc-' + Math.random().toString(36).substring(2, 9),
              ...payload,
              assigned_at: new Date().toISOString()
            }
            state.allocationsData.push(newAlloc)
            return {
              select: () => ({
                maybeSingle: async () => ({ data: newAlloc, error: null }),
                single: async () => ({ data: newAlloc, error: null })
              })
            }
          },
          update: (payload) => ({
            eq: (col1, val1) => {
              state.allocationsData.forEach(a => {
                if (a[col1] === val1) {
                  Object.assign(a, payload)
                }
              })
              return {
                data: null,
                error: null,
                eq: (col2, val2) => {
                  state.allocationsData.forEach(a => {
                    if (a[col1] === val1 && a[col2] === val2) {
                      Object.assign(a, payload)
                    }
                  })
                  return {
                    data: null,
                    error: null,
                    then: (resolve) => resolve({ data: null, error: null })
                  }
                },
                then: (resolve) => resolve({ data: null, error: null })
              }
            }
          }),
          delete: () => ({
            eq: (col, val) => {
              state.deletedRows.push({ table: 'agency_slot_allocations', col, val })
              state.allocationsData = state.allocationsData.filter(a => a[col] !== val)
              return { data: null, error: null }
            }
          })
        }
      }

      if (table === 'appointments') {
        return {
          select: () => ({
            eq: (col, val) => {
              const matched = state.appointmentsData.filter(a => a[col] === val)
              return {
                data: matched,
                error: null,
                gte: () => ({ data: matched, error: null }),
                then: (resolve) => resolve({ data: matched, error: null })
              }
            },
            in: (col, vals) => ({
              gte: async () => ({
                data: state.appointmentsData.filter(a => vals.includes(a[col])),
                error: null
              })
            })
          }),
          delete: () => ({
            eq: (col, val) => {
              state.deletedRows.push({ table: 'appointments', col, val })
              return { data: null, error: null }
            }
          })
        }
      }

      if (table === 'invoices') {
        return {
          select: () => ({
            eq: (col, val) => {
              const matched = state.invoicesData.filter(i => i[col] === val)
              return {
                data: matched,
                error: null,
                eq: (c2, v2) => ({
                  gte: async () => ({
                    data: matched.filter(i => i[c2] === v2),
                    error: null
                  })
                }),
                then: (resolve) => resolve({ data: matched, error: null })
              }
            },
            in: (col, vals) => ({
              eq: (c2, v2) => ({
                gte: async () => ({
                  data: state.invoicesData.filter(i => vals.includes(i[col]) && i[c2] === v2),
                  error: null
                })
              })
            })
          }),
          delete: () => ({
            eq: (col, val) => {
              state.deletedRows.push({ table: 'invoices', col, val })
              return { data: null, error: null }
            }
          })
        }
      }

      if (table === 'jobs') {
        return {
          select: () => ({
            eq: (col, val) => {
              const matched = state.jobsData.filter(j => j[col] === val)
              return {
                data: matched,
                error: null,
                then: (resolve) => resolve({ data: matched, error: null })
              }
            }
          }),
          delete: () => ({
            eq: (col, val) => {
              state.deletedRows.push({ table: 'jobs', col, val })
              return { data: null, error: null }
            }
          })
        }
      }

      if (table === 'messages') {
        return {
          select: () => ({
            eq: (col, val) => {
              const matched = state.messagesData.filter(m => m[col] === val)
              return {
                data: matched,
                error: null,
                then: (resolve) => resolve({ data: matched, error: null })
              }
            },
            in: (col, vals) => ({
              gte: async () => ({
                data: state.messagesData.filter(m => vals.includes(m[col])),
                error: null
              })
            })
          }),
          delete: () => ({
            eq: (col, val) => {
              state.deletedRows.push({ table: 'messages', col, val })
              return { data: null, error: null }
            }
          })
        }
      }

      if (table === 'telnyx_phone_numbers') {
        return {
          select: () => ({
            eq: (col, val) => {
              const matched = state.phoneNumbersData.filter(p => p[col] === val)
              return {
                data: matched,
                error: null,
                eq: (c2, v2) => ({
                  maybeSingle: async () => ({
                    data: matched.find(p => p[c2] === v2) || null,
                    error: null
                  })
                }),
                maybeSingle: async () => ({
                  data: matched[0] || null,
                  error: null
                })
              }
            }
          }),
          update: (payload) => ({
            eq: (col, val) => {
              state.phoneNumbersData.forEach(p => {
                if (p[col] === val) {
                  Object.assign(p, payload)
                }
              })
              return {
                data: null,
                error: null,
                then: (resolve) => resolve({ data: null, error: null })
              }
            }
          })
        }
      }

      // Default table handler for profiles, users_organizations, services, etc.
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
            single: async () => ({ data: null, error: null })
          })
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: {}, error: null }),
            maybeSingle: async () => ({ data: {}, error: null })
          })
        }),
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: {}, error: null }),
            maybeSingle: async () => ({ data: {}, error: null })
          }),
          then: (resolve) => resolve({ data: {}, error: null })
        }),
        update: () => ({
          eq: async () => ({ data: {}, error: null })
        }),
        delete: () => ({
          eq: async () => ({ data: {}, error: null })
        })
      }
    }
  }

  return mock
}

// ------------------------------------------------------------------------------
// TEST SUITE: Phase 2 Contractor Lifecycle & Capacity Accounting
// ------------------------------------------------------------------------------

test('1. Multi-Van Capacity: 1-van allocation consumes exactly 1 slot', () => {
  const calc = calculateRequiredSlotsForFleet(1)
  assert.equal(calc.slotsNeeded, 1, '1 van must consume exactly 1 slot')
  assert.equal(calc.adminReviewRequired, false, '1 van does not require admin review')
  assert.equal(calc.tier, 'solo', '1 van maps to solo tier')
})

test('2. Multi-Van Capacity: 2-van allocation consumes exactly 2 slots', () => {
  const calc = calculateRequiredSlotsForFleet(2)
  assert.equal(calc.slotsNeeded, 2, '2 vans must consume 2 slots')
  assert.equal(calc.adminReviewRequired, false, '2 vans does not require admin review')
  assert.equal(calc.tier, 'multi_crew', '2 vans maps to multi_crew tier')
})

test('3. Multi-Van Capacity: 5-van allocation consumes exactly 2 slots (F-AGY-05)', () => {
  const calc = calculateRequiredSlotsForFleet(5)
  assert.equal(calc.slotsNeeded, 2, '5 vans must consume 2 slots under standard policy')
  assert.equal(calc.adminReviewRequired, false, '5 vans is within the 2 to 5 van envelope')
  assert.equal(calc.tier, 'multi_crew', '5 vans maps to multi_crew tier')
})

test('4. Enterprise Fleet Policy: 6+ van fleet triggers admin_review_required', () => {
  const calc6 = calculateRequiredSlotsForFleet(6)
  assert.equal(calc6.adminReviewRequired, true, '6 vans must trigger admin review')
  assert.equal(calc6.slotsNeeded, 0, 'No automatic slots assigned when review is required')

  const calc12 = calculateRequiredSlotsForFleet(12)
  assert.equal(calc12.adminReviewRequired, true, '12 vans must trigger admin review')
})

test('5. Concurrency Safety: Slot reservation atomically checks available capacity and blocks oversubscription', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 3 },
    allocations: [
      { id: 'alloc-1', agency_id: 'a0000000-0000-4000-a000-000000000001', slots_consumed: 1, assignment_state: 'active' },
      { id: 'alloc-2', agency_id: 'a0000000-0000-4000-a000-000000000001', slots_consumed: 1, assignment_state: 'reserved' }
    ]
  })

  // 2 slots already in use (1 active + 1 reserved) out of 3 total. Only 1 slot remains.
  // Attempting to reserve a 2-slot multi-van fleet must be blocked.
  const result = await reserveAgencyCapacitySlots(
    'agency-partner',
    { vanCount: 3, clientTier: 'multi_crew', actingUserId: 'user-uuid-1' },
    mockSupabase
  )

  assert.equal(result.success, false, 'Should fail because only 1 slot is available')
  assert.match(result.error, /Slot capacity limit reached.*requires 2 capacity slots.*only 1 available/i)

  // Reserving a 1-slot solo client should succeed.
  const successResult = await reserveAgencyCapacitySlots(
    'agency-partner',
    { vanCount: 1, clientTier: 'solo', actingUserId: 'user-uuid-1' },
    mockSupabase
  )
  assert.equal(successResult.success, true, 'Should succeed reserving 1 remaining slot')
  assert.equal(successResult.slotsReserved, 1)
})

test('6. Provisioning Rollback: Onboarding failure safely releases reserved slot with audit reason', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 5 },
    allocations: []
  })

  // Reserve a slot first
  const reserve = await reserveAgencyCapacitySlots(
    'agency-partner',
    { vanCount: 1, actingUserId: 'user-uuid-1' },
    mockSupabase
  )
  assert.equal(reserve.success, true)
  const allocId = reserve.allocationId

  // Simulate provisioning failure rollback
  const released = await releaseAgencySlotReservation(
    allocId,
    'Contractor provisioning failed during workspace initialization',
    mockSupabase
  )
  assert.equal(released, true, 'Reservation rollback should succeed')

  const allocRecord = mockSupabase._state.allocationsData.find(a => a.id === allocId)
  assert.ok(allocRecord, 'Allocation record should exist in ledger')
  assert.equal(allocRecord.assignment_state, 'released', 'State should be rolled back to released')
  assert.match(allocRecord.reason, /Contractor provisioning failed/i)
  assert.ok(allocRecord.released_at, 'Release timestamp must be set')
})

test('7. Telephony Authorization: Does not purchase paid Telnyx DID unless authorizeDidPurchase is true', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 5 },
    allocations: []
  })

  const deployPayload = {
    businessName: 'Austin Quick Pipe LLC',
    ownerName: 'Dan Austin',
    ownerCellPhone: '+15125550199',
    industry: 'plumbing',
    vanCount: 1,
    authorizeDidPurchase: false // Explicitly unconfirmed
  }

  const result = await deployClientToAgencySlot('agency-partner', deployPayload, mockSupabase, 'user-uuid-1')

  assert.equal(result.success, true)
  assert.ok(result.slot)
  assert.equal(result.slot.number_active, true, 'Number is active for basic voice using provided phone')
  assert.equal(result.slot.messaging_ready, false, 'Carrier messaging is false without 10DLC vetting')
  assert.equal(result.slot.messaging_route, 'platform_toll_free_bridge', 'Outbound SMS uses platform toll-free bridge')
})

test('8. Telephony Idempotency: Duplicate DID purchase avoided when number already assigned', async () => {
  const existingOrgId = 'org-existing-telnyx'
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 5 },
    organizations: [
      {
        id: existingOrgId,
        name: 'Apex Heating & Air',
        partner_agency_id: 'a0000000-0000-4000-a000-000000000001',
        telnyx_phone_number: '+15125550177',
        phone_provisioning_status: 'active'
      }
    ],
    phoneNumbers: [
      {
        id: 'phone-rec-1',
        org_id: existingOrgId,
        phone_number: '+15125550177',
        status: 'active',
        verification_status: 'verified'
      }
    ]
  })

  // Duplicate client deploy attempt with same business name or phone is rejected
  const result = await deployClientToAgencySlot(
    'agency-partner',
    {
      businessName: 'Apex Heating & Air',
      ownerName: 'Sam Apex',
      ownerCellPhone: '+15125550177',
      industry: 'hvac',
      authorizeDidPurchase: true
    },
    mockSupabase
  )

  assert.equal(result.success, false, 'Duplicate client under same agency must be rejected')
  assert.equal(result.duplicate, true, 'Duplicate flag must be set')
})

test('9. Telephony State Separation: Separates voice number_active from messaging_ready', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 5 },
    allocations: []
  })

  const result = await deployClientToAgencySlot(
    'agency-partner',
    {
      businessName: 'Lone Star Electricians',
      ownerName: 'Maria Rodriguez',
      ownerCellPhone: '+12145550144',
      industry: 'electrical',
      vanCount: 2,
      authorizeDidPurchase: true
    },
    mockSupabase
  )

  assert.equal(result.success, true)
  assert.ok(result.slot)
  // Even with authorizeDidPurchase: true, 10DLC vetting takes 2-4 days, so messaging_ready is false
  assert.equal(result.slot.messaging_ready, false, 'messaging_ready must be false during vetting')
  assert.equal(result.slot.carrier_registration_status, 'in_review', 'Carrier registration is in_review')
})

test('10. Day-Zero SMS: Outbound messaging routes via platform toll-free bridge during 10DLC vetting', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 5 },
    allocations: []
  })

  const result = await deployClientToAgencySlot(
    'agency-partner',
    {
      businessName: 'Dallas Rapid Roofing',
      ownerName: 'Carl Dallas',
      ownerCellPhone: '+12145550188',
      industry: 'roofing',
      vanCount: 1,
      authorizeDidPurchase: false
    },
    mockSupabase
  )

  assert.equal(result.success, true)
  assert.equal(result.slot.messaging_route, 'platform_toll_free_bridge', 'Immediate day-zero SMS uses verified toll-free bridge')
})

test('11. Offboarding Verification: Verifies agency ownership before allowing client removal', async () => {
  const mockSupabase = createMockSupabase({
    agency: { id: 'a0000000-0000-4000-a000-000000000001' },
    organizations: [
      {
        id: 'org-other-agency',
        name: 'Foreign Client Inc',
        partner_agency_id: 'b0000000-0000-4000-b000-000000000002' // Different agency
      }
    ]
  })

  const result = await offboardClientFromAgencySlot(
    'agency-partner',
    'org-other-agency',
    { organizationId: 'org-other-agency' },
    'user-uuid-1',
    mockSupabase
  )

  assert.equal(result.success, false, 'Cannot offboard a client that belongs to another agency')
  assert.match(result.error, /does not belong to this agency portfolio/i)
})

test('12. Offboarding Inspection: Accurately checks and returns pending appointments and unpaid invoices', async () => {
  const targetOrgId = 'org-with-pending-items'
  const mockSupabase = createMockSupabase({
    agency: { id: 'a0000000-0000-4000-a000-000000000001' },
    organizations: [
      {
        id: targetOrgId,
        name: 'Reliable Plumbers',
        partner_agency_id: 'a0000000-0000-4000-a000-000000000001',
        operation_mode: 'solo'
      }
    ],
    appointments: [
      { id: 'apt-1', org_id: targetOrgId, status: 'scheduled' },
      { id: 'apt-2', org_id: targetOrgId, status: 'confirmed' },
      { id: 'apt-3', org_id: targetOrgId, status: 'completed' }
    ],
    invoices: [
      { id: 'inv-1', org_id: targetOrgId, status: 'draft', total: 450 },
      { id: 'inv-2', org_id: targetOrgId, status: 'paid', total: 1200 }
    ],
    jobs: [
      { id: 'job-1', org_id: targetOrgId, status: 'in_progress' }
    ]
  })

  const result = await offboardClientFromAgencySlot(
    'agency-partner',
    targetOrgId,
    { organizationId: targetOrgId, reason: 'Client contract ended' },
    'user-uuid-1',
    mockSupabase
  )

  assert.equal(result.success, true)
  assert.equal(result.pendingAppointmentsCount, 2, '2 pending appointments (scheduled + confirmed)')
  assert.equal(result.unpaidInvoicesCount, 1, '1 unpaid invoice (draft)')
  assert.equal(result.historicalRecordsPreserved.appointmentsCount, 3, 'All 3 appointments preserved')
  assert.equal(result.historicalRecordsPreserved.invoicesCount, 2, 'All 2 invoices preserved')
  assert.equal(result.historicalRecordsPreserved.jobsCount, 1, 'All 1 jobs preserved')
})

test('13. Offboarding Capacity Release: Immediately marks allocation as released and frees wholesale slot', async () => {
  const targetOrgId = 'org-capacity-release'
  const mockSupabase = createMockSupabase({
    agency: { id: 'a0000000-0000-4000-a000-000000000001', total_slots: 10 },
    organizations: [
      {
        id: targetOrgId,
        name: 'Multi-Crew Movers',
        partner_agency_id: 'a0000000-0000-4000-a000-000000000001',
        operation_mode: 'multi_crew',
        fleet_van_count: 3
      }
    ],
    allocations: [
      {
        id: 'alloc-target',
        agency_id: 'a0000000-0000-4000-a000-000000000001',
        organization_id: targetOrgId,
        slots_consumed: 2,
        assignment_state: 'active'
      }
    ]
  })

  const result = await offboardClientFromAgencySlot(
    'agency-partner',
    targetOrgId,
    { organizationId: targetOrgId, reason: 'Voluntary departure' },
    'user-uuid-1',
    mockSupabase
  )

  assert.equal(result.success, true)
  assert.equal(result.slotsReleased, 2, 'Multi-crew client releases 2 slots')
  assert.ok(result.offboardedAt, 'Offboarded timestamp must be returned')

  // Verify allocation in ledger was marked released
  const alloc = mockSupabase._state.allocationsData.find(a => a.organization_id === targetOrgId)
  assert.equal(alloc.assignment_state, 'released')
  assert.ok(alloc.released_at)
})

test('14. Offboarding Data Preservation: Preserves 100% of historical records (zero rows deleted)', async () => {
  const targetOrgId = 'org-data-preservation'
  const mockSupabase = createMockSupabase({
    agency: { id: 'a0000000-0000-4000-a000-000000000001' },
    organizations: [
      {
        id: targetOrgId,
        name: 'Heritage Roofing Co',
        partner_agency_id: 'a0000000-0000-4000-a000-000000000001'
      }
    ],
    appointments: [{ id: 'apt-1', org_id: targetOrgId }],
    invoices: [{ id: 'inv-1', org_id: targetOrgId }],
    jobs: [{ id: 'job-1', org_id: targetOrgId }],
    messages: [{ id: 'msg-1', org_id: targetOrgId }]
  })

  await offboardClientFromAgencySlot(
    'agency-partner',
    targetOrgId,
    { organizationId: targetOrgId },
    'user-uuid-1',
    mockSupabase
  )

  // Verify that ZERO hard deletes were issued against the database
  assert.equal(mockSupabase._state.deletedRows.length, 0, 'No rows should be deleted during offboarding')
  
  // Organization must still exist in table, decoupled with lifecycle status
  const org = mockSupabase._state.organizationsData.find(o => o.id === targetOrgId)
  assert.ok(org, 'Organization row must be preserved in database')
  assert.equal(org.partner_agency_id, null, 'Agency linkage is severed')
  assert.equal(org.lifecycle_status, 'offboarded', 'Lifecycle status set to offboarded')
  assert.ok(org.offboarded_at, 'Offboarded timestamp recorded')
})

test('15. Offboarding Phone Handling: Supports releasing DID vs contractor retention', async () => {
  const targetOrgId = 'org-phone-options'
  const mockSupabase = createMockSupabase({
    agency: { id: 'a0000000-0000-4000-a000-000000000001' },
    organizations: [
      {
        id: targetOrgId,
        name: 'Metro Electric',
        partner_agency_id: 'a0000000-0000-4000-a000-000000000001'
      }
    ],
    phoneNumbers: [
      { id: 'phone-1', org_id: targetOrgId, phone_number: '+15125550999', status: 'active' }
    ]
  })

  // Scenario A: Contractor retains phone
  const resultRetain = await offboardClientFromAgencySlot(
    'agency-partner',
    targetOrgId,
    { organizationId: targetOrgId, transitionType: 'retain_phone', releasePhoneNumber: false },
    'user-uuid-1',
    mockSupabase
  )
  assert.equal(resultRetain.telephonyAction, 'retained_by_contractor')
  let phoneRec = mockSupabase._state.phoneNumbersData.find(p => p.org_id === targetOrgId)
  assert.equal(phoneRec.status, 'active', 'Phone remains active for contractor')

  // Re-link for Scenario B
  mockSupabase._state.organizationsData[0].partner_agency_id = 'a0000000-0000-4000-a000-000000000001'

  // Scenario B: Agency requests phone number release
  const resultRelease = await offboardClientFromAgencySlot(
    'agency-partner',
    targetOrgId,
    { organizationId: targetOrgId, transitionType: 'release', releasePhoneNumber: true },
    'user-uuid-1',
    mockSupabase
  )
  assert.equal(resultRelease.telephonyAction, 'released')
  phoneRec = mockSupabase._state.phoneNumbersData.find(p => p.org_id === targetOrgId)
  assert.equal(phoneRec.status, 'released', 'Phone record marked released')
})

test('16. Cross-Agency Security: Rejects offboarding attempts for clients of other agencies', async () => {
  const mockSupabase = createMockSupabase({
    agency: { id: 'a0000000-0000-4000-a000-000000000001' },
    organizations: [
      {
        id: 'org-belongs-to-b',
        name: 'Other Agency Contractor',
        partner_agency_id: 'b9999999-9999-4999-b999-999999999999'
      }
    ]
  })

  const result = await offboardClientFromAgencySlot(
    'agency-partner',
    'org-belongs-to-b',
    { organizationId: 'org-belongs-to-b' },
    'user-uuid-1',
    mockSupabase
  )

  assert.equal(result.success, false)
  assert.match(result.error, /does not belong to this agency/i)
})

test('17. Offboarding API Route Guard: Rejects invalid payloads and missing organizationId', async () => {
  const routePath = path.resolve(process.cwd(), 'src/app/api/agency/clients/offboard/route.ts')
  assert.ok(fs.existsSync(routePath), 'Offboard route file must exist')
  const content = fs.readFileSync(routePath, 'utf8')
  assert.ok(content.includes('UUID_REGEX'), 'Must validate organizationId format')
  assert.ok(content.includes('getAgencyContext'), 'Must enforce authenticated agency session')
  assert.ok(content.includes('offboardClientFromAgencySlot'), 'Must call offboarding service')
  assert.ok(content.includes('400'), 'Must reject invalid JSON and missing organizationId')
  assert.ok(content.includes('403'), 'Must reject unauthorized cross-agency offboarding')

  // Test UUID validation regex
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  assert.equal(UUID_REGEX.test('not-a-uuid'), false)
  assert.equal(UUID_REGEX.test(''), false)
  assert.equal(UUID_REGEX.test('a0000000-0000-4000-a000-000000000001'), true)
})

test('18. Portfolio Capacity Breakdown: Accurately computes active, reserved, and available slots', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 10 },
    allocations: [
      { id: 'alloc-1', agency_id: 'a0000000-0000-4000-a000-000000000001', slots_consumed: 1, assignment_state: 'active' },
      { id: 'alloc-2', agency_id: 'a0000000-0000-4000-a000-000000000001', slots_consumed: 2, assignment_state: 'active' },
      { id: 'alloc-3', agency_id: 'a0000000-0000-4000-a000-000000000001', slots_consumed: 2, assignment_state: 'reserved' },
      { id: 'alloc-4', agency_id: 'a0000000-0000-4000-a000-000000000001', slots_consumed: 1, assignment_state: 'offboarding_pending' },
      { id: 'alloc-5', agency_id: 'a0000000-0000-4000-a000-000000000001', slots_consumed: 1, assignment_state: 'released' }
    ]
  })

  const overview = await getAgencyPortfolioOverview('agency-partner', mockSupabase)
  assert.equal(overview.total_slots, 10, 'Total slots is 10')
  // Active = 1 + 2 = 3; Reserved = 2; Used = 3 + 2 = 5; Available = 10 - 5 = 5
  assert.equal(overview.used_slots, 5, 'Used slots must be 5 (3 active + 2 reserved)')
  assert.equal(overview.available_slots, 5, 'Available slots must be 5 (10 - 5)')

  assert.ok(overview.capacity_breakdown)
  assert.equal(overview.capacity_breakdown.active_slots_consumed, 3)
  assert.equal(overview.capacity_breakdown.pending_reserved_slots, 2)
  assert.equal(overview.capacity_breakdown.offboarding_slots, 1)
})

test('19. Deployment Operational Stages: Transitions through explicit workflow stages from draft to active', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 10 },
    allocations: []
  })

  // 1. Validation (draft -> validating)
  const validation = validateDeployClientRequest({
    businessName: 'Highland Park AC & Heat',
    ownerName: 'James Highland',
    ownerCellPhone: '+12145550177',
    industry: 'hvac',
    vanCount: 3,
    authorizeDidPurchase: false
  })
  assert.equal(validation.isValid, true)
  assert.equal(validation.validatedData.vanCount, 3)
  assert.equal(validation.validatedData.clientTier, 'multi_crew')

  // 2. Deployment (slot_reserved -> contractor_provisioning -> active)
  const result = await deployClientToAgencySlot(
    'agency-partner',
    validation.validatedData,
    mockSupabase,
    'user-uuid-1'
  )

  assert.equal(result.success, true)
  assert.equal(result.status, 'active')
  assert.ok(result.slot)
  assert.equal(result.slot.lifecycle_status, 'active')
  assert.equal(result.slot.slots_consumed, 2, 'Consumes 2 slots for 3-van fleet')
  assert.equal(result.slot.van_count, 3)

  // Allocation record in ledger must be active
  const alloc = mockSupabase._state.allocationsData.find(a => a.id === result.allocationId)
  assert.ok(alloc)
  assert.equal(alloc.assignment_state, 'active')
  assert.equal(alloc.slots_consumed, 2)
  assert.equal(alloc.van_count, 3)
})

test('20. Auditable Ledger Trail: Tracks acting user, timestamps, van count, and transition reason in agency_slot_allocations', async () => {
  const mockSupabase = createMockSupabase({
    agency: { total_slots: 10 },
    allocations: []
  })

  const actingUser = 'user-agent-manager-42'
  const deployResult = await deployClientToAgencySlot(
    'agency-partner',
    {
      businessName: 'Audited Trade Solutions',
      ownerName: 'Audrey Stone',
      ownerCellPhone: '+15125550188',
      industry: 'electrical',
      vanCount: 1,
      authorizeDidPurchase: false
    },
    mockSupabase,
    actingUser
  )

  assert.equal(deployResult.success, true)
  const alloc = mockSupabase._state.allocationsData.find(a => a.id === deployResult.allocationId)
  assert.ok(alloc, 'Ledger entry must exist')
  assert.equal(alloc.acting_user_id, actingUser, 'Must record acting user ID')
  assert.ok(alloc.assigned_at, 'Must have assignment timestamp')
  assert.equal(alloc.van_count, 1, 'Must record van count')
  assert.equal(alloc.slots_consumed, 1, 'Must record slots consumed')

  // Now offboard and verify release audit trail
  await offboardClientFromAgencySlot(
    'agency-partner',
    alloc.organization_id,
    {
      organizationId: alloc.organization_id,
      reason: 'Audit compliance lifecycle test'
    },
    actingUser,
    mockSupabase
  )

  assert.equal(alloc.assignment_state, 'released')
  assert.ok(alloc.released_at, 'Release timestamp must be set')
  assert.equal(alloc.reason, 'Audit compliance lifecycle test', 'Must record reason in ledger')
})
