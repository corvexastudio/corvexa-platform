import test from 'node:test'
import assert from 'node:assert/strict'
import { getInitials } from '../src/lib/brand/initials.ts'

test('Phase 3.15 - Contractor Brand: getInitials generates crisp monograms across edge cases', () => {
  assert.equal(getInitials('Apex Plumbing & HVAC'), 'AP')
  assert.equal(getInitials("Tisuhi23's Services"), 'TS')
  assert.equal(getInitials('Mike'), 'MI')
  assert.equal(getInitials(''), 'CD')
  assert.equal(getInitials(null), 'CD')
  assert.equal(getInitials('   '), 'CD')
  assert.equal(getInitials('Rapid Emergency Rooter'), 'RE')
  assert.equal(getInitials('1st Class Electric'), '1C')
})

test('Phase 3.15 - Logo API: Route file exports POST and DELETE handlers', async () => {
  const logoRoute = await import('../src/app/api/client/organization/logo/route.ts')
  assert.equal(typeof logoRoute.POST, 'function', 'POST handler must exist')
  assert.equal(typeof logoRoute.DELETE, 'function', 'DELETE handler must exist')
})

test('Phase 3.15 - Migration 59: SQL migration exists and defines logo_url column', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const migrationPath = path.resolve('supabase/migrations/59_add_organization_logo_url.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration 59 must exist')

  const content = fs.readFileSync(migrationPath, 'utf8')
  assert.ok(content.includes('logo_url TEXT'), 'Must add logo_url to organizations table')
  assert.ok(content.includes('organization-logos'), 'Must create organization-logos storage bucket')
})

test('Phase 3.15 - Booking API: /api/book/[slug] includes logo_url and industry', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const bookingRoutePath = path.resolve('src/app/api/book/[slug]/route.ts')
  const content = fs.readFileSync(bookingRoutePath, 'utf8')

  assert.ok(content.includes('logo_url'), 'Booking route must query and return logo_url')
  assert.ok(content.includes('industry'), 'Booking route must query and return industry')
})

test('Phase 3.15 - Invoice View: customerViewInvoice includes logo_url in query', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const invoiceManagerPath = path.resolve('src/lib/payments/invoice-manager.ts')
  const content = fs.readFileSync(invoiceManagerPath, 'utf8')

  assert.ok(content.includes('logo_url'), 'Invoice manager must query logo_url from organizations')
})
