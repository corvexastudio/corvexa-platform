import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('recordJobTimestamp in job-manager.ts enforces Starter Pass gating on all field actions', () => {
  const filePath = path.resolve(rootDir, 'src/lib/jobs/job-manager.ts')
  const content = fs.readFileSync(filePath, 'utf8')

  // Verify recordJobTimestamp contains the entitlement check before advancing
  const fnIdx = content.indexOf('export async function recordJobTimestamp(')
  assert.ok(fnIdx !== -1, 'recordJobTimestamp function exists')
  const fnBody = content.slice(fnIdx, fnIdx + 2000)

  assert.ok(fnBody.includes('STARTER_LIMIT_REACHED'), 'recordJobTimestamp guards against STARTER_LIMIT_REACHED')
  assert.ok(fnBody.includes('getFreeTierJobUsage'), 'recordJobTimestamp checks getFreeTierJobUsage')
  assert.ok(fnBody.includes('upgradeRequired: true'), 'recordJobTimestamp returns upgradeRequired: true')
})

test('API route /api/client/jobs/[id]/timestamp returns 402 on upgradeRequired', () => {
  const filePath = path.resolve(rootDir, 'src/app/api/client/jobs/[id]/timestamp/route.ts')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.ok(content.includes('status: 402'), 'Timestamp route returns 402 status code on upgradeRequired')
  assert.ok(content.includes('upgradeRequired'), 'Timestamp route inspects upgradeRequired flag')
})

test('API route /api/client/appointments gates manual appointment scheduling at Step 1', () => {
  const filePath = path.resolve(rootDir, 'src/app/api/client/appointments/route.ts')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.ok(content.includes('STARTER_LIMIT_REACHED'), 'Appointments route guards against STARTER_LIMIT_REACHED')
  assert.ok(content.includes('status: 402'), 'Appointments route returns 402 when starter limit is reached')
  assert.ok(content.includes('getFreeTierJobUsage'), 'Appointments route checks getFreeTierJobUsage')
})

test('API route /api/client/quotes/[id]/convert gates quote-to-job conversion at Step 1', () => {
  const filePath = path.resolve(rootDir, 'src/app/api/client/quotes/[id]/convert/route.ts')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.ok(content.includes('STARTER_LIMIT_REACHED'), 'Quote convert route guards against STARTER_LIMIT_REACHED')
  assert.ok(content.includes('status: 402'), 'Quote convert route returns 402 when starter limit is reached')
  assert.ok(content.includes('getFreeTierJobUsage'), 'Quote convert route checks getFreeTierJobUsage')
})

test('Field Route and Dashboard never fall back to fake $250 for unpriced jobs', () => {
  const fieldPage = path.resolve(rootDir, 'src/app/client/field/page.tsx')
  const fieldContent = fs.readFileSync(fieldPage, 'utf8')
  assert.ok(!fieldContent.includes(': 250'), 'Field page does not hardcode : 250 in amountDue fallback')

  const dashPage = path.resolve(rootDir, 'src/app/client/dashboard/page.tsx')
  const dashContent = fs.readFileSync(dashPage, 'utf8')
  assert.ok(!dashContent.includes('return 250'), 'Dashboard does not hardcode return 250 in resolveGatedJobAmount')
})

test('createQuote in quote-manager.ts and /api/client/quotes gate estimate creation when Starter Pass limit reached', () => {
  const quoteMgrPath = path.resolve(rootDir, 'src/lib/quotes/quote-manager.ts')
  const quoteMgrContent = fs.readFileSync(quoteMgrPath, 'utf8')

  const fnIdx = quoteMgrContent.indexOf('export async function createQuote(')
  assert.ok(fnIdx !== -1, 'createQuote function exists')
  const fnBody = quoteMgrContent.slice(fnIdx, fnIdx + 2500)
  assert.ok(fnBody.includes('STARTER_LIMIT_REACHED'), 'createQuote guards against STARTER_LIMIT_REACHED')
  assert.ok(fnBody.includes('getFreeTierJobUsage'), 'createQuote checks getFreeTierJobUsage')

  const quoteRoutePath = path.resolve(rootDir, 'src/app/api/client/quotes/route.ts')
  const quoteRouteContent = fs.readFileSync(quoteRoutePath, 'utf8')
  assert.ok(quoteRouteContent.includes('status: 402'), 'Quotes POST route returns 402 on Starter Pass limit')
  assert.ok(quoteRouteContent.includes('STARTER_LIMIT_REACHED'), 'Quotes POST route contains STARTER_LIMIT_REACHED')
})

test('ScheduleDispatchHub gates estimate creation, invoice generation, and status complete upfront without fake $250', () => {
  const hubPath = path.resolve(rootDir, 'src/components/schedule/schedule-dispatch-hub.tsx')
  const hubContent = fs.readFileSync(hubPath, 'utf8')

  assert.ok(hubContent.includes('triggerStarterGating'), 'ScheduleDispatchHub defines triggerStarterGating helper')
  assert.ok(hubContent.includes('starterUsage?.isLimitReached'), 'ScheduleDispatchHub checks starterUsage.isLimitReached')
  assert.ok(!hubContent.includes(': 250'), 'ScheduleDispatchHub no longer contains : 250 fallback')
  assert.ok(!hubContent.includes('amount: 250'), 'ScheduleDispatchHub no longer hardcodes amount: 250')
  assert.ok(hubContent.includes('Unlock Job & Complete ($99/mo)'), 'ScheduleDispatchHub renders visual lock badge on complete button')
  assert.ok(hubContent.includes('Unlock to Dispatch'), 'ScheduleDispatchHub renders visual lock badge on dispatch button')
})

test('Field Route gates all field actions upfront when starter limit is reached', () => {
  const fieldPagePath = path.resolve(rootDir, 'src/app/client/field/page.tsx')
  const fieldContent = fs.readFileSync(fieldPagePath, 'utf8')

  assert.ok(fieldContent.includes('starterUsage'), 'Field Route tracks starterUsage state')
  assert.ok(fieldContent.includes('triggerStarterGating'), 'Field Route defines triggerStarterGating')
  assert.ok(fieldContent.includes('starterUsage?.isLimitReached'), 'Field Route checks isLimitReached in timestamp actions')
  assert.ok(fieldContent.includes('Unlock Job & Complete ($99/mo)'), 'Field Route displays unlock badge on complete button')
  assert.ok(fieldContent.includes('Unlock to Dispatch'), 'Field Route displays unlock badge on dispatch button')
  assert.ok(fieldContent.includes('Unlock to Arrive'), 'Field Route displays unlock badge on arrive button')
})

test('Quotes and Invoices pages gate creation upfront and handle 402 upgrade modals without fake $250 fallback', () => {
  const quotesPagePath = path.resolve(rootDir, 'src/app/client/quotes/page.tsx')
  const quotesContent = fs.readFileSync(quotesPagePath, 'utf8')
  assert.ok(!quotesContent.includes('|| 250'), 'Quotes page no longer contains || 250 fallback')
  assert.ok(quotesContent.includes('STARTER_LIMIT_REACHED'), 'Quotes page handles STARTER_LIMIT_REACHED on create')
  assert.ok(quotesContent.includes('starterUsage?.isLimitReached'), 'Quotes page gates new estimate and conversions upfront')

  const invoicesPagePath = path.resolve(rootDir, 'src/app/client/invoices/page.tsx')
  const invoicesContent = fs.readFileSync(invoicesPagePath, 'utf8')
  assert.ok(!invoicesContent.includes(': 250'), 'Invoices page no longer contains : 250 fallback')
  assert.ok(invoicesContent.includes('starterUsage?.isLimitReached'), 'Invoices page gates new invoice button upfront')
})
