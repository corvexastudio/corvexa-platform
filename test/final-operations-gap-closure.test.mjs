import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Gap Closure 1: Attention Queue Category Schema Integrity', () => {
  const dashboardServicePath = path.resolve('src/lib/dashboard/dashboard-service.ts')
  const content = fs.readFileSync(dashboardServicePath, 'utf8')

  // Verify all 8 categories exist in AttentionItem category union
  const expectedCategories = [
    'lead',
    'message',
    'missed_call',
    'quote',
    'appointment',
    'invoice',
    'retention',
    'failed_sms'
  ]

  for (const cat of expectedCategories) {
    assert.ok(
      content.includes(`'${cat}'`),
      `Category '${cat}' must be declared in AttentionItem category type`
    )
  }

  // Verify failedSmsQuery is declared and queried in getAttentionQueue
  assert.ok(content.includes('failedSmsQuery'), 'failedSmsQuery must exist in getAttentionQueue')
  assert.ok(content.includes("delivery_status', 'failed'"), 'failedSmsQuery must query delivery_status failed')
})

test('Gap Closure 2: Dashboard Attention Queue Category Filter Preservation', () => {
  const dashboardPagePath = path.resolve('src/app/client/dashboard/page.tsx')
  const content = fs.readFileSync(dashboardPagePath, 'utf8')

  // Verify visibleAttentionItems does not artificially restrict categories
  assert.ok(
    !content.includes("['message', 'missed_call', 'lead', 'appointment'].includes"),
    'Dashboard must not filter out quotes, invoices, retention, or failed SMS'
  )

  // Verify getAttentionMeta handles all categories
  assert.ok(content.includes("case 'failed_sms':"), 'getAttentionMeta must handle failed_sms')
  assert.ok(content.includes("case 'invoice':"), 'getAttentionMeta must handle invoice')
  assert.ok(content.includes("case 'retention':"), 'getAttentionMeta must handle retention')
  assert.ok(content.includes("case 'quote':"), 'getAttentionMeta must handle quote')
  assert.ok(content.includes("case 'appointment':"), 'getAttentionMeta must handle appointment')
})

test('Gap Closure 3: Field Direct Camera Capture & Native Fallback', () => {
  const fieldPagePath = path.resolve('src/app/client/field/page.tsx')
  const content = fs.readFileSync(fieldPagePath, 'utf8')

  // Verify direct native camera file input with capture="environment"
  assert.ok(
    content.includes('capture="environment"'),
    'Field page must include native camera input with capture="environment"'
  )
  assert.ok(
    content.includes('handleTriggerDirectCamera'),
    'Field page must have handleTriggerDirectCamera handler'
  )
  assert.ok(
    content.includes('handleDirectPhotoSelected'),
    'Field page must have handleDirectPhotoSelected handler'
  )
  assert.ok(
    content.includes('handleRetryDirectUpload'),
    'Field page must have upload failure retry handler'
  )
})

test('Gap Closure 4: Jobs API Server-Side Technician Isolation & Local Day Boundaries', () => {
  const jobsApiPath = path.resolve('src/app/api/client/jobs/route.ts')
  const content = fs.readFileSync(jobsApiPath, 'utf8')

  // Verify technician role boundary enforcement
  assert.ok(
    content.includes("role === 'technician'"),
    'Jobs API must check role === technician'
  )
  assert.ok(
    content.includes('assigned_to.eq.'),
    'Jobs API must restrict query to assigned technician'
  )

  // Verify local day boundary resolution
  assert.ok(
    content.includes('getLocalDayUtcBoundaries'),
    'Jobs API must use getLocalDayUtcBoundaries for dateParam and isTodayOnly'
  )
})

test('Gap Closure 5: Schedule Month View Mobile Compactness', () => {
  const schedulePath = path.resolve('src/components/schedule/schedule-dispatch-hub.tsx')
  const content = fs.readFileSync(schedulePath, 'utf8')

  // Verify responsive cell height and mobile activity dots
  assert.ok(
    content.includes('min-h-[64px] sm:min-h-[110px]'),
    'Month view cells must use compact min-h-[64px] on mobile'
  )
  assert.ok(
    content.includes('hidden sm:block'),
    'Job titles must be hidden on mobile month grid'
  )
  assert.ok(
    content.includes('flex sm:hidden'),
    'Mobile month grid must render activity dots instead of bulky text pills'
  )
})

test('Gap Closure 6: Strict Zero Em Dash Enforcement Across Daily Operations', () => {
  const filesToAudit = [
    'src/app/api/client/dashboard/route.ts',
    'src/app/api/client/jobs/route.ts',
    'src/app/client/dashboard/page.tsx',
    'src/app/client/field/page.tsx',
    'src/app/client/layout.tsx',
    'src/components/schedule/schedule-dispatch-hub.tsx',
    'src/lib/dashboard/dashboard-service.ts',
    'src/lib/temporal/timezone.ts',
    'src/lib/services/call-recovery.ts',
    'src/components/billing/plan-limit-badge.tsx',
    'src/components/operations/customer-dossier-sheet.tsx',
    'src/components/operations/date-strip-selector.tsx',
    'src/components/operations/job-status-badge.tsx',
    'src/components/operations/touch-action-row.tsx'
  ]

  const emDashRegex = /[\u2014]/

  for (const relativePath of filesToAudit) {
    const fullPath = path.resolve(relativePath)
    if (fs.existsSync(fullPath)) {
      const fileContent = fs.readFileSync(fullPath, 'utf8')
      const lines = fileContent.split('\n')
      lines.forEach((line, lineIndex) => {
        assert.ok(
          !emDashRegex.test(line),
          `Found forbidden em dash in ${relativePath}:${lineIndex + 1}: ${line.trim()}`
        )
      })
    }
  }
})
