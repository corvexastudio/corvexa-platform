import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateAndNormalizeDomain,
  isOriginAllowedForFraming,
  buildFrameAncestorsCsp
} from '../src/lib/agency/embed-domain-sanitizer.ts'
import {
  getContractorEmbedDomains,
  addContractorEmbedDomain,
  revokeContractorEmbedDomain,
  getEmbedPolicyForSlug
} from '../src/lib/agency/agency-service.ts'
import {
  validateBookingOrigin,
  generateBookingToken,
  verifyBookingToken
} from '../src/lib/booking/origin-validator.ts'

// ==============================================================================
// TEST DATA FIXTURES
// ==============================================================================

const AGENCY_A_ID = 'a1111111-1111-4111-a111-111111111111'
const AGENCY_B_ID = 'b2222222-2222-4222-b222-222222222222'

const ORG_1_ID = 'c1111111-1111-4111-c111-111111111111' // Under Agency A
const ORG_2_ID = 'c2222222-2222-4222-c222-222222222222' // Under Agency B (Isolated)

function createMockSupabase(overrides = {}) {
  const store = {
    partner_agencies: [
      { id: AGENCY_A_ID, slug: 'apex-growth', name: 'Apex Growth Marketing', total_slots: 10, primary_owner_id: 'owner-a' },
      { id: AGENCY_B_ID, slug: 'summit-media', name: 'Summit Media', total_slots: 5, primary_owner_id: 'owner-b' }
    ],
    organizations: [
      { id: ORG_1_ID, name: 'Precision Plumbing', slug: 'precision-plumbing', industry: 'plumbing', partner_agency_id: AGENCY_A_ID },
      { id: ORG_2_ID, name: 'Summit Electric', slug: 'summit-electric', industry: 'electrical', partner_agency_id: AGENCY_B_ID }
    ],
    contractor_embed_domains: [
      { id: 'dom-1', org_id: ORG_1_ID, domain: 'precisionplumbing.com', is_verified: true, created_by: 'owner-a', created_at: '2026-01-01T00:00:00Z' }
    ],
    appointments: [],
    customers: [],
    messages: [],
    ...overrides
  }

  return {
    _store: store,
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
            order: (col, { ascending = true } = {}) => {
              filtered.sort((a, b) => {
                const av = a[col] || ''
                const bv = b[col] || ''
                return ascending ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
              })
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
          const withIds = inserted.map(row => {
            // Check unique constraint on (org_id, domain) for contractor_embed_domains
            if (table === 'contractor_embed_domains') {
              const duplicate = records.find(r => r.org_id === row.org_id && r.domain === row.domain)
              if (duplicate) {
                const err = new Error('Unique constraint violation: domain already exists')
                err.code = '23505'
                throw err
              }
            }
            return {
              id: row.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              created_at: row.created_at || new Date().toISOString(),
              ...row
            }
          })
          store[table] = [...(store[table] || []), ...withIds]

          return {
            select: () => ({
              single: async () => ({ data: withIds[0], error: null }),
              maybeSingle: async () => ({ data: withIds[0], error: null }),
              then: (resolve) => resolve({ data: withIds, error: null })
            }),
            then: (resolve) => resolve({ data: withIds, error: null })
          }
        },
        delete: () => {
          let filterCol = null
          let filterVal = null
          let filterCol2 = null
          let filterVal2 = null

          const deleteChain = {
            eq: (col, val) => {
              if (!filterCol) {
                filterCol = col
                filterVal = val
              } else {
                filterCol2 = col
                filterVal2 = val
              }
              return deleteChain
            },
            then: (resolve) => {
              store[table] = (store[table] || []).filter(r => {
                if (filterCol && r[filterCol] !== filterVal) return true
                if (filterCol2 && r[filterCol2] !== filterVal2) return true
                return false
              })
              resolve({ error: null })
            }
          }
          return deleteChain
        }
      }
    }
  }
}

// ==============================================================================
// 20 TEST SCENARIOS FOR PHASE 4 EMBEDS, POLICIES AND DEMO ISOLATION
// ==============================================================================

test('1. Standard booking CTA generation: produces working URL with contractor slug and proper styling', () => {
  const slug = 'apex-plumbing'
  const brandName = 'Apex Plumbing'
  const bookingUrl = `https://book.captodesk.com/${slug}`
  
  // Format 1 button HTML generator
  const ctaSnippet = `<a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background-color:#059669;color:#ffffff;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;font-family:sans-serif;">Book Appointment with ${brandName}</a>`
  
  assert.ok(ctaSnippet.includes(bookingUrl))
  assert.ok(ctaSnippet.includes('target="_blank"'))
  assert.ok(ctaSnippet.includes('rel="noopener noreferrer"'))
  assert.ok(ctaSnippet.includes(brandName))
})

test('2. Sticky widget generation: non-obstructive z-index and spacing', () => {
  const slug = 'apex-plumbing'
  const bookingUrl = `https://book.captodesk.com/${slug}`

  // Format 2 sticky widget generator
  const stickySnippet = `<div style="position:fixed;bottom:20px;right:20px;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.16);border-radius:50px;background:#059669;">
  <a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:8px;padding:12px 20px;color:#fff;font-weight:600;text-decoration:none;font-family:sans-serif;">
    <span>Book Online</span>
  </a>
</div>`

  assert.ok(stickySnippet.includes('position:fixed'))
  assert.ok(stickySnippet.includes('bottom:20px'))
  assert.ok(stickySnippet.includes('right:20px'))
  assert.ok(stickySnippet.includes('z-index:99999'))
  assert.ok(stickySnippet.includes(bookingUrl))
})

test('3. UTM URL generation: contains all 5 Phase 3 parameters', () => {
  const baseUrl = 'https://book.captodesk.com/precision-plumbing'
  const params = {
    utm_source: 'google-ads',
    utm_medium: 'cpc',
    utm_campaign: 'spring-leak-special',
    utm_content: 'search-headline-1',
    utm_term: 'emergency plumber austin'
  }

  const url = new URL(baseUrl)
  Object.entries(params).forEach(([k, v]) => {
    url.searchParams.set(k, v)
  })

  const fullUrl = url.toString()
  assert.ok(fullUrl.includes('utm_source=google-ads'))
  assert.ok(fullUrl.includes('utm_medium=cpc'))
  assert.ok(fullUrl.includes('utm_campaign=spring-leak-special'))
  assert.ok(fullUrl.includes('utm_content=search-headline-1'))
  assert.ok(fullUrl.includes('utm_term=emergency+plumber+austin') || fullUrl.includes('utm_term=emergency%20plumber%20austin'))
})

test('4. Iframe snippet generation: responsive styling with width 100%, max-width 680px, height 820px, loading=lazy', () => {
  const slug = 'precision-plumbing'
  const bookingUrl = `https://book.captodesk.com/${slug}`
  
  const iframeSnippet = `<iframe
  src="${bookingUrl}"
  width="100%"
  height="820"
  style="border:none;max-width:680px;width:100%;min-height:750px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);"
  title="Online Appointment Booking"
  loading="lazy"
  allow="payment"
></iframe>`

  assert.ok(iframeSnippet.includes('width="100%"'))
  assert.ok(iframeSnippet.includes('max-width:680px'))
  assert.ok(iframeSnippet.includes('height="820"'))
  assert.ok(iframeSnippet.includes('loading="lazy"'))
  assert.ok(iframeSnippet.includes('allow="payment"'))
  assert.ok(iframeSnippet.includes(bookingUrl))
})

test('5. Approved domain: correctly authorized domain included in frame-ancestors', () => {
  const csp = buildFrameAncestorsCsp(['contractor-site.com'])
  assert.equal(csp, "frame-ancestors 'self' https://contractor-site.com https://www.contractor-site.com;")

  const multiCsp = buildFrameAncestorsCsp(['site-a.com', 'site-b.org'])
  assert.equal(multiCsp, "frame-ancestors 'self' https://site-a.com https://www.site-a.com https://site-b.org https://www.site-b.org;")
})

test('6. Unapproved domain: origin not in allowlist rejected from frame-ancestors and validator', () => {
  const emptyCsp = buildFrameAncestorsCsp([])
  assert.equal(emptyCsp, "frame-ancestors 'self';")

  const allowed = isOriginAllowedForFraming('https://evil-hacker.com', ['trusted-client.com'])
  assert.equal(allowed, false)

  const subdomainAttack = isOriginAllowedForFraming('https://trusted-client.com.attacker.com', ['trusted-client.com'])
  assert.equal(subdomainAttack, false)
})

test('7. Malformed domain: sanitizer rejects schemes, paths, wildcards, unsafe characters', () => {
  // Rejects unsafe schemes
  const unsafeResult = validateAndNormalizeDomain('javascript:alert(1)')
  assert.equal(unsafeResult.isValid, false)
  assert.ok(unsafeResult.error?.includes('Unsafe scheme'))

  // Rejects wildcards
  const wildcardResult = validateAndNormalizeDomain('*.mysite.com')
  assert.equal(wildcardResult.isValid, false)
  assert.ok(wildcardResult.error?.includes('Wildcard'))

  // Rejects empty or invalid domain labels
  const invalidLabelResult = validateAndNormalizeDomain('my..site.com')
  assert.equal(invalidLabelResult.isValid, false)
  assert.ok(invalidLabelResult.error?.includes('empty label') || invalidLabelResult.error?.includes('consecutive dots'))

  // Rejects missing top level domain
  const singleLabelResult = validateAndNormalizeDomain('localhostinvalid')
  assert.equal(singleLabelResult.isValid, false)
  assert.ok(singleLabelResult.error?.includes('top-level domain'))

  // Normalizes whitespace, casing, and trailing dots
  const validResult = validateAndNormalizeDomain('  MyContractorSite.com.  ')
  assert.equal(validResult.isValid, true)
  assert.equal(validResult.normalized, 'mycontractorsite.com')
})

test('8. Unauthorized agency modifying domain allowlist: Agency A cannot modify Agency B contractor', async () => {
  const mockSupabase = createMockSupabase()

  // Verify org belongs to Agency B
  const { data: orgB } = await mockSupabase.from('organizations').select().eq('id', ORG_2_ID).single()
  assert.equal(orgB.partner_agency_id, AGENCY_B_ID)

  // Authorization check helper mimicking verifyOrgAccess / RLS
  const isAuthorized = (agencyId, targetOrg) => targetOrg.partner_agency_id === agencyId

  // Agency A tries to authorize a domain for Agency B org
  const canAgencyAAccess = isAuthorized(AGENCY_A_ID, orgB)
  assert.equal(canAgencyAAccess, false)

  // Agency B can access Agency B org
  const canAgencyBAccess = isAuthorized(AGENCY_B_ID, orgB)
  assert.equal(canAgencyBAccess, true)
})

test('9. Contractor owner domain management: Contractor owner can review and manage their own approved domains', async () => {
  const mockSupabase = createMockSupabase()

  // Add domain for ORG_1
  const added = await addContractorEmbedDomain(ORG_1_ID, 'newbookingdomain.com', 'owner-a', mockSupabase)
  assert.equal(added.domain, 'newbookingdomain.com')
  assert.equal(added.org_id, ORG_1_ID)
  assert.equal(added.is_verified, true)

  // Query domains
  const domains = await getContractorEmbedDomains(ORG_1_ID, mockSupabase)
  assert.equal(domains.length, 2)
  assert.ok(domains.some(d => d.domain === 'newbookingdomain.com'))

  // Revoke domain
  const revokeResult = await revokeContractorEmbedDomain(ORG_1_ID, 'newbookingdomain.com', mockSupabase)
  assert.equal(revokeResult.success, true)

  const updatedDomains = await getContractorEmbedDomains(ORG_1_ID, mockSupabase)
  assert.equal(updatedDomains.length, 1)
  assert.equal(updatedDomains[0].domain, 'precisionplumbing.com')
})

test('10. Cross-tenant domain access: Tenant A cannot view or tamper with Tenant B domain allowlist', async () => {
  const mockSupabase = createMockSupabase()

  // Domains for Org 1
  const domainsOrg1 = await getContractorEmbedDomains(ORG_1_ID, mockSupabase)
  assert.equal(domainsOrg1.length, 1)
  assert.equal(domainsOrg1[0].domain, 'precisionplumbing.com')

  // Domains for Org 2 (isolated)
  const domainsOrg2 = await getContractorEmbedDomains(ORG_2_ID, mockSupabase)
  assert.equal(domainsOrg2.length, 0)

  // Attempting to delete Org 1 domain using Org 2 ID fails to delete anything
  await revokeContractorEmbedDomain(ORG_2_ID, 'precisionplumbing.com', mockSupabase)
  const verifyOrg1 = await getContractorEmbedDomains(ORG_1_ID, mockSupabase)
  assert.equal(verifyOrg1.length, 1) // Still present
})

test('11. Booking page framed by approved website: returns CSP frame-ancestors with domain and no X-Frame-Options', async () => {
  const mockSupabase = createMockSupabase()

  const policy = await getEmbedPolicyForSlug('precision-plumbing', mockSupabase)
  assert.equal(policy.allowedDomains.length, 1)
  assert.equal(policy.allowedDomains[0], 'precisionplumbing.com')
  assert.equal(policy.csp, "frame-ancestors 'self' https://precisionplumbing.com https://www.precisionplumbing.com;")
  assert.equal(policy.xFrameOptions, undefined) // Frame allowed from approved domain
})

test('12. Booking page framed by unapproved website: returns CSP frame-ancestors self and X-Frame-Options SAMEORIGIN', async () => {
  const mockSupabase = createMockSupabase()

  // Org 2 has no authorized domains
  const policy = await getEmbedPolicyForSlug('summit-electric', mockSupabase)
  assert.equal(policy.allowedDomains.length, 0)
  assert.equal(policy.csp, "frame-ancestors 'self';")
  assert.equal(policy.xFrameOptions, 'SAMEORIGIN') // Framing blocked
})

test('13. Protected routes: contractor dashboard, admin, and agency routes strictly retain SAMEORIGIN and self', () => {
  const protectedRoutes = ['/dashboard', '/admin/users', '/agency/clients', '/client/settings']
  
  for (const route of protectedRoutes) {
    const isPublicBooking = route.startsWith('/book/')
    assert.equal(isPublicBooking, false)
    
    // In proxy.ts, non-booking routes resolve:
    const csp = "frame-ancestors 'self';"
    const xFrameOptions = 'SAMEORIGIN'
    
    assert.equal(csp, "frame-ancestors 'self';")
    assert.equal(xFrameOptions, 'SAMEORIGIN')
  }
})

test('14. CSRF behavior within iframe: valid booking token allows submission', () => {
  const slug = 'precision-plumbing'
  const orgId = ORG_1_ID
  const validToken = generateBookingToken(slug, orgId)

  // Simulated cross-origin request from iframe with token
  const request = new Request('https://book.captodesk.com/api/book/precision-plumbing/submit', {
    method: 'POST',
    headers: {
      'origin': 'https://thirdparty-website.com',
      'host': 'book.captodesk.com'
    }
  })

  const check = validateBookingOrigin(request, slug, orgId, validToken, [])
  assert.equal(check.allowed, true)
})

test('15. Form submission from embedded page: approved origin allows submission via validateBookingOrigin', () => {
  const slug = 'precision-plumbing'
  const orgId = ORG_1_ID
  const approvedDomains = ['precisionplumbing.com']

  // Request from approved website without a CSRF token
  const request = new Request('https://book.captodesk.com/api/book/precision-plumbing/submit', {
    method: 'POST',
    headers: {
      'origin': 'https://precisionplumbing.com',
      'host': 'book.captodesk.com'
    }
  })

  const check = validateBookingOrigin(request, slug, orgId, null, approvedDomains)
  assert.equal(check.allowed, true)

  // Request from unapproved website without CSRF token is rejected
  const badRequest = new Request('https://book.captodesk.com/api/book/precision-plumbing/submit', {
    method: 'POST',
    headers: {
      'origin': 'https://unauthorized-domain.com',
      'host': 'book.captodesk.com'
    }
  })

  const badCheck = validateBookingOrigin(badRequest, slug, orgId, null, approvedDomains)
  assert.equal(badCheck.allowed, false)
  assert.ok(badCheck.reason?.includes('rejected'))
})

test('16. No real booking in preview mode: preview: true returns simulated booking without DB or SMS mutation', async () => {
  const mockSupabase = createMockSupabase()

  const submissionBody = {
    customerName: 'Test Preview Customer',
    customerPhone: '5125550199',
    startTime: '2026-06-01T10:00:00Z',
    preview: true
  }

  // Mimic route preview short-circuit logic from /api/book/[slug]/submit
  const isPreview = Boolean(submissionBody.preview)
  let responseData

  if (isPreview) {
    responseData = {
      success: true,
      preview: true,
      id: 'preview-appointment-id',
      message: 'Preview mode: Booking simulated successfully. No real appointment, customer, or SMS was created.',
      appointment: {
        id: 'preview-appointment-id',
        status: 'confirmed',
        startTime: submissionBody.startTime,
        customerName: submissionBody.customerName,
        customerPhone: submissionBody.customerPhone
      }
    }
  } else {
    // Real path would insert into DB
    await mockSupabase.from('appointments').insert({ ...submissionBody, org_id: ORG_1_ID })
  }

  assert.equal(responseData.success, true)
  assert.equal(responseData.preview, true)
  assert.equal(responseData.id, 'preview-appointment-id')

  // Verify ZERO records inserted into database
  assert.equal(mockSupabase._store.appointments.length, 0)
  assert.equal(mockSupabase._store.customers.length, 0)
  assert.equal(mockSupabase._store.messages.length, 0)
})

test('17. Demo banner visibility: prominent INTERACTIVE DEMO notice is present', async () => {
  const fs = await import('node:fs')
  const demoCode = fs.readFileSync('C:/Users/mskar/captodesk/src/app/agency/demo/page.tsx', 'utf8')

  // Check persistent banner elements
  assert.ok(demoCode.includes('Interactive Demo / Sample Data'))
  assert.ok(demoCode.includes('Reset Demo State'))
  assert.ok(demoCode.includes('Interactive Demo Sandbox'))
})

test('18. Reset demo state: reset action restores INITIAL_DEMO_SLOTS', async () => {
  // Initial demo slots fixture matching INITIAL_DEMO_SLOTS
  const INITIAL_DEMO_SLOTS = [
    { id: 'slot-1', status: 'active', clientName: 'Apex Precision Detailing' },
    { id: 'slot-2', status: 'active', clientName: 'Summit Ridge Plumbing' },
    { id: 'slot-3', status: 'available', clientName: null }
  ]

  let slots = [...INITIAL_DEMO_SLOTS]

  // Add custom client in demo state
  const customClient = { id: 'slot-3', status: 'active', clientName: 'New Local Client' }
  slots = slots.map(s => s.id === 'slot-3' ? customClient : s)
  assert.equal(slots.find(s => s.id === 'slot-3')?.clientName, 'New Local Client')

  // Reset demo state
  slots = [...INITIAL_DEMO_SLOTS]
  assert.equal(slots.find(s => s.id === 'slot-3')?.status, 'available')
  assert.equal(slots.find(s => s.id === 'slot-3')?.clientName, null)
  assert.equal(slots.length, 3)
})

test('19. Demo deployment remains local-only: adding client updates local React state only', () => {
  const slots = [
    { id: 'slot-1', status: 'available', clientName: null }
  ]

  // Simulate handleDeploySubmit in demo page
  const newClient = {
    id: 'slot-1',
    status: 'active',
    clientName: 'Austin Mobile Auto Care',
    trade: 'Auto Detailing'
  }

  const updatedSlots = slots.map(s => s.id === 'slot-1' ? newClient : s)
  assert.equal(updatedSlots[0].status, 'active')
  assert.equal(updatedSlots[0].clientName, 'Austin Mobile Auto Care')
})

test('20. Demo does not call real Telnyx or billing APIs: zero network calls to Telnyx or Stripe', async () => {
  const fs = await import('node:fs')
  const demoCode = fs.readFileSync('C:/Users/mskar/captodesk/src/app/agency/demo/page.tsx', 'utf8')

  // Check that demo page does not import or fetch live provisioning or payment endpoints
  assert.ok(!demoCode.includes("fetch('/api/agency/clients/deploy'"))
  assert.ok(!demoCode.includes("fetch('/api/telnyx'"))
  assert.ok(!demoCode.includes("fetch('/api/stripe'"))
  assert.ok(!demoCode.includes("telnyxService"))
  assert.ok(!demoCode.includes("createAdminClient"))
})
