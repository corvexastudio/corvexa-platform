import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:3088'
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/booking'

fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

async function capture() {
  console.log('Launching browser via msedge channel...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  const viewports = [
    { name: 'booking-390px-stage1-mobile', width: 390, height: 844 },
    { name: 'booking-768px-stage1-tablet', width: 768, height: 1024 },
    { name: 'booking-1440px-stage1-desktop', width: 1440, height: 900 }
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

      // Screenshot initial load (with default or first service)
      const outPath = path.join(ARTIFACT_DIR, `${vp.name}-initial.png`)
      await page.screenshot({ path: outPath, fullPage: true })

      // Click on the second service (Signature detail with 3 add-ons)
      const signatureCard = page.locator('text=Full Signature Interior Detail').first()
      if (await signatureCard.count() > 0) {
        await signatureCard.click()
        await page.waitForTimeout(600)

        // Capture with add-ons drawer visible
        const addonsVisiblePath = path.join(ARTIFACT_DIR, `${vp.name}-with-addons.png`)
        await page.screenshot({ path: addonsVisiblePath, fullPage: true })

        // Toggle an add-on (e.g. Ozone odor treatment)
        const addonToggle = page.locator('text=Ozone Odor Elimination Treatment').first()
        if (await addonToggle.count() > 0) {
          await addonToggle.click()
          await page.waitForTimeout(500)
          const addonCheckedPath = path.join(ARTIFACT_DIR, `${vp.name}-addon-checked.png`)
          await page.screenshot({ path: addonCheckedPath, fullPage: true })
        }
      }
    } catch (err) {
      console.error(`Error capturing ${vp.name}:`, err.message)
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log('Finished capturing all booking stage 1 screenshots with add-ons!')
}

capture().catch(err => {
  console.error('Fatal capture error:', err)
  process.exit(1)
})
