import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const resolveFile = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url))

test('Phase 4 - StarterPassMeter: Mobile-first 44px+ touch ergonomics and milestone nodes', () => {
  const filePath = resolveFile('src/components/billing/starter-pass-meter.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Mobile ergonomics: minimum 44px touch target
  assert.ok(content.includes('min-h-[44px]'), 'Must enforce minimum 44px height for mobile thumbs')
  assert.ok(content.includes('cursor-pointer active:scale-[0.99]'), 'Must have touch active state')

  // Discrete 3-step milestone indicators
  assert.ok(content.includes('[1, 2, 3].map'), 'Must render discrete 3 milestone nodes')
  assert.ok(content.includes('bg-emerald-500 text-white'), 'Completed jobs must show emerald checkmark')
  assert.ok(content.includes('animate-pulse'), 'Active job must have glowing pulse indicator')

  // Dopamine & zero-fee callouts
  assert.ok(content.includes('Free 3-Job Starter Pass'), 'Labels free starter pass')
  assert.ok(content.includes('($0 Fees)'), 'Highlights $0 platform fees')
  assert.ok(content.includes('Starter Pass Limit Reached'), 'Signals milestone completion')

  // Hidden for paying subscribers
  assert.ok(content.includes('if (isPayingActive) return null'), 'Hides completely for active paying subscribers')

  // Modal integration
  assert.ok(content.includes('<MilestoneUpgradeModal'), 'Integrates MilestoneUpgradeModal')
})

test('Phase 4 - JobWonBadge: Dopamine release badge for won bookings', () => {
  const filePath = resolveFile('src/components/jobs/job-won-badge.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Dopamine copy and icons
  assert.ok(content.includes('CONTRACT WON'), 'Default uppercase label')
  assert.ok(content.includes('label'), 'Supports custom label prop')
  assert.ok(content.includes('Trophy') && content.includes('Sparkles'), 'Uses celebratory icons')
  assert.ok(content.includes('Job {milestoneIndex} of 3 Free'), 'Shows milestone tag for starter pass')
  assert.ok(content.includes('Est. Value'), 'Labels estimated revenue')

  // Compact & responsive styles
  assert.ok(content.includes('compact = false'), 'Supports both compact and full card modes')
  assert.ok(content.includes('rounded-full text-[11px]'), 'Compact badge is rounded pill')
  assert.ok(content.includes('rounded-2xl'), 'Full card has modern 2xl radius')
})

test('Phase 4 - MilestoneUpgradeModal: Mobile-first 3-job celebration & dual-tier upgrade', () => {
  const filePath = resolveFile('src/components/billing/milestone-upgrade-modal.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Celebration headline & revenue callout
  assert.ok(content.includes('You Earned ${formattedRevenue} with $0 Platform Fees!'), 'Celebrates revenue earned with $0 fees')
  assert.ok(content.includes('Starter Pass Completed (3/3 Free Jobs)'), 'Shows 3/3 milestone badge')

  // Dual-tier options with clear pricing
  assert.ok(content.includes('Solo Pro'), 'Offers Solo Pro plan')
  assert.ok(content.includes('$99'), 'Shows $99/mo for Solo Pro')
  assert.ok(content.includes('Multi-Crew'), 'Offers Multi-Crew plan')
  assert.ok(content.includes('$199'), 'Shows $199/mo for Multi-Crew')

  // Touch ergonomics: 48px min CTA button
  assert.ok(content.includes('min-h-[48px]'), 'Must provide 48px touch target for primary checkout CTA')
  assert.ok(content.includes('/api/client/billing'), 'Triggers direct billing API checkout')
})

test('Phase 4 - FoundMoneyUnlockModal: Sunk-cost finish line paywall with zero data loss', () => {
  const filePath = resolveFile('src/components/billing/found-money-unlock-modal.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Revenue headline
  assert.ok(content.includes('Collect Your ${formattedAmount} Payment'), 'Highlights earned customer payment')
  assert.ok(content.includes('Job #4 Ready to Collect'), 'Labels Job #4 finish line')

  // Sunk-cost reassurance (zero data loss)
  assert.ok(content.includes('Draft is 100% saved'), 'Explicitly reassures contractor draft is saved')
  assert.ok(content.includes('Direct Payout'), 'Explains direct card payout')
  assert.ok(content.includes('Automated Google Review'), 'Explains review trigger')

  // Secondary dismiss button preserving draft
  assert.ok(content.includes('Keep Draft Saved'), 'Permits returning to job without deleting draft')
  assert.ok(content.includes('min-h-[48px]'), 'Enforces 48px mobile touch CTA')
})

test('Phase 4 - Layout & Dashboard Integration: StarterPassMeter and FoundMoneyUnlockModal mounted', () => {
  // 1. Client layout has StarterPassMeter
  const layoutContent = fs.readFileSync(resolveFile('src/app/client/layout.tsx'), 'utf8')
  assert.ok(layoutContent.includes('<StarterPassMeter'), 'Layout mounts StarterPassMeter')

  // 2. Dashboard has JobWonBadge and FoundMoneyUnlockModal
  const dashboardContent = fs.readFileSync(resolveFile('src/app/client/dashboard/page.tsx'), 'utf8')
  assert.ok(dashboardContent.includes('<JobWonBadge'), 'Dashboard mounts JobWonBadge')
  assert.ok(dashboardContent.includes('<FoundMoneyUnlockModal'), 'Dashboard mounts FoundMoneyUnlockModal')

  // 3. Invoices page has FoundMoneyUnlockModal
  const invoicesContent = fs.readFileSync(resolveFile('src/app/client/invoices/page.tsx'), 'utf8')
  assert.ok(invoicesContent.includes('<FoundMoneyUnlockModal'), 'Invoices page mounts FoundMoneyUnlockModal')
})
