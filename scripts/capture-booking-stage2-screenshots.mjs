import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:3088'
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/booking'

fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

async function capture() {
  console.log('Launching browser via msedge channel for Stage 2 comprehensive screenshots...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  const viewports = [
    { name: 'booking-390px-stage2-mobile', width: 390, height: 844 },
    { name: 'booking-768px-stage2-tablet', width: 768, height: 1024 },
    { name: 'booking-1440px-stage2-desktop', width: 1440, height: 900 }
  ]

  for (const vp of viewports) {
    console.log(`Capturing ${vp.name} (${vp.width}x${vp.height})...`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    const page = await context.newPage()

    try {
      await page.goto(`${BASE_URL}/book/auto-detailing`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      // Step 1: Ensure a service is selected and continue to Step 2
      const continueBtn = page.locator('button:has-text("Continue to Date")').first()
      if (await continueBtn.count() > 0 && await continueBtn.isEnabled()) {
        await continueBtn.click()
      } else {
        const serviceCard = page.locator('[role="radio"]').first()
        if (await serviceCard.count() > 0) {
          await serviceCard.click()
          await page.waitForTimeout(500)
          const btn = page.locator('button:has-text("Continue")').last()
          await btn.click()
        }
      }

      await page.waitForTimeout(2000)

      // 1. Initial Step 2 View (Sunday: Closed state with 1-tap "View Next Open Date" recovery CTA)
      const closedPath = path.join(ARTIFACT_DIR, `${vp.name}-closed-state.png`)
      await page.screenshot({ path: closedPath, fullPage: true })
      console.log(`Saved: ${closedPath}`)

      // 2. Click "View Next Open Date" button (or Monday pill on rail) to jump to open working day
      const nextOpenBtn = page.locator('button:has-text("View Next")').first()
      if (await nextOpenBtn.count() > 0) {
        await nextOpenBtn.click()
      } else {
        // Fallback: click Monday date pill on rail
        const mondayPill = page.locator('button:has-text("Mon")').first()
        if (await mondayPill.count() > 0) {
          await mondayPill.click()
        }
      }

      await page.waitForTimeout(2000) // Wait for slots to calculate and display

      // 2. Open Slots View (Grouped Morning / Afternoon / Evening slots)
      const openSlotsPath = path.join(ARTIFACT_DIR, `${vp.name}-open-slots.png`)
      await page.screenshot({ path: openSlotsPath, fullPage: true })
      console.log(`Saved: ${openSlotsPath}`)

      // 3. Select an available morning slot (e.g. 9:00 AM)
      const slotRadio = page.locator('[role="radiogroup"] button[role="radio"]').first()
      if (await slotRadio.count() > 0) {
        await slotRadio.click()
        await page.waitForTimeout(600)

        // Capture slot selected state with active bottom bar
        const selectedSlotPath = path.join(ARTIFACT_DIR, `${vp.name}-slot-selected.png`)
        await page.screenshot({ path: selectedSlotPath, fullPage: true })
        console.log(`Saved: ${selectedSlotPath}`)
      }

      // 4. Open full month calendar modal
      const calendarModalBtn = page.locator('button:has-text("View Full Calendar")').first()
      if (await calendarModalBtn.count() > 0) {
        await calendarModalBtn.click()
        await page.waitForTimeout(800)

        // Capture full calendar modal
        const calendarModalPath = path.join(ARTIFACT_DIR, `${vp.name}-calendar-modal.png`)
        await page.screenshot({ path: calendarModalPath, fullPage: true })
        console.log(`Saved: ${calendarModalPath}`)
      }

    } catch (err) {
      console.error(`Error capturing ${vp.name}:`, err.message)
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log('Finished capturing all Stage 2 screenshots!')
}

capture().catch(err => {
  console.error('Fatal capture error:', err)
  process.exit(1)
})
