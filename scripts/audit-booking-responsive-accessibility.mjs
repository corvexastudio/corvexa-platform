import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:3088'
const VIEWPORTS = [
  { name: '320px-small-mobile', width: 320, height: 640 },
  { name: '375px-standard-mobile', width: 375, height: 667 },
  { name: '390px-modern-mobile', width: 390, height: 844 },
  { name: '430px-large-mobile', width: 430, height: 932 },
  { name: '768px-tablet-portrait', width: 768, height: 1024 },
  { name: '1024px-tablet-landscape', width: 1024, height: 768 },
  { name: '1440px-desktop', width: 1440, height: 900 }
]

async function runAudit() {
  console.log('Launching browser for Responsive & Accessibility Audit across 7 viewports...')
  const browser = await chromium.launch({ channel: 'msedge', headless: true })

  const auditResults = []

  for (const vp of VIEWPORTS) {
    console.log(`Auditing viewport: ${vp.name} (${vp.width}x${vp.height})...`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    const page = await context.newPage()

    try {
      await page.goto(`${BASE_URL}/book/auto-detailing`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(1000)

      // 1. Check Horizontal Overflow on Step 1
      const overflowStep1 = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })

      // 2. Check interactive element touch target dimensions
      const smallTouchTargets = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a[href], input, select, textarea'))
        const small = []
        for (const el of buttons) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0 && (rect.top + rect.height > 0) && (rect.left + rect.width > 0)) {
            if (rect.height < 36 && !el.closest('footer') && !el.closest('.text-\\[10px\\]') && !el.closest('span')) {
              small.push({
                tag: el.tagName,
                text: el.innerText?.slice(0, 30) || el.getAttribute('aria-label') || '',
                height: Math.round(rect.height),
                width: Math.round(rect.width)
              })
            }
          }
        }
        return small
      })

      // 3. Step 1 -> Step 2
      const continueToDateBtn = page.locator('button:has-text("Continue to Date")').first()
      if (!await continueToDateBtn.isEnabled()) {
        await page.locator('[role="radio"]').first().click()
        await page.waitForTimeout(400)
      }
      await continueToDateBtn.click()

      // Wait for date rail to mount
      const datePill = page.locator('button:has-text("Nov")').first()
      await datePill.waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForTimeout(1000)

      // Check Horizontal Overflow on Step 2 (Calendar / date picker)
      const overflowStep2 = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })

      // 4. Select open date
      const openDateBtn = page.locator('button:has-text("View Next Available Date"), button:has-text("Wed"), button:has-text("Thu")').first()
      if (await openDateBtn.count() > 0) {
        await openDateBtn.click()
        await page.waitForTimeout(1500)
      }

      // 5. Select Slot
      const slotRadio = page.locator('[role="radiogroup"] button[role="radio"]').first()
      await slotRadio.waitFor({ state: 'visible', timeout: 15000 })
      await slotRadio.click()
      await page.waitForTimeout(500)

      // 6. Step 2 -> Step 3
      const continueToDetailsBtn = page.locator('button:has-text("Continue to Details")').first()
      await continueToDetailsBtn.click()

      // Wait for customer intake form to mount
      await page.locator('#field-first-name').waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForTimeout(1000)

      // Check Horizontal Overflow on Step 3 (Customer Intake Form)
      const overflowStep3 = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })

      // Check Form Accessibility: Labels & ARIA
      const accessibilityAudit = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        const unlabeled = []
        for (const input of inputs) {
          const id = input.id
          const hasLabel = id && document.querySelector(`label[for="${id}"]`)
          const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')
          const hasPlaceholder = input.getAttribute('placeholder')
          if (!hasLabel && !hasAriaLabel) {
            unlabeled.push({ id, name: input.getAttribute('name'), placeholder: hasPlaceholder })
          }
        }
        return {
          totalInputs: inputs.length,
          unlabeledInputs: unlabeled
        }
      })

      auditResults.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        overflowStep1,
        overflowStep2,
        overflowStep3,
        hasHorizontalOverflow: overflowStep1 || overflowStep2 || overflowStep3,
        touchTargetWarnings: smallTouchTargets.length,
        unlabeledInputs: accessibilityAudit.unlabeledInputs.length,
        status: (!overflowStep1 && !overflowStep2 && !overflowStep3 && accessibilityAudit.unlabeledInputs.length === 0) ? 'PASS' : 'WARN'
      })

      console.log(`Results for ${vp.name}: Overflow=${overflowStep1 || overflowStep2 || overflowStep3}, Unlabeled=${accessibilityAudit.unlabeledInputs.length}, TouchWarnings=${smallTouchTargets.length}`)
    } catch (err) {
      console.error(`Audit error on ${vp.name}:`, err.message)
      auditResults.push({
        viewport: vp.name,
        error: err.message,
        status: 'FAIL'
      })
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log('\n--- COMPLETE VIEWPORT AUDIT REPORT ---')
  console.table(auditResults)
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err)
  process.exit(1)
})
