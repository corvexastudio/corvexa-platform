import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Test 1: Verify FilterTabs source code adheres to WAI-ARIA tablist pattern
test('Accessibility: FilterTabs implements WAI-ARIA 1.2 tablist and keyboard navigation', () => {
  const filterTabsPath = path.resolve('src/components/ui/filter-tabs.tsx')
  const content = fs.readFileSync(filterTabsPath, 'utf8')

  // ARIA role and attributes
  assert.ok(content.includes('role="tablist"'), 'FilterTabs must define role="tablist"')
  assert.ok(content.includes('role="tab"'), 'FilterTabs item must define role="tab"')
  assert.ok(content.includes('aria-selected={isActive}'), 'FilterTabs must set aria-selected')
  assert.ok(content.includes('tabIndex={isActive ? 0 : -1}'), 'FilterTabs must use roving tabIndex (0 active, -1 inactive)')

  // Keyboard navigation support
  assert.ok(content.includes("e.key === 'ArrowRight'"), 'Must handle ArrowRight')
  assert.ok(content.includes("e.key === 'ArrowLeft'"), 'Must handle ArrowLeft')
  assert.ok(content.includes("e.key === 'Home'"), 'Must handle Home key')
  assert.ok(content.includes("e.key === 'End'"), 'Must handle End key')
  assert.ok(content.includes('buttons?.[nextIndex]?.focus()'), 'Must programmatically focus active tab on arrow key navigation')
})

// Test 2: Verify Semantic Status Badges & High-Contrast Tokens
test('Design System: Badge variants enforce accessible color contrast in light and dark modes', () => {
  const badgePath = path.resolve('src/components/ui/badge.tsx')
  const content = fs.readFileSync(badgePath, 'utf8')

  // Semantic variants present
  assert.ok(content.includes('success:'), 'Badge must support success variant')
  assert.ok(content.includes('warning:'), 'Badge must support warning variant')
  assert.ok(content.includes('danger:'), 'Badge must support danger variant')
  assert.ok(content.includes('info:'), 'Badge must support info variant')
  assert.ok(content.includes('neutral:'), 'Badge must support neutral variant')

  // Light/Dark contrast token pairings
  assert.ok(content.includes('text-emerald-800') && content.includes('dark:text-emerald-300'), 'Success variant must have high contrast light and dark text')
  assert.ok(content.includes('text-amber-800') && content.includes('dark:text-amber-300'), 'Warning variant must have high contrast light and dark text')
  assert.ok(content.includes('text-rose-800') && content.includes('dark:text-rose-300'), 'Danger variant must have high contrast light and dark text')
  assert.ok(content.includes('text-sky-800') && content.includes('dark:text-sky-300'), 'Info variant must have high contrast light and dark text')
})

// Test 3: Verify Touch Target Consistency Across Core Mobile Actions
test('Mobile Ergonomics: Primary touch targets meet 44px WCAG guideline', () => {
  // 1. Button component
  const buttonPath = path.resolve('src/components/ui/button.tsx')
  const buttonContent = fs.readFileSync(buttonPath, 'utf8')
  assert.ok(buttonContent.includes('min-h-[44px] h-11'), 'Button size="touch" must be at least 44px')
  assert.ok(buttonContent.includes('min-h-[44px] min-w-[44px]'), 'Button size="icon-touch" must be at least 44x44px')

  // 2. Dialog close button
  const dialogPath = path.resolve('src/components/ui/dialog.tsx')
  const dialogContent = fs.readFileSync(dialogPath, 'utf8')
  assert.ok(dialogContent.includes('min-h-[44px] min-w-[44px]'), 'Dialog close button must have 44x44px touch target')
  assert.ok(dialogContent.includes('aria-label="Close dialog"'), 'Dialog close button must have explicit aria-label')

  // 3. Field Portal actions
  const fieldPath = path.resolve('src/app/client/field/page.tsx')
  const fieldContent = fs.readFileSync(fieldPath, 'utf8')
  assert.ok(fieldContent.includes('Navigate</span>') && fieldContent.includes('min-h-[44px]'), 'Field Navigate button must be min-h-[44px]')
  assert.ok(fieldContent.includes('Call</span>') && fieldContent.includes('min-h-[44px]'), 'Field Call button must be min-h-[44px]')
  assert.ok(fieldContent.includes('handleDateChange(0)') && fieldContent.includes('min-h-[44px]'), 'Field Date Today button must be min-h-[44px]')

  // 4. Inbox Thread Header actions
  const inboxPath = path.resolve('src/app/client/inbox/page.tsx')
  const inboxContent = fs.readFileSync(inboxPath, 'utf8')
  assert.ok(inboxContent.includes('aria-label="Call customer directly"'), 'Inbox Call link must have aria-label')
  assert.ok(inboxContent.includes('aria-label="View customer profile"'), 'Inbox Profile link must have aria-label')
  assert.ok(inboxContent.includes('min-h-[44px] min-w-[44px] sm:min-w-0 sm:min-h-[38px]'), 'Inbox header quick actions must have 44px minimum target on mobile')

  // 5. Dashboard Refresh Action
  const dashboardPath = path.resolve('src/app/client/dashboard/page.tsx')
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8')
  assert.ok(dashboardContent.includes('min-h-[44px] min-w-[44px]'), 'Dashboard Refresh button must have 44px minimum touch target on mobile')

  // 6. Photo Proof Modal actions
  const photoModalPath = path.resolve('src/components/jobs/job-photos-modal.tsx')
  const photoContent = fs.readFileSync(photoModalPath, 'utf8')
  assert.ok(photoContent.includes('Take / Add Photo</span>') && photoContent.includes('min-h-[44px]'), 'Photo upload button must have min-h-[44px]')
  assert.ok(photoContent.includes('Before Photos</span>') && photoContent.includes('min-h-[44px]'), 'Photo Before tab must have min-h-[44px]')
  assert.ok(photoContent.includes('After Photos</span>') && photoContent.includes('min-h-[44px]'), 'Photo After tab must have min-h-[44px]')
})

// Test 4: Verify Form Accessibility and Duplicate-Submission Prevention
test('UX & Form Safety: Composer protects message state and provides accessible labels', () => {
  const inboxPath = path.resolve('src/app/client/inbox/page.tsx')
  const inboxContent = fs.readFileSync(inboxPath, 'utf8')

  // Form field labels
  assert.ok(inboxContent.includes('aria-label="Type an SMS reply"'), 'Composer input must have aria-label')
  assert.ok(inboxContent.includes('aria-label="Send SMS message"'), 'Composer send button must have aria-label')

  // Duplicate submission protection
  assert.ok(inboxContent.includes('disabled={!replyText.trim() || sending}'), 'Send button must disable on empty or active sending')
  assert.ok(inboxContent.includes('if (!replyText.trim() || !activeConv || !activeConv.contact?.phone || sending) return'), 'handleSendReply must guard against duplicate submissions')

  // Text preservation on error
  assert.ok(inboxContent.includes('const textToSend = replyText.trim()'), 'Must capture textToSend before clearing state')
  assert.ok(inboxContent.includes('setReplyText(textToSend)'), 'Must restore textToSend on failure')
})

// Test 5: Verify Leads CSV Export with Synthetic Data
test('Leads Management: CSV export handles synthetic lead records with compliant formatting', async () => {
  const { exportToCsv, CsvFormatters } = await import('../src/lib/export/csv-export.ts')

  const syntheticLeads = [
    {
      id: 'lead-test-1',
      contact: { name: 'Alice Smith', phone: '+15551234567', email: 'alice@example.com' },
      status: 'new',
      urgency: 'high',
      source: 'missed_call',
      service_needed: 'Emergency Pipe Repair',
      notes: 'Water leaking into basement',
      created_at: '2026-10-18T10:00:00.000Z'
    },
    {
      id: 'lead-test-2',
      contact: { name: 'Bob Jones', phone: '+15559876543', email: null },
      status: 'contacted',
      urgency: 'normal',
      source: 'website_widget',
      service_needed: 'HVAC Tune-up',
      notes: null,
      created_at: '2026-10-18T11:30:00.000Z'
    }
  ]

  let capturedBlobContent = ''
  const origWindow = globalThis.window
  const origDocument = globalThis.document
  const origURL = globalThis.URL

  globalThis.window = {}
  globalThis.URL = {
    createObjectURL: (blob) => {
      blob.text().then(t => { capturedBlobContent = t })
      return 'blob:mock-url'
    },
    revokeObjectURL: () => {}
  }
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'a') {
        return {
          style: {},
          setAttribute: (_k, _v) => {},
          click: () => {},
        }
      }
      return {}
    },
    body: { appendChild: () => {}, removeChild: () => {} }
  }

  try {
    exportToCsv('test_leads', [
      { header: 'Contact Name', accessor: l => l.contact?.name || 'Unnamed' },
      { header: 'Phone', accessor: l => l.contact?.phone || '' },
      { header: 'Email', accessor: l => l.contact?.email || '' },
      { header: 'Status', accessor: l => CsvFormatters.status(l.status) },
      { header: 'Urgency', accessor: l => CsvFormatters.status(l.urgency) },
      { header: 'Lead Source', accessor: l => CsvFormatters.status(l.source) },
      { header: 'Service Needed', accessor: l => l.service_needed || '' },
      { header: 'Notes', accessor: l => l.notes || '' },
      { header: 'Created At', accessor: l => CsvFormatters.dateTime(l.created_at) }
    ], syntheticLeads)

    // Wait a tick for blob.text()
    await new Promise(r => setTimeout(r, 10))

    assert.ok(capturedBlobContent.includes('Contact Name,Phone,Email,Status,Urgency,Lead Source,Service Needed,Notes,Created At'), 'CSV must include expected header row')
    assert.ok(capturedBlobContent.includes('Alice Smith,+15551234567,alice@example.com,New,High,Missed Call,Emergency Pipe Repair,Water leaking into basement'), 'Must format Alice Smith correctly')
    assert.ok(capturedBlobContent.includes('Bob Jones,+15559876543,,Contacted,Normal,Website Widget,HVAC Tune-up,'), 'Must format Bob Jones correctly with empty email and notes')
  } finally {
    globalThis.window = origWindow
    globalThis.document = origDocument
    globalThis.URL = origURL
  }
})
