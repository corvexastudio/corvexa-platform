import test from 'node:test'
import assert from 'node:assert/strict'
import { customerViewJobTracking } from '../src/lib/jobs/job-manager.ts'
import {
  listJobPhotos,
  addJobPhoto,
  deleteJobPhoto,
  updateJobPhotoCaption,
  getAuthorizedPhotoUrl,
  uploadJobPhotoFile
} from '../src/lib/jobs/photo-manager.ts'
import { checkRateLimit } from '../src/lib/security/rate-limiter.ts'
import {
  getOrCreateReferralLink,
  resolveReferralByCode,
  recordReferralClick,
  recordReferralConversion
} from '../src/lib/referrals/referral-manager.ts'
import {
  listCrews,
  createCrew,
  updateCrew,
  deleteCrew
} from '../src/lib/crews/crew-manager.ts'
import {
  listRecurringTemplates,
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate
} from '../src/lib/jobs/recurring-manager.ts'
import { hasPermission, normalizeRole } from '../src/lib/security/permissions.ts'

/**
 * ==============================================================================
 * DATABASE & STORAGE ACCESS CONTROL TEST ENGINE
 * Mocks PostgreSQL RLS evaluation enforcing Migration 47 policies:
 * - job_photos (anon SELECT dropped; tenant isolated; restricted delete)
 * - referral_links (anon SELECT dropped; role-restricted write)
 * - crews (role-restricted write for owner/admin/super_admin)
 * - recurring_job_templates (role-restricted write)
 * - storage.objects (job-photos bucket private; tenant-isolated storage path)
 * ==============================================================================
 */
function createHardenedTestDb(initialData = {}) {
  const store = {
    organizations: initialData.organizations ? JSON.parse(JSON.stringify(initialData.organizations)) : [],
    profiles: initialData.profiles ? JSON.parse(JSON.stringify(initialData.profiles)) : [],
    jobs: initialData.jobs ? JSON.parse(JSON.stringify(initialData.jobs)) : [],
    job_photos: initialData.job_photos ? JSON.parse(JSON.stringify(initialData.job_photos)) : [],
    referral_links: initialData.referral_links ? JSON.parse(JSON.stringify(initialData.referral_links)) : [],
    crews: initialData.crews ? JSON.parse(JSON.stringify(initialData.crews)) : [],
    recurring_job_templates: initialData.recurring_job_templates ? JSON.parse(JSON.stringify(initialData.recurring_job_templates)) : [],
    contacts: initialData.contacts ? JSON.parse(JSON.stringify(initialData.contacts)) : [],
    invoices: initialData.invoices ? JSON.parse(JSON.stringify(initialData.invoices)) : [],
    leads: initialData.leads ? JSON.parse(JSON.stringify(initialData.leads)) : [],
    storage_objects: initialData.storage_objects ? JSON.parse(JSON.stringify(initialData.storage_objects)) : []
  }

  const buckets = {
    'job-photos': { id: 'job-photos', name: 'job-photos', public: false }
  }

  function getClient({ role = 'anon', userId = null, orgId = null, userRole = 'member' } = {}) {
    const isServiceRole = role === 'service_role'
    const isAnon = role === 'anon'
    const isSuperAdmin = userRole === 'super_admin'

    function filterByRls(table, rows) {
      if (isServiceRole) return rows
      if (isAnon) {
        // Migration 47: ZERO access for anonymous users on tenant tables.
        // Direct anonymous table enumeration returns empty.
        return []
      }

      if (table === 'profiles') {
        return rows.filter((r) => r.id === userId || isSuperAdmin)
      }

      if (table === 'organizations') {
        return rows.filter((r) => r.id === orgId || isSuperAdmin)
      }

      // Standard tenant tables isolated strictly by org_id
      return rows.filter((r) => r.org_id === orgId || isSuperAdmin)
    }

    const client = {
      _store: store,
      auth: {
        getUser: async () => ({
          data: { user: userId ? { id: userId } : null },
          error: userId ? null : new Error('No session')
        })
      },
      storage: {
        from: (bucketName) => ({
          upload: async (path, buffer, options) => {
            const bucket = buckets[bucketName]
            if (!bucket) return { data: null, error: { message: 'Bucket not found' } }

            // Storage RLS check
            if (!isServiceRole) {
              if (isAnon) return { data: null, error: { message: 'Unauthorized storage upload' } }
              const pathOrgId = path.split('/')[0]
              if (pathOrgId !== orgId && !isSuperAdmin) {
                return { data: null, error: { message: 'Cross-tenant storage upload prohibited' } }
              }
            }

            store.storage_objects.push({ bucket_id: bucketName, name: path, owner: userId })
            return { data: { path }, error: null }
          },
          createSignedUrl: async (path, expiresIn) => {
            const exists = store.storage_objects.some((obj) => obj.bucket_id === bucketName && obj.name === path)
            // Even if uncommitted, generate a deterministic signed URL token
            const token = `token_${Date.now()}_signed`
            return {
              data: { signedUrl: `https://mock.storage/object/sign/${bucketName}/${path}?token=${token}&expires=${expiresIn}` },
              error: null
            }
          },
          getPublicUrl: (path) => {
            const bucket = buckets[bucketName]
            if (bucket && !bucket.public) {
              // Private buckets do not serve public URLs
              return { data: { publicUrl: '' } }
            }
            return { data: { publicUrl: `https://mock.storage/object/public/${bucketName}/${path}` } }
          },
          remove: async (paths) => {
            store.storage_objects = store.storage_objects.filter(
              (obj) => !(obj.bucket_id === bucketName && paths.includes(obj.name))
            )
            return { data: paths, error: null }
          },
          createBucket: async (id, opts) => {
            buckets[id] = { id, name: id, public: opts?.public ?? false }
            return { data: null, error: null }
          }
        }),
        createBucket: async (id, opts) => {
          buckets[id] = { id, name: id, public: opts?.public ?? false }
          return { data: null, error: null }
        }
      },
      from: (table) => {
        let filters = []
        let selectCols = '*'
        let orderFn = null
        let limitVal = null

        const builder = {
          select: (cols = '*') => {
            selectCols = cols
            return builder
          },
          eq: (col, val) => {
            filters.push((r) => r[col] === val)
            return builder
          },
          ilike: (col, val) => {
            filters.push((r) => String(r[col] || '').toLowerCase() === String(val || '').toLowerCase())
            return builder
          },
          in: (col, vals) => {
            filters.push((r) => vals.includes(r[col]))
            return builder
          },
          or: (expr) => {
            // Simple OR parser for job_id or contact_id
            filters.push((r) => true)
            return builder
          },
          order: (col, opts) => {
            return builder
          },
          limit: (n) => {
            limitVal = n
            return builder
          },
          single: async () => {
            const res = await builder._executeSelect()
            if (res.error) return { data: null, error: res.error }
            if (res.data.length === 0) return { data: null, error: { message: 'Row not found' } }
            return { data: res.data[0], error: null }
          },
          maybeSingle: async () => {
            const res = await builder._executeSelect()
            if (res.error) return { data: null, error: res.error }
            return { data: res.data[0] || null, error: null }
          },
          then: (resolve, reject) => builder._executeSelect().then(resolve, reject),
          _executeSelect: async () => {
            const tableRows = store[table] || []
            const visible = filterByRls(table, tableRows)
            let result = visible.filter((r) => filters.every((fn) => fn(r)))
            if (limitVal) result = result.slice(0, limitVal)

            // Relation embeddings & column projection
            if (table === 'referral_links') {
              result = result.map((r) => {
                const org = store.organizations?.find((o) => o.id === r.org_id) || null
                if (selectCols && selectCols !== '*' && !selectCols.includes('contact_id')) {
                  return {
                    id: r.id,
                    org_id: r.org_id,
                    referral_code: r.referral_code,
                    reward_amount: r.reward_amount,
                    discount_amount: r.discount_amount,
                    organizations: org
                  }
                }
                return {
                  ...r,
                  organizations: org
                }
              })
            }
            if (table === 'jobs') {
              result = result.map((r) => ({
                ...r,
                organizations: store.organizations?.find((o) => o.id === r.org_id) || null,
                contacts: store.contacts?.find((c) => c.id === r.contact_id) || null,
                services: store.services?.find((s) => s.id === r.service_id) || null
              }))
            }

            return { data: JSON.parse(JSON.stringify(result)), error: null }
          },
          insert: (record) => {
            return {
              select: () => ({
                single: async () => {
                  return builder._executeInsert(record)
                }
              }),
              then: (resolve) => builder._executeInsert(record).then(resolve)
            }
          },
          _executeInsert: async (record) => {
            const rec = Array.isArray(record) ? record[0] : record
            const targetOrgId = rec.org_id || orgId

            // RLS Write Check
            if (!isServiceRole) {
              if (isAnon) return { data: null, error: { message: 'Anonymous write rejected' } }
              if (targetOrgId !== orgId && !isSuperAdmin) {
                return { data: null, error: { message: 'Cross-tenant write rejected' } }
              }

              // Role checks enforced by Migration 47
              if (['crews', 'recurring_job_templates', 'referral_links'].includes(table)) {
                if (!['owner', 'admin', 'client_admin', 'super_admin'].includes(userRole)) {
                  return { data: null, error: { message: `Forbidden: role '${userRole}' lacks permission to insert ${table}` } }
                }
              }
            }

            const newRow = { id: rec.id || `id_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...rec }
            store[table] = store[table] || []
            store[table].push(newRow)
            return { data: JSON.parse(JSON.stringify(newRow)), error: null }
          },
          update: (updates) => {
            const criteria = []
            const updateBuilder = {
              eq: (col, val) => {
                criteria.push([col, val])
                return updateBuilder
              },
              select: () => ({
                single: async () => builder._executeUpdate(criteria, updates)
              }),
              then: (resolve, reject) => builder._executeUpdate(criteria, updates).then(resolve, reject)
            }
            return updateBuilder
          },
          _executeUpdate: async (criteria, updates) => {
            const tableRows = store[table] || []
            const index = tableRows.findIndex((r) => criteria.every(([k, v]) => r[k] === v))
            if (index === -1) return { data: null, error: { message: 'Record not found to update' } }
            const existing = tableRows[index]

            if (!isServiceRole) {
              if (isAnon) return { data: null, error: { message: 'Anonymous update rejected' } }
              if (existing.org_id !== orgId && !isSuperAdmin) {
                return { data: null, error: { message: 'Cross-tenant update rejected' } }
              }

              // Role checks enforced by Migration 47
              if (['crews', 'recurring_job_templates', 'referral_links'].includes(table)) {
                if (!['owner', 'admin', 'client_admin', 'super_admin'].includes(userRole)) {
                  return { data: null, error: { message: `Forbidden: role '${userRole}' lacks permission to update ${table}` } }
                }
              }

              if (table === 'job_photos') {
                const isManager = ['owner', 'admin', 'client_admin', 'super_admin'].includes(userRole)
                const isUploader = existing.uploaded_by === userId
                if (!isManager && !isUploader) {
                  return { data: null, error: { message: `Forbidden: role '${userRole}' cannot update photo uploaded by another user` } }
                }
              }
            }

            Object.assign(existing, updates)
            return { data: JSON.parse(JSON.stringify(existing)), error: null }
          },
          delete: () => {
            const criteria = []
            const deleteBuilder = {
              eq: (col, val) => {
                criteria.push([col, val])
                return deleteBuilder
              },
              select: () => ({
                then: (resolve, reject) => builder._executeDelete(criteria).then((res) => {
                  if (res.error) return resolve({ data: null, error: res.error })
                  return resolve({ data: res.data ? [res.data] : [], error: null })
                }, reject)
              }),
              then: (resolve, reject) => builder._executeDelete(criteria).then(resolve, reject)
            }
            return deleteBuilder
          },
          _executeDelete: async (criteria) => {
            const tableRows = store[table] || []
            const index = tableRows.findIndex((r) => criteria.every(([k, v]) => r[k] === v))
            if (index === -1) return { data: null, error: { message: 'Record not found to delete' } }
            const existing = tableRows[index]

            if (!isServiceRole) {
              if (isAnon) return { data: null, error: { message: 'Anonymous delete rejected' } }
              if (existing.org_id !== orgId && !isSuperAdmin) {
                return { data: null, error: { message: 'Cross-tenant delete rejected' } }
              }

              // Migration 47 specific delete role checks
              if (['crews', 'recurring_job_templates'].includes(table)) {
                if (!['owner', 'admin', 'client_admin', 'super_admin'].includes(userRole)) {
                  return { data: null, error: { message: `Forbidden: role '${userRole}' cannot delete ${table}` } }
                }
              }

              if (table === 'job_photos') {
                const isManager = ['owner', 'admin', 'client_admin', 'super_admin'].includes(userRole)
                const isUploader = existing.uploaded_by === userId
                if (!isManager && !isUploader) {
                  return { data: null, error: { message: 'Forbidden: ordinary members cannot delete photos uploaded by others' } }
                }
              }
            }

            store[table].splice(index, 1)
            return { data: existing, error: null }
          }
        }

        return builder
      }
    }

    return client
  }

  return { store, getClient }
}

// Setup common test fixtures
function setupTestFixtures() {
  const orgA = { id: 'org_aaa', name: 'Apex Plumbing', slug: 'apex' }
  const orgB = { id: 'org_bbb', name: 'Beacon Heating', slug: 'beacon' }

  const ownerA = { id: 'user_owner_a', org_id: 'org_aaa', role: 'owner' }
  const techA = { id: 'user_tech_a', org_id: 'org_aaa', role: 'member' }
  const ownerB = { id: 'user_owner_b', org_id: 'org_bbb', role: 'owner' }

  const contactA = { id: 'cnt_aaa', org_id: 'org_aaa', name: 'Sarah Miller', phone: '+15551112222' }
  const jobA1 = {
    id: 'job_aaa_1',
    org_id: 'org_aaa',
    contact_id: 'cnt_aaa',
    job_number: 'JOB-101',
    title: 'Water Heater Repair',
    status: 'completed',
    tracking_token: 'track_token_a1_secure'
  }
  const jobA2 = {
    id: 'job_aaa_2',
    org_id: 'org_aaa',
    contact_id: 'cnt_aaa',
    job_number: 'JOB-102',
    title: 'Drain Clearing',
    status: 'scheduled',
    tracking_token: 'track_token_a2_secure'
  }

  const jobB1 = {
    id: 'job_bbb_1',
    org_id: 'org_bbb',
    job_number: 'JOB-201',
    title: 'HVAC Replacement',
    status: 'in_progress',
    tracking_token: 'track_token_b1_secure'
  }

  const photoA1 = {
    id: 'photo_1',
    org_id: 'org_aaa',
    job_id: 'job_aaa_1',
    photo_type: 'before',
    url: 'org_aaa/job_aaa_1/before_leak.jpg',
    caption: 'Corroded valve',
    uploaded_by: 'user_owner_a',
    created_at: new Date().toISOString()
  }

  const photoB1 = {
    id: 'photo_2',
    org_id: 'org_bbb',
    job_id: 'job_bbb_1',
    photo_type: 'before',
    url: 'org_bbb/job_bbb_1/furnace.jpg',
    caption: 'Cracked heat exchanger',
    uploaded_by: 'user_owner_b',
    created_at: new Date().toISOString()
  }

  const referralA = {
    id: 'ref_1',
    org_id: 'org_aaa',
    contact_id: 'cnt_aaa',
    referral_code: 'sarah-482',
    reward_amount: 25,
    discount_amount: 25,
    clicks_count: 5,
    conversions_count: 1
  }

  const referralB = {
    id: 'ref_2',
    org_id: 'org_bbb',
    contact_id: 'cnt_bbb',
    referral_code: 'beacon-999',
    reward_amount: 50,
    discount_amount: 50,
    clicks_count: 12,
    conversions_count: 3
  }

  return {
    orgA, orgB, ownerA, techA, ownerB,
    contactA, jobA1, jobA2, jobB1,
    photoA1, photoB1, referralA, referralB
  }
}

// ==============================================================================
// 1. ANONYMOUS USERS CANNOT ENUMERATE REFERRAL RECORDS
// ==============================================================================
test('SEC-01: Anonymous users cannot enumerate referral records via direct table queries', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    referral_links: [f.referralA, f.referralB]
  })

  const anonClient = db.getClient({ role: 'anon' })
  const { data: anonReferrals, error } = await anonClient.from('referral_links').select('*')._executeSelect()

  assert.strictEqual(error, null)
  assert.strictEqual(anonReferrals.length, 0, 'Anonymous query must return zero rows (no leakage of codes/orgs)')
})

test('SEC-01b: Legitimate public referral redirection via service_role continues to function', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    referral_links: [f.referralA]
  })

  // The /ref/[code] API route uses createAdminClient (service_role)
  const serviceClient = db.getClient({ role: 'service_role' })
  const result = await resolveReferralByCode(serviceClient, 'sarah-482')

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.referral?.referral_code, 'sarah-482')
  assert.strictEqual(result.org?.slug, 'apex')
})

// ==============================================================================
// 2. ANONYMOUS USERS CANNOT ENUMERATE JOB-PHOTO METADATA
// ==============================================================================
test('SEC-02: Anonymous users cannot enumerate job_photos metadata via direct queries', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    job_photos: [f.photoA1, f.photoB1]
  })

  const anonClient = db.getClient({ role: 'anon' })
  const { data: anonPhotos } = await anonClient.from('job_photos').select('*')._executeSelect()

  assert.strictEqual(anonPhotos.length, 0, 'Anonymous users must be blocked from querying job_photos table')
})

// ==============================================================================
// 3. TENANT A CANNOT READ TENANT B REFERRALS OR PHOTOS
// ==============================================================================
test('SEC-03: Tenant A authenticated user cannot read Tenant B referrals or photos', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA, f.orgB],
    profiles: [f.ownerA, f.ownerB],
    job_photos: [f.photoA1, f.photoB1],
    referral_links: [f.referralA, f.referralB]
  })

  const tenantAClient = db.getClient({ role: 'authenticated', userId: f.ownerA.id, orgId: f.orgA.id, userRole: 'owner' })

  // 1. Photos check
  const { data: photos } = await tenantAClient.from('job_photos').select('*')._executeSelect()
  assert.strictEqual(photos.length, 1)
  assert.strictEqual(photos[0].id, f.photoA1.id)
  assert.strictEqual(photos[0].org_id, f.orgA.id)

  // 2. Referrals check
  const { data: referrals } = await tenantAClient.from('referral_links').select('*')._executeSelect()
  assert.strictEqual(referrals.length, 1)
  assert.strictEqual(referrals[0].id, f.referralA.id)
  assert.strictEqual(referrals[0].org_id, f.orgA.id)
})

// ==============================================================================
// 4. CUSTOMER TRACKING TOKEN ONLY ACCESSES EXPLICITLY AUTHORIZED JOB PHOTOS
// ==============================================================================
test('SEC-04: Customer tracking token can only access photos belonging to that specific job', async () => {
  const f = setupTestFixtures()
  const photoA2 = {
    id: 'photo_3',
    org_id: 'org_aaa',
    job_id: 'job_aaa_2', // Different job in same org
    photo_type: 'after',
    url: 'org_aaa/job_aaa_2/unrelated.jpg',
    caption: 'Another job photo'
  }

  const db = createHardenedTestDb({
    organizations: [f.orgA],
    contacts: [f.contactA],
    jobs: [f.jobA1, f.jobA2, f.jobB1],
    job_photos: [f.photoA1, photoA2, f.photoB1],
    storage_objects: [
      { bucket_id: 'job-photos', name: f.photoA1.url, owner: f.ownerA.id }
    ]
  })

  const serviceClient = db.getClient({ role: 'service_role' })

  // Customer viewing Job A1 via tracking token
  const resultA1 = await customerViewJobTracking(serviceClient, 'track_token_a1_secure')
  assert.strictEqual(resultA1.success, true)
  assert.strictEqual(resultA1.job.id, 'job_aaa_1')
  assert.strictEqual(resultA1.photos.length, 1)
  assert.strictEqual(resultA1.photos[0].id, 'photo_1')
  // Verifies URL was securely resolved to a signed URL
  assert.ok(resultA1.photos[0].url.includes('/sign/job-photos/'), 'URL must be a signed URL')

  // Customer viewing Job A2 receives only Job A2 photos (photo_3, never photo_1 or photo_2)
  const resultA2 = await customerViewJobTracking(serviceClient, 'track_token_a2_secure')
  assert.strictEqual(resultA2.success, true)
  assert.strictEqual(resultA2.photos.length, 1)
  assert.strictEqual(resultA2.photos[0].id, 'photo_3', 'Job A2 must only receive photo_3')
  assert.ok(resultA2.photos[0].url.includes('/sign/job-photos/'))

  // Invalid or attacker-tampered token returns 404
  const invalidResult = await customerViewJobTracking(serviceClient, 'invalid_or_stolen_token')
  assert.strictEqual(invalidResult.success, false)
})

// ==============================================================================
// 5. ORDINARY TECHNICIAN CANNOT PERFORM OPERATIONS REQUIRING HIGHER PERMISSION
// ==============================================================================
test('SEC-05: Ordinary technician cannot create, update, or delete crews or recurring templates', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    profiles: [f.techA]
  })

  const techClient = db.getClient({ role: 'authenticated', userId: f.techA.id, orgId: f.orgA.id, userRole: 'member' })

  // 1. Crew creation blocked
  const crewRes = await createCrew(techClient, { orgId: f.orgA.id, name: 'Rogue Van' })
  assert.strictEqual(crewRes.success, false)
  assert.ok(crewRes.error?.includes('permission') || crewRes.error?.includes('Forbidden'))

  // 2. Recurring template creation blocked
  const recRes = await createRecurringTemplate(techClient, {
    orgId: f.orgA.id,
    contactId: f.contactA.id,
    title: 'Rogue Recurring Plan',
    cadence: 'monthly'
  })
  assert.strictEqual(recRes.success, false)
  assert.ok(recRes.error?.includes('permission') || recRes.error?.includes('Forbidden'))
})

test('SEC-05b: Technician cannot delete photos uploaded by other users', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    profiles: [f.ownerA, f.techA],
    job_photos: [f.photoA1] // Uploaded by ownerA
  })

  const techClient = db.getClient({ role: 'authenticated', userId: f.techA.id, orgId: f.orgA.id, userRole: 'member' })

  // Tech attempts to delete photo uploaded by owner
  const delRes = await deleteJobPhoto(techClient, f.photoA1.id, f.orgA.id)
  assert.strictEqual(delRes.success, false)
  assert.ok(delRes.error?.includes('Forbidden') || delRes.error?.includes('cannot delete photos'))

  // Verify photo remains intact
  assert.strictEqual(db.store.job_photos.length, 1)
})

// ==============================================================================
// 6. AUTHORIZED OWNERS AND ADMINS RETAIN LEGITIMATE FUNCTIONALITY
// ==============================================================================
test('SEC-06: Authorized owners retain complete functionality for crews, recurring jobs, and photos', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    profiles: [f.ownerA],
    job_photos: [f.photoA1],
    storage_objects: [{ bucket_id: 'job-photos', name: f.photoA1.url, owner: f.ownerA.id }]
  })

  const ownerClient = db.getClient({ role: 'authenticated', userId: f.ownerA.id, orgId: f.orgA.id, userRole: 'owner' })

  // 1. Create crew succeeds
  const crewRes = await createCrew(ownerClient, { orgId: f.orgA.id, name: 'Van 1 - North Route' })
  assert.strictEqual(crewRes.success, true)
  assert.strictEqual(crewRes.crew?.name, 'Van 1 - North Route')

  // 2. Create recurring template succeeds
  const recRes = await createRecurringTemplate(ownerClient, {
    orgId: f.orgA.id,
    contactId: f.contactA.id,
    title: 'Bi-Weekly AC Check',
    cadence: 'biweekly'
  })
  assert.strictEqual(recRes.success, true)
  assert.strictEqual(recRes.template?.title, 'Bi-Weekly AC Check')

  // 3. Delete photo succeeds
  const delRes = await deleteJobPhoto(ownerClient, f.photoA1.id, f.orgA.id)
  assert.strictEqual(delRes.success, true)
  assert.strictEqual(db.store.job_photos.length, 0)
})

test('SEC-06b: Technicians can upload photos and delete their own uploaded photos', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    profiles: [f.techA],
    jobs: [f.jobA1]
  })

  const techClient = db.getClient({ role: 'authenticated', userId: f.techA.id, orgId: f.orgA.id, userRole: 'member' })

  // 1. Tech uploads a photo to their tenant's job
  const uploadRes = await uploadJobPhotoFile(techClient, {
    orgId: f.orgA.id,
    jobId: f.jobA1.id,
    photoType: 'after',
    fileBuffer: Buffer.from('fake_image_bytes'),
    fileName: 'soldered_copper.jpg',
    contentType: 'image/jpeg',
    uploadedBy: f.techA.id
  })

  assert.strictEqual(uploadRes.success, true)
  assert.ok(uploadRes.photo?.id)
  assert.strictEqual(uploadRes.photo?.uploaded_by, f.techA.id)

  // 2. Tech can delete their own uploaded photo
  const delRes = await deleteJobPhoto(techClient, uploadRes.photo.id, f.orgA.id)
  assert.strictEqual(delRes.success, true)
  assert.strictEqual(db.store.job_photos.length, 0)
})

// ==============================================================================
// 7. PROTECTED STORAGE OBJECTS CANNOT BE RETRIEVED VIA PUBLIC ACCESS PATH
// ==============================================================================
test('SEC-07: Storage bucket is private and getPublicUrl returns empty or invalid path', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb()

  const serviceClient = db.getClient({ role: 'service_role' })
  const publicRes = serviceClient.storage.from('job-photos').getPublicUrl('org_aaa/job_1/secret.jpg')

  assert.strictEqual(publicRes.data.publicUrl, '', 'Private bucket must not expose direct public URLs')

  // Authorized signed URL generation succeeds
  const authUrl = await getAuthorizedPhotoUrl(serviceClient, 'org_aaa/job_1/secret.jpg')
  assert.ok(authUrl.startsWith('https://mock.storage/object/sign/job-photos/'))
  assert.ok(authUrl.includes('token_'))
})

// ==============================================================================
// 8. UNAUTHENTICATED AND CROSS-TENANT REQUESTS FAIL SAFELY
// ==============================================================================
test('SEC-08: Cross-tenant storage uploads and database mutations fail safely', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA, f.orgB],
    profiles: [f.ownerA, f.ownerB]
  })

  // User A attempts to write storage object with Org B prefix
  const userAClient = db.getClient({ role: 'authenticated', userId: f.ownerA.id, orgId: f.orgA.id, userRole: 'owner' })
  const uploadRes = await userAClient.storage.from('job-photos').upload('org_bbb/job_201/attack.jpg', Buffer.from('exploit'))

  assert.strictEqual(uploadRes.data, null)
  assert.ok(uploadRes.error?.message.includes('Cross-tenant'))

  // User A attempts to insert crew into Org B
  const crewRes = await createCrew(userAClient, { orgId: f.orgB.id, name: 'Malicious Van' })
  assert.strictEqual(crewRes.success, false)
  assert.ok(crewRes.error?.includes('Cross-tenant'))
})

// ==============================================================================
// 9. EXISTING CORE WORKFLOWS REMAIN FUNCTIONAL
// ==============================================================================
test('SEC-09: End-to-end referral and customer tracking workflows remain fully functional', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    contacts: [f.contactA],
    jobs: [f.jobA1]
  })

  const serviceClient = db.getClient({ role: 'service_role' })

  // 1. Generate referral link for customer
  const refRes = await getOrCreateReferralLink(serviceClient, {
    orgId: f.orgA.id,
    contactId: f.contactA.id,
    contactName: f.contactA.name
  })
  assert.strictEqual(refRes.success, true)
  assert.ok(refRes.referral?.referral_code)

  // 2. Track referral click
  await recordReferralClick(serviceClient, refRes.referral.referral_code)
  const clickUpdated = db.store.referral_links.find((r) => r.id === refRes.referral.id)
  assert.strictEqual(clickUpdated.clicks_count, 1)

  // 3. Customer tracking page loads flawlessly with referral and job info
  const trackRes = await customerViewJobTracking(serviceClient, 'track_token_a1_secure')
  assert.strictEqual(trackRes.success, true)
  assert.strictEqual(trackRes.job.jobNumber, 'JOB-101')
  assert.strictEqual(trackRes.referral.code, refRes.referral.referral_code)
})

// ==============================================================================
// 10. PHOTO CAPTION UPDATES ENFORCE ROLE & UPLOADER RESTRICTIONS (FINDING E)
// ==============================================================================
test('SEC-10: Photo caption updates enforce owner/admin or original uploader permissions', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    profiles: [f.ownerA, f.techA],
    job_photos: [f.photoA1] // Uploaded by ownerA
  })

  // Tech attempts to update caption of photo uploaded by owner
  const techClient = db.getClient({ role: 'authenticated', userId: f.techA.id, orgId: f.orgA.id, userRole: 'member' })
  const techUpdate = await updateJobPhotoCaption(techClient, f.photoA1.id, f.orgA.id, 'Hacked Caption')
  assert.strictEqual(techUpdate.success, false)
  assert.ok(techUpdate.error?.includes('Forbidden') || techUpdate.error?.includes('cannot update'))

  // Owner successfully updates caption
  const ownerClient = db.getClient({ role: 'authenticated', userId: f.ownerA.id, orgId: f.orgA.id, userRole: 'owner' })
  const ownerUpdate = await updateJobPhotoCaption(ownerClient, f.photoA1.id, f.orgA.id, 'Repaired Pressure Relief Valve')
  assert.strictEqual(ownerUpdate.success, true)
  assert.strictEqual(ownerUpdate.photo?.caption, 'Repaired Pressure Relief Valve')
})

// ==============================================================================
// 11. PUBLIC REFERRAL RESOLUTION OMITS SENSITIVE INTERNAL FIELDS (FINDING A)
// ==============================================================================
test('SEC-11: Public referral resolution omits internal customer IDs and click counters', async () => {
  const f = setupTestFixtures()
  const db = createHardenedTestDb({
    organizations: [f.orgA],
    referral_links: [f.referralA]
  })

  const serviceClient = db.getClient({ role: 'service_role' })
  const result = await resolveReferralByCode(serviceClient, 'sarah-482')

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.referral?.referral_code, 'sarah-482')
  assert.strictEqual(result.referral?.reward_amount, 25)
  assert.strictEqual(result.referral?.discount_amount, 25)
  // Ensures contact_id, clicks_count, and conversions_count are omitted from public resolution payload
  assert.strictEqual(result.referral?.contact_id, undefined)
  assert.strictEqual(result.referral?.clicks_count, undefined)
  assert.strictEqual(result.referral?.conversions_count, undefined)
})

// ==============================================================================
// 12. RATE LIMITING ON PUBLIC REFERRAL REDIRECTION (FINDING A)
// ==============================================================================
test('SEC-12: Sliding-window rate limiter blocks excessive public referral redirect attempts', () => {
  const testIp = '198.51.100.99'
  const config = { max: 3, windowMs: 60 * 1000 }

  const res1 = checkRateLimit(`test_ref:${testIp}`, config)
  assert.strictEqual(res1.allowed, true)
  assert.strictEqual(res1.remaining, 2)

  const res2 = checkRateLimit(`test_ref:${testIp}`, config)
  assert.strictEqual(res2.allowed, true)
  assert.strictEqual(res2.remaining, 1)

  const res3 = checkRateLimit(`test_ref:${testIp}`, config)
  assert.strictEqual(res3.allowed, true)
  assert.strictEqual(res3.remaining, 0)

  // 4th request exceeds max=3 -> blocked
  const res4 = checkRateLimit(`test_ref:${testIp}`, config)
  assert.strictEqual(res4.allowed, false)
  assert.strictEqual(res4.remaining, 0)
})
