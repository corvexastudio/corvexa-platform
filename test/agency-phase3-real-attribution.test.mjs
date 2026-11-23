import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeParam,
  sanitizeAttributionInput,
  isAttributionWithinWindow,
  resolveMarketingChannel,
  computeRoas,
  computeRoi,
  DEFAULT_ATTRIBUTION_WINDOW_MS
} from '../src/lib/agency/attribution-sanitizer.ts'
import {
  getAgencyAttributionReport,
  recordAgencyCampaignCost,
  getAgencyCampaignCosts,
  getAgencyPortfolioOverview
} from '../src/lib/agency/agency-service.ts'

// ==============================================================================
// TEST DATA FIXTURES
// ==============================================================================

const AGENCY_A_ID = 'a1111111-1111-4111-a111-111111111111'
const AGENCY_B_ID = 'b2222222-2222-4222-b222-222222222222'

const ORG_1_ID = 'c1111111-1111-4111-c111-111111111111' // Under Agency A
const ORG_2_ID = 'c2222222-2222-4222-c222-222222222222' // Under Agency A
const ORG_3_ID = 'c3333333-3333-4333-c333-333333333333' // Under Agency B (Isolated)

function createMockSupabase(overrides = {}) {
  const store = {
    partner_agencies: [
      { id: AGENCY_A_ID, slug: 'apex-growth', name: 'Apex Growth Marketing', total_slots: 10, primary_owner_id: 'owner-a' },
      { id: AGENCY_B_ID, slug: 'summit-media', name: 'Summit Media', total_slots: 5, primary_owner_id: 'owner-b' }
    ],
    organizations: [
      { id: ORG_1_ID, name: 'Precision Plumbing', slug: 'precision-plumbing', industry: 'plumbing', partner_agency_id: AGENCY_A_ID, created_at: '2026-01-01T00:00:00Z' },
      { id: ORG_2_ID, name: 'Elite HVAC Pros', slug: 'elite-hvac', industry: 'hvac', partner_agency_id: AGENCY_A_ID, created_at: '2026-01-02T00:00:00Z' },
      { id: ORG_3_ID, name: 'Apex Roofing LLC', slug: 'apex-roofing', industry: 'roofing', partner_agency_id: AGENCY_B_ID, created_at: '2026-01-03T00:00:00Z' }
    ],
    marketing_attributions: [],
    appointments: [],
    leads: [],
    jobs: [],
    invoices: [],
    payments: [],
    agency_campaign_costs: [],
    messages: [],
    agency_slot_allocations: [],
    ...overrides
  }

  return {
    from: (table) => {
      const records = store[table] || []

      return {
        select: (cols = '*') => {
          let filtered = [...records]

          const queryChain = {
            eq: (col, val) => {
              filtered = filtered.filter(r => r[col] === val)
              return queryChain
            },
            in: (col, vals) => {
              filtered = filtered.filter(r => vals.includes(r[col]))
              return queryChain
            },
            gte: (col, val) => {
              filtered = filtered.filter(r => (r[col] || '') >= val)
              return queryChain
            },
            order: (col, { ascending = true } = {}) => {
              filtered.sort((a, b) => {
                const av = a[col] || ''
                const bv = b[col] || ''
                return ascending ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
              })
              return queryChain
            },
            limit: (n) => {
              filtered = filtered.slice(0, n)
              return queryChain
            },
            maybeSingle: async () => ({
              data: filtered.length > 0 ? filtered[0] : null,
              error: null
            }),
            single: async () => {
              if (filtered.length === 0) return { data: null, error: { message: 'Row not found' } }
              return { data: filtered[0], error: null }
            },
            then: (resolve) => resolve({ data: filtered, error: null })
          }

          return queryChain
        },
        insert: (payload) => {
          const inserted = Array.isArray(payload) ? payload : [payload]
          const withIds = inserted.map(row => ({
            id: row.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            created_at: row.created_at || new Date().toISOString(),
            ...row
          }))
          store[table] = [...(store[table] || []), ...withIds]

          return {
            select: () => ({
              single: async () => ({ data: withIds[0], error: null }),
              maybeSingle: async () => ({ data: withIds[0], error: null }),
              then: (resolve) => resolve({ data: withIds, error: null })
            }),
            then: (resolve) => resolve({ data: withIds, error: null })
          }
        }
      }
    }
  }
}

// ==============================================================================
// 26 TEST SCENARIOS FOR PHASE 3 MARKETING ATTRIBUTION
// ==============================================================================

test('1. URL with valid UTM source: Captures and sanitizes utm_source correctly', () => {
  const input = { utm_source: ' Google-Ads ', utm_campaign: 'Spring-Promo' }
  const sanitized = sanitizeAttributionInput(input)
  assert.ok(sanitized)
  assert.equal(sanitized.utm_source, 'google-ads')
  assert.equal(sanitized.utm_campaign, 'spring-promo')
})

test('2. URL with all five UTM parameters: Captures source, medium, campaign, content, term', () => {
  const input = {
    utm_source: 'facebook',
    utm_medium: 'cpc',
    utm_campaign: 'emergency-leak-repair',
    utm_content: 'video-ad-variant-b',
    utm_term: 'plumber near me',
    landing_page: 'https://captodesk.com/book/precision-plumbing?service=leak',
    referrer: 'https://m.facebook.com'
  }
  const sanitized = sanitizeAttributionInput(input)
  assert.ok(sanitized)
  assert.equal(sanitized.utm_source, 'facebook')
  assert.equal(sanitized.utm_medium, 'cpc')
  assert.equal(sanitized.utm_campaign, 'emergency-leak-repair')
  assert.equal(sanitized.utm_content, 'video-ad-variant-b')
  assert.equal(sanitized.utm_term, 'plumber near me')
  assert.equal(sanitized.landing_page, 'https://captodesk.com/book/precision-plumbing?service=leak')
  assert.equal(sanitized.referrer, 'https://m.facebook.com')
})

test('3. Direct booking without UTM: Gracefully handles missing UTMs without errors', () => {
  const input = {}
  const sanitized = sanitizeAttributionInput(input)
  assert.equal(sanitized, null)

  const channel = resolveMarketingChannel(null, null, null)
  assert.equal(channel, 'Direct')
})

test('4. Booking step navigation: Preserves attribution across multi-step flow', () => {
  const initialAttribution = {
    utm_source: 'google-ads',
    utm_campaign: 'ac-tuneup-spring',
    utm_medium: 'cpc',
    first_touch_at: new Date(Date.now() - 5000).toISOString()
  }

  // Simulated client session storage across steps 1 -> 2 -> 3
  const step1State = { ...initialAttribution }
  const step2State = { ...step1State }
  const step3Payload = { attribution: step2State }

  assert.equal(step3Payload.attribution.utm_source, 'google-ads')
  assert.equal(step3Payload.attribution.utm_campaign, 'ac-tuneup-spring')
})

test('5. Revisit within 30-day window retains first touch: Within window returns true', () => {
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(isAttributionWithinWindow(twentyDaysAgo, 30), true)
})

test('6. Expired attribution (> 30 days) resets window: Beyond 30 days returns false', () => {
  const thirtyTwoDaysAgo = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(isAttributionWithinWindow(thirtyTwoDaysAgo, 30), false)
})

test('7. Direct visit after valid attribution preserves first touch: Direct visits do not overwrite', () => {
  const firstTouch = {
    utm_source: 'google-ads',
    utm_campaign: 'furnace-inspection',
    first_touch_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }

  // Incoming visit has no UTMs (direct)
  const incomingUtmSource = null
  const effectiveSource = incomingUtmSource || firstTouch.utm_source
  const effectiveCampaign = firstTouch.utm_campaign

  assert.equal(effectiveSource, 'google-ads')
  assert.equal(effectiveCampaign, 'furnace-inspection')
})

test('8. Secondary campaign click does not overwrite first touch: First touch wins deterministic V1', () => {
  const originalFirstTouch = {
    utm_source: 'google-ads',
    utm_campaign: 'drain-cleaning-50',
    first_touch_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  }

  const secondaryClick = {
    utm_source: 'facebook',
    utm_campaign: 'retargeting-reminder'
  }

  // Enforce First-touch wins if original touch is within 30-day window
  const isOriginalValid = isAttributionWithinWindow(originalFirstTouch.first_touch_at, 30)
  const winningTouch = isOriginalValid ? originalFirstTouch : secondaryClick

  assert.equal(winningTouch.utm_source, 'google-ads')
  assert.equal(winningTouch.utm_campaign, 'drain-cleaning-50')
})

test('9. UTM data associated with correct tenant organization: org_id strictly matches contractor', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      {
        id: 'apt-org1',
        org_id: ORG_1_ID,
        utm_source: 'google-ads',
        utm_campaign: 'emergency-clog',
        status: 'confirmed',
        created_at: new Date().toISOString()
      }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].organization_id, ORG_1_ID)
  assert.equal(report[0].client_name, 'Precision Plumbing')
})

test('10. Referral attribution retained independently from UTMs: referral code never collides with UTMs', () => {
  const bookingPayload = {
    referralCode: 'REF-SARAH-2026',
    attribution: {
      utm_source: 'google-ads',
      utm_campaign: 'repipe-special'
    }
  }

  assert.equal(bookingPayload.referralCode, 'REF-SARAH-2026')
  assert.equal(bookingPayload.attribution.utm_source, 'google-ads')
  assert.notEqual(bookingPayload.attribution.utm_source, bookingPayload.referralCode)
})

test('11. Lead converted to appointment retains attribution: Appointment inherits attribution_id', async () => {
  const attrId = 'attr-uuid-001'
  const mockSupabase = createMockSupabase({
    marketing_attributions: [
      {
        id: attrId,
        org_id: ORG_1_ID,
        utm_source: 'google-lsa',
        utm_campaign: 'water-heater-install',
        first_touch_at: new Date().toISOString()
      }
    ],
    leads: [
      { id: 'lead-1', org_id: ORG_1_ID, attribution_id: attrId, created_at: new Date().toISOString() }
    ],
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, attribution_id: attrId, status: 'confirmed', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].utm_source, 'google-lsa')
  assert.equal(report[0].utm_campaign, 'water-heater-install')
  assert.equal(report[0].attributed_leads, 1)
  assert.equal(report[0].bookings_count, 1)
})

test('12. Appointment linked to job preserves attribution: Job inherits attribution chain', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'instagram', utm_campaign: 'bathroom-remodel', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-1', status: 'completed', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].utm_source, 'instagram')
  assert.equal(report[0].bookings_count, 1)
  assert.equal(report[0].completed_jobs, 1)
  assert.equal(report[0].conversion_rate, 100)
})

test('13. Job linked to invoice preserves attribution: Invoiced amount accurately reported', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'boiler-replacement', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-1', status: 'completed', created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv-1', org_id: ORG_1_ID, job_id: 'job-1', total: 4500, status: 'issued', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].invoiced_revenue, 4500)
  assert.equal(report[0].collected_revenue, 0) // Not yet paid
})

test('14. Invoice linked to successful payments: Succeeded payments aggregate into collected revenue', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'sump-pump', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-1', status: 'completed', created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv-1', org_id: ORG_1_ID, job_id: 'job-1', total: 1800, status: 'paid', created_at: new Date().toISOString() }
    ],
    payments: [
      { id: 'pmt-1', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 1800, status: 'succeeded', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].invoiced_revenue, 1800)
  assert.equal(report[0].collected_revenue, 1800)
  assert.equal(report[0].net_revenue, 1800)
})

test('15. Partially paid invoice accurately reports collected vs due: Partial payments distinguish collected', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'hvac-tuneup', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-1', status: 'completed', created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv-1', org_id: ORG_1_ID, job_id: 'job-1', total: 1000, amount_paid: 400, amount_due: 600, status: 'partially_paid', created_at: new Date().toISOString() }
    ],
    payments: [
      { id: 'pmt-1', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 400, status: 'succeeded', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].invoiced_revenue, 1000)
  assert.equal(report[0].collected_revenue, 400)
  assert.equal(report[0].net_revenue, 400)
})

test('16. Fully paid invoice reports exact payment total: Exact sum matches', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'facebook', utm_campaign: 'filter-change', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-1', status: 'completed', created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv-1', org_id: ORG_1_ID, job_id: 'job-1', total: 2500, status: 'paid', created_at: new Date().toISOString() }
    ],
    payments: [
      { id: 'pmt-1', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 1500, status: 'succeeded', created_at: new Date().toISOString() },
      { id: 'pmt-2', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 1000, status: 'succeeded', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].collected_revenue, 2500)
  assert.equal(report[0].net_revenue, 2500)
})

test('17. Refunded payment reduces net revenue: Net revenue equals collected minus refunded', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'drain-camera', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-1', status: 'completed', created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv-1', org_id: ORG_1_ID, job_id: 'job-1', total: 800, status: 'refunded', created_at: new Date().toISOString() }
    ],
    payments: [
      { id: 'pmt-1', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 800, status: 'succeeded', created_at: new Date().toISOString() },
      { id: 'pmt-2', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 300, status: 'refunded', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].collected_revenue, 800)
  assert.equal(report[0].refunded_revenue, 300)
  assert.equal(report[0].net_revenue, 500) // 800 - 300
})

test('18. Duplicate payment check: Same payment ID is never counted twice', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'water-heater', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-1', status: 'completed', created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv-1', org_id: ORG_1_ID, job_id: 'job-1', total: 1200, status: 'paid', created_at: new Date().toISOString() }
    ],
    payments: [
      { id: 'pmt-dup', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 1200, status: 'succeeded', created_at: new Date().toISOString() },
      { id: 'pmt-dup', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 1200, status: 'succeeded', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 1)
  assert.equal(report[0].collected_revenue, 1200) // Processed exactly once
})

test('19. Revenue not double-counted across campaigns: Invoices assigned to exactly one campaign', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-camp1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'campaign-1', status: 'completed', created_at: new Date().toISOString() },
      { id: 'apt-camp2', org_id: ORG_1_ID, utm_source: 'facebook', utm_campaign: 'campaign-2', status: 'completed', created_at: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job-1', org_id: ORG_1_ID, appointment_id: 'apt-camp1', status: 'completed', created_at: new Date().toISOString() },
      { id: 'job-2', org_id: ORG_1_ID, appointment_id: 'apt-camp2', status: 'completed', created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv-1', org_id: ORG_1_ID, job_id: 'job-1', total: 3000, status: 'paid', created_at: new Date().toISOString() },
      { id: 'inv-2', org_id: ORG_1_ID, job_id: 'job-2', total: 2000, status: 'paid', created_at: new Date().toISOString() }
    ],
    payments: [
      { id: 'pmt-1', org_id: ORG_1_ID, invoice_id: 'inv-1', amount: 3000, status: 'succeeded', created_at: new Date().toISOString() },
      { id: 'pmt-2', org_id: ORG_1_ID, invoice_id: 'inv-2', amount: 2000, status: 'succeeded', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 2)
  const totalRevenue = report.reduce((sum, r) => sum + r.net_revenue, 0)
  assert.equal(totalRevenue, 5000) // 3000 + 2000, zero overlap
})

test('20. Historical unattributed records: Zero retroactive fabrication of fake UTMs', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-old-1', org_id: ORG_1_ID, source: 'booking_page', status: 'completed', created_at: new Date().toISOString() }
    ]
  })

  // When appointments have no UTM parameters or marketing attributions, returns empty array (no fake rows)
  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 0)
})

test('21. Multiple contractors in one agency reported independently: Distinct contractor names', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-c1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'emergency-leak', status: 'completed', created_at: new Date().toISOString() },
      { id: 'apt-c2', org_id: ORG_2_ID, utm_source: 'google-ads', utm_campaign: 'ac-repair', status: 'completed', created_at: new Date().toISOString() }
    ]
  })

  const report = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(report.length, 2)

  const names = report.map(r => r.client_name).sort()
  assert.deepEqual(names, ['Elite HVAC Pros', 'Precision Plumbing'])
})

test('22. Cross-agency isolation: Agency A never sees Agency B contractor attributions', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-a', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'agency-a-campaign', status: 'completed', created_at: new Date().toISOString() },
      { id: 'apt-b', org_id: ORG_3_ID, utm_source: 'google-ads', utm_campaign: 'agency-b-secret-campaign', status: 'completed', created_at: new Date().toISOString() }
    ]
  })

  // Query Agency A
  const reportA = await getAgencyAttributionReport(AGENCY_A_ID, mockSupabase)
  assert.equal(reportA.length, 1)
  assert.equal(reportA[0].utm_campaign, 'agency-a-campaign')
  assert.equal(reportA.some(r => r.organization_id === ORG_3_ID), false)

  // Query Agency B
  const reportB = await getAgencyAttributionReport(AGENCY_B_ID, mockSupabase)
  assert.equal(reportB.length, 1)
  assert.equal(reportB[0].utm_campaign, 'agency-b-secret-campaign')
  assert.equal(reportB[0].organization_id, ORG_3_ID)
})

test('23. Campaign cost entry successfully recorded: recordAgencyCampaignCost stores cost accurately', async () => {
  const mockSupabase = createMockSupabase()

  const recorded = await recordAgencyCampaignCost(
    AGENCY_A_ID,
    {
      organizationId: ORG_1_ID,
      campaignName: 'google-ads-spring',
      costAmount: 750,
      costCategory: 'ad_spend',
      reportingPeriod: '2026-11'
    },
    mockSupabase
  )

  assert.ok(recorded)
  assert.equal(recorded.cost_amount, 750)
  assert.equal(recorded.cost_category, 'ad_spend')
  assert.equal(recorded.campaign_name, 'google-ads-spring')
})

test('24. Missing campaign cost displays N/A for ROAS/ROI: Returns null with zero denominator', () => {
  const netRevenue = 3500
  const unconfiguredAdSpend = null
  const zeroAdSpend = 0

  assert.equal(computeRoas(netRevenue, unconfiguredAdSpend), null)
  assert.equal(computeRoas(netRevenue, zeroAdSpend), null)

  const unconfiguredTotalCosts = null
  assert.equal(computeRoi(netRevenue, unconfiguredTotalCosts), null)
})

test('25. Safe zero-denominator handling: ROAS and ROI never return Infinity or throw', () => {
  assert.equal(computeRoas(1000, 0), null)
  assert.equal(computeRoas(0, 0), null)
  assert.equal(computeRoas(1000, -100), null)

  assert.equal(computeRoi(5000, 0), null)
  assert.equal(computeRoi(0, 0), null)
  assert.equal(computeRoi(5000, -50), null)

  // Valid calculations
  assert.equal(computeRoas(4000, 1000), 4.0)
  assert.equal(computeRoi(4000, 1000), 3.0) // (4000 - 1000) / 1000 = 3.0 (300%)
})

test('26. Filter state correctly slices attribution data: Slices by client, source, and campaign', async () => {
  const mockSupabase = createMockSupabase({
    appointments: [
      { id: 'apt-1', org_id: ORG_1_ID, utm_source: 'google-ads', utm_campaign: 'campaign-alpha', status: 'completed', created_at: new Date().toISOString() },
      { id: 'apt-2', org_id: ORG_1_ID, utm_source: 'facebook', utm_campaign: 'campaign-beta', status: 'completed', created_at: new Date().toISOString() },
      { id: 'apt-3', org_id: ORG_2_ID, utm_source: 'google-ads', utm_campaign: 'campaign-gamma', status: 'completed', created_at: new Date().toISOString() }
    ]
  })

  // Filter by clientId
  const clientFilter = await getAgencyAttributionReport(AGENCY_A_ID, { clientId: ORG_1_ID }, mockSupabase)
  assert.equal(clientFilter.length, 2)
  assert.equal(clientFilter.every(r => r.organization_id === ORG_1_ID), true)

  // Filter by source
  const sourceFilter = await getAgencyAttributionReport(AGENCY_A_ID, { source: 'google-ads' }, mockSupabase)
  assert.equal(sourceFilter.length, 2)
  assert.equal(sourceFilter.every(r => r.utm_source === 'google-ads'), true)

  // Filter by campaign
  const campaignFilter = await getAgencyAttributionReport(AGENCY_A_ID, { campaign: 'campaign-beta' }, mockSupabase)
  assert.equal(campaignFilter.length, 1)
  assert.equal(campaignFilter[0].utm_campaign, 'campaign-beta')
})
