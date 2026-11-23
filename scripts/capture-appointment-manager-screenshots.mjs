import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUTPUT_DIR = 'C:\\Users\\mskar\\.gemini\\antigravity\\brain\\49f801e5-66c3-4a61-8198-85284e862916\\screenshots\\appointment-manager'
const TOKEN = '7ffc5a7545df8ffb2038cc5eab2cfdf7c318f1ea2aad48d4'
const BASE_URL = `http://localhost:3088/book/manage/${TOKEN}`

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function run() {
  console.log('Launching browser with Chrome at:', CHROME_PATH)
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  })

  const viewports = [
    { name: 'desktop-1440px', width: 1440, height: 900 },
    { name: 'desktop-1024px', width: 1024, height: 768 },
    { name: 'tablet-768px', width: 768, height: 1024 },
    { name: 'mobile-390px', width: 390, height: 844 },
    { name: 'mobile-320px', width: 320, height: 650 }
  ]

  for (const vp of viewports) {
    console.log(`Capturing ${vp.name}...`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    const page = await context.newPage()
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    // Wait for appointment content to load
    await page.waitForSelector('text=Plumbing Diagnostic & Leak Inspection', { timeout: 10000 })

    const filePath = path.join(OUTPUT_DIR, `manage-confirmed-${vp.name}.png`)
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`Saved: ${filePath}`)

    // On 1440px desktop, test reschedule and cancel flows
    if (vp.name === 'desktop-1440px') {
      // 1. Click Reschedule Appointment
      console.log('Testing Reschedule click...')
      const rescheduleBtn = page.locator('button:has-text("Reschedule Appointment")').first()
      if (await rescheduleBtn.isVisible()) {
        await rescheduleBtn.click()
        await page.waitForTimeout(500)
        const reschedulePath = path.join(OUTPUT_DIR, 'manage-reschedule-open-1440px.png')
        await page.screenshot({ path: reschedulePath, fullPage: true })
        console.log(`Saved: ${reschedulePath}`)

        // Close reschedule
        const cancelRescheduleBtn = page.locator('button:has-text("Keep Current Slot")').first()
        if (await cancelRescheduleBtn.isVisible()) {
          await cancelRescheduleBtn.click()
          await page.waitForTimeout(300)
        }
      }

      // 2. Click Cancel Appointment
      console.log('Testing Cancel click...')
      const cancelBtn = page.locator('button:has-text("Cancel Appointment")').first()
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
        await page.waitForTimeout(500)
        const cancelPath = path.join(OUTPUT_DIR, 'manage-cancel-open-1440px.png')
        await page.screenshot({ path: cancelPath, fullPage: true })
        console.log(`Saved: ${cancelPath}`)
      }
    }

    await context.close()
  }

  await browser.close()
  console.log('Screenshot capture completed successfully!')
}

run().catch((err) => {
  console.error('Screenshot error:', err)
  process.exit(1)
})
