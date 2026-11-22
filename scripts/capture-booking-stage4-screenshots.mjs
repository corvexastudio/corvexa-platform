import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:3088'
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/booking'

fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

async function capture() {
  console.log('Launching browser via msedge channel for Tablet and Desktop Stage 4 screenshots...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  const viewports = [
    { name: 'booking-768px-stage4-tablet', width: 768, height: 1024, targetDay: 'Wed' },
    { name: 'booking-1440px-stage4-desktop', width: 1440, height: 900, targetDay: 'Thu' }
  ]

  for (const vp of viewports) {
    console.log(`Capturing ${vp.name} (${vp.width}x${vp.height}) on day ${vp.targetDay}...`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    const page = await context.newPage()

    try {
      await page.goto(`${BASE_URL}/book/auto-detailing`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(1000)

      // Step 1: Select Service if not selected, advance to Step 2
      const continueToDateBtn = page.locator('button:has-text("Continue to Date")').first()
      if (!await continueToDateBtn.isEnabled()) {
        await page.locator('[role="radio"]').first().click()
        await page.waitForTimeout(500)
      }
      await continueToDateBtn.click()
      await page.waitForTimeout(1500)

      // Step 2: Jump to targeted open date
      const targetDayPill = page.locator(`button:has-text("${vp.targetDay}")`).first()
      if (await targetDayPill.count() > 0) {
        await targetDayPill.click()
        await page.waitForTimeout(1500)
      }

      // If needed, click View Next Available Date
      const nextAvailBtn = page.locator('button:has-text("View Next Available Date")').first()
      if (await nextAvailBtn.count() > 0 && await nextAvailBtn.isVisible()) {
        await nextAvailBtn.click()
        await page.waitForTimeout(1500)
      }

      const slotRadio = page.locator('[role="radiogroup"] button[role="radio"]').first()
      await slotRadio.waitFor({ state: 'visible', timeout: 10000 })
      await slotRadio.click()
      await page.waitForTimeout(600)

      // Step 2 -> Step 3
      const continueToDetailsBtn = page.locator('button:has-text("Continue to Details")').first()
      await continueToDetailsBtn.waitFor({ state: 'visible', timeout: 5000 })
      await continueToDetailsBtn.click()
      await page.waitForTimeout(1200)

      // Step 3: Fill customer details
      await page.fill('#field-first-name', 'Michael')
      await page.fill('#field-last-name', 'Phelps')
      await page.fill('#field-phone', '5125550912')
      await page.fill('#field-email', 'michael.phelps@example.com')
      if (await page.locator('#field-street-address').count() > 0) {
        await page.fill('#field-street-address', '100 Olympic Way')
        await page.fill('#field-unit', 'Ste 400')
        await page.fill('#field-city', 'Austin')
        await page.fill('#field-state', 'TX')
        await page.fill('#field-zip', '78701')
      }
      await page.fill('#field-notes', 'Vehicle parked in open bay. Key is in lockbox.')
      await page.fill('#field-access', 'Gate code is #4040. Dogs secured in garage.')
      await page.waitForTimeout(500)

      // Submit booking -> Step 4
      const submitBtn = page.locator('button[type="submit"]').first()
      await submitBtn.click()

      // Wait for manage link on confirmation screen
      const manageLinkEl = page.locator('a:has-text("Manage or Reschedule Appointment")').first()
      await manageLinkEl.waitFor({ state: 'visible', timeout: 35000 })
      await page.waitForTimeout(1500)

      // 1. Capture Confirmation Screen (Step 4)
      const confPath = path.join(ARTIFACT_DIR, `${vp.name}-confirmation.png`)
      await page.screenshot({ path: confPath, fullPage: true })
      console.log(`Saved: ${confPath}`)

      // Resolve Manage link
      const manageHref = await manageLinkEl.getAttribute('href')
      console.log(`Resolved Manage Link: ${manageHref}`)

      // 2. Navigate to Manage Page
      await page.goto(manageHref, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      const managePath = path.join(ARTIFACT_DIR, `${vp.name}-manage-portal.png`)
      await page.screenshot({ path: managePath, fullPage: true })
      console.log(`Saved: ${managePath}`)

      // 3. Open Reschedule Flow
      const reschedBtn = page.locator('button:has-text("Reschedule Appointment")').first()
      if (await reschedBtn.count() > 0) {
        await reschedBtn.scrollIntoViewIfNeeded()
        await reschedBtn.click()
        await page.waitForTimeout(1500)

        const reschedPath = path.join(ARTIFACT_DIR, `${vp.name}-manage-reschedule.png`)
        await page.screenshot({ path: reschedPath, fullPage: true })
        console.log(`Saved: ${reschedPath}`)

        // Close reschedule
        const cancelReschedBtn = page.locator('button:has-text("Keep Current Time"), button:has-text("Cancel")').first()
        if (await cancelReschedBtn.count() > 0) {
          await cancelReschedBtn.click()
          await page.waitForTimeout(600)
        }
      }

      // 4. Open Cancellation Flow
      const cancelBtn = page.locator('button:has-text("Cancel Appointment")').first()
      if (await cancelBtn.count() > 0) {
        await cancelBtn.scrollIntoViewIfNeeded()
        await cancelBtn.click()
        await page.waitForTimeout(1000)

        const cancelPath = path.join(ARTIFACT_DIR, `${vp.name}-manage-cancellation.png`)
        await page.screenshot({ path: cancelPath, fullPage: true })
        console.log(`Saved: ${cancelPath}`)
      }

    } catch (err) {
      console.error(`Error capturing ${vp.name}:`, err.message)
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log('Finished capturing Tablet and Desktop Stage 4 screenshots!')
}

capture().catch(err => {
  console.error('Fatal capture error:', err)
  process.exit(1)
})
