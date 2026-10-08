import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { getTenantContext } from '../src/lib/security/tenant-context.ts'

test('1. Security Gate: getTenantContext returns 403 for unregistered profile', async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'usr-new-signup', email: 'contractor@example.com' } }, error: null })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: { message: 'Row not found', code: 'PGRST116' } })
        })
      })
    })
  }

  const result = await getTenantContext(undefined, mockSupabase)
  assert.strictEqual(result.ok, false)
  if (!result.ok) {
    assert.strictEqual(result.status, 403)
    assert.strictEqual(result.error, 'Forbidden: User profile not registered')
  }
})

test('2. Security Gate: getTenantContext returns 403 when profile has no org_id', async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'usr-pending-org', email: 'builder@example.com' } }, error: null })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'usr-pending-org', org_id: null, role: 'owner', full_name: 'Builder Bob', email: 'builder@example.com' },
            error: null
          })
        })
      })
    })
  }

  const result = await getTenantContext(undefined, mockSupabase)
  assert.strictEqual(result.ok, false)
  if (!result.ok) {
    assert.strictEqual(result.status, 403)
    assert.strictEqual(result.error, 'Forbidden: User is not linked to an organization')
  }
})

test('3. Onboarding Route: Source code guarantees pre-generated orgId to avoid RLS SELECT lockout', () => {
  const routePath = path.resolve(process.cwd(), 'src/app/api/onboarding/route.ts')
  const content = fs.readFileSync(routePath, 'utf8')

  // Verify orgId is generated upfront
  assert.match(content, /const orgId = crypto\.randomUUID\(\)/, 'Must generate orgId before insert')
  
  // Verify organizations insert uses id: orgId
  assert.match(content, /id: orgId/, 'Must explicitly provide pre-generated orgId in insert')
  
  // Verify profiles upsert links id: user.id and org_id: orgId
  assert.match(content, /org_id: orgId/, 'Must link profile to the pre-generated orgId')
  
  // Verify existing profile check exists
  assert.match(content, /existingProfile\?\.org_id/, 'Must check for existing organization linkage')
})

test('4. Client Layout: Source code implements authState gating and prevents un-onboarded child rendering', () => {
  const layoutPath = path.resolve(process.cwd(), 'src/app/client/layout.tsx')
  const content = fs.readFileSync(layoutPath, 'utf8')

  // Verify authState gate
  assert.match(content, /authState/, 'Must track authState for rendering')
  assert.match(content, /router\.replace\('\/client\/onboarding'\)/, 'Must redirect un-onboarded user to onboarding')
  assert.match(content, /router\.replace\('\/client\/login'\)/, 'Must redirect unauthenticated user to login')
  assert.match(content, /authState === 'checking' \|\| authState === 'redirecting'/, 'Must guard rendering during verification')
})

test('5. Client Pages: Source code redirects to onboarding on un-onboarded 403 profile error', () => {
  const dashboardPath = path.resolve(process.cwd(), 'src/app/client/dashboard/page.tsx')
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8')
  assert.match(dashboardContent, /\/client\/onboarding/, 'Dashboard must redirect to onboarding on 403')

  const leadsPath = path.resolve(process.cwd(), 'src/app/client/leads/page.tsx')
  const leadsContent = fs.readFileSync(leadsPath, 'utf8')
  assert.match(leadsContent, /\/client\/onboarding/, 'Leads must redirect to onboarding on missing profile')

  const calendarPath = path.resolve(process.cwd(), 'src/app/client/calendar/page.tsx')
  const calendarContent = fs.readFileSync(calendarPath, 'utf8')
  assert.match(calendarContent, /\/client\/onboarding/, 'Calendar must redirect to onboarding on missing profile')

  const settingsPath = path.resolve(process.cwd(), 'src/app/client/settings/page.tsx')
  const settingsContent = fs.readFileSync(settingsPath, 'utf8')
  assert.match(settingsContent, /\/client\/onboarding/, 'Settings must redirect to onboarding on missing profile')

  const inboxPath = path.resolve(process.cwd(), 'src/app/client/inbox/page.tsx')
  const inboxContent = fs.readFileSync(inboxPath, 'utf8')
  assert.match(inboxContent, /\/client\/onboarding/, 'Inbox must redirect to onboarding on 403')
})

test('6. Database Migrations: Migration 22 contains handle_new_user trigger and backfill', () => {
  const migPath = path.resolve(process.cwd(), 'supabase/migrations/22_auto_profile_trigger_and_onboarding_fix.sql')
  const migContent = fs.readFileSync(migPath, 'utf8')

  assert.match(migContent, /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/, 'Must define handle_new_user function')
  assert.match(migContent, /on_auth_user_created/, 'Must define on_auth_user_created trigger')
  assert.match(migContent, /INSERT INTO public\.profiles/, 'Must auto-insert into public.profiles')
})
