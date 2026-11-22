import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:3088'
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/booking'

fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

async function capture() {
  console.log('Launching browser via msedge channel for Stage 3 screenshots...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  const viewports = [
    { name: 'booking-390px-stage3-mobile', width: 390, height: 844 },
    { name: 'booking-768px-stage3-tablet', width: 768, height: 1024 },
    { name: 'booking-1440px-stage3-desktop', width: 1440, height: 900 }
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
      await page.waitForTimeout(1500)

      // Step 1 -> Step 2
      const continueToDateBtn = page.locator('button:has-text("Continue to Date")').first()
      if (await continueToDateBtn.count() > 0 && await continueToDateBtn.isEnabled()) {
        await continueToDateBtn.click()
      } else {
        const serviceCard = page.locator('[role="radio"]').first()
        if (await serviceCard.count() > 0) {
          await serviceCard.click()
          await page.waitForTimeout(400)
          const btn = page.locator('button:has-text("Continue")').last()
          await btn.click()
        }
      }
      await page.waitForTimeout(1500)

      // Jump to Monday Nov 23 (since Sunday is closed)
      const nextOpenBtn = page.locator('button:has-text("View Next")').first()
      if (await nextOpenBtn.count() > 0) {
        await nextOpenBtn.click()
        await page.waitForTimeout(1000)
      } else {
        const monPill = page.locator('button:has-text("Mon")').first()
        if (await monPill.count() > 0) {
          await monPill.click()
          await page.waitForTimeout(1000)
        }
      }

      // Wait for open slots to appear and select first slot
      const slotRadio = page.locator('[role="radiogroup"] button[role="radio"]').first()
      await slotRadio.waitFor({ state: 'visible', timeout: 10000 })
      await slotRadio.click()
      await page.waitForTimeout(600)

      // Step 2 -> Step 3
      const continueToDetailsBtn = page.locator('button:has-text("Continue to Details"), button:has-text("Details")').last()
      await continueToDetailsBtn.waitFor({ state: 'visible', timeout: 5000 })
      await continueToDetailsBtn.click()
      await page.waitForTimeout(1500)

      // 1. Initial Step 3 View (Booking Review Summary + Empty Intake Form)
      const initialPath = path.join(ARTIFACT_DIR, `${vp.name}-initial.png`)
      await page.screenshot({ path: initialPath, fullPage: true })
      console.log(`Saved: ${initialPath}`)

      // 2. Trigger validation errors by clicking submit with empty fields
      const submitBtn = page.locator('button[type="submit"]').first()
      if (await submitBtn.count() > 0) {
        await submitBtn.click()
        await page.waitForTimeout(600)
        const errorPath = path.join(ARTIFACT_DIR, `${vp.name}-validation-errors.png`)
        await page.screenshot({ path: errorPath, fullPage: true })
        console.log(`Saved: ${errorPath}`)
      }

      // 3. Fill valid details
      await page.fill('#field-first-name', 'Sarah')
      await page.fill('#field-last-name', 'Connor')
      await page.fill('#field-phone', '5552345678')
      await page.fill('#field-email', 'sarah.connor@example.com')
      if (await page.locator('#field-street-address').count() > 0) {
        await page.fill('#field-street-address', '742 Evergreen Terrace')
        await page.fill('#field-unit', 'Apt 2B')
        await page.fill('#field-city', 'Austin')
        await page.fill('#field-state', 'TX')
        await page.fill('#field-zip', '78701')
      }
      await page.fill('#field-notes', 'Vehicle parked in shaded carport. Please check rear floor mats.')
      await page.fill('#field-access', 'Gate code is #8822. Key fob hanging on carport post.')
      await page.waitForTimeout(600)

      // 3. Filled Stage 3 View
      const filledPath = path.join(ARTIFACT_DIR, `${vp.name}-filled.png`)
      await page.screenshot({ path: filledPath, fullPage: true })
      console.log(`Saved: ${filledPath}`)

    } catch (err) {
      console.error(`Error capturing ${vp.name}:`, err.message)
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log('Finished capturing all Stage 3 screenshots!')
}

capture().catch(err => {
  console.error('Fatal capture error:', err)
  process.exit(1)
})
