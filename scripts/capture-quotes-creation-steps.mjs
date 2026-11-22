import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { getAuthCookies } from '../test/e2e/auth-helper.mjs'

const BASE_URL = 'http://localhost:3088'
const LOCAL_DIR = path.resolve('screenshots/quotes')
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/quotes'

fs.mkdirSync(LOCAL_DIR, { recursive: true })
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

function mirrorFile(filename) {
  const src = path.join(LOCAL_DIR, filename)
  const dest = path.join(ARTIFACT_DIR, filename)
  try {
    fs.copyFileSync(src, dest)
    console.log(`[MIRROR] Copied ${filename} to artifact directory`)
  } catch (err) {
    console.warn(`[MIRROR WARNING] Could not mirror ${filename}:`, err.message)
  }
}

async function captureSteps() {
  console.log('Obtaining authenticated test session cookies...')
  const cookies = await getAuthCookies(BASE_URL)

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  })
  await context.addCookies(cookies)

  const page = await context.newPage()
  await page.goto(`${BASE_URL}/client/quotes?create=true`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(600)

  // Step 1: Customer Selection
  console.log('Capturing Step 1: Customer Selection...')
  const step1File = 'quotes-390px-create-step1.png'
  await page.screenshot({ path: path.join(LOCAL_DIR, step1File), fullPage: true })
  mirrorFile(step1File)

  // Navigate to Step 2: Items
  console.log('Navigating to Step 2: Line Items...')
  const step2Tab = page.locator('button:has-text("2. Items")').first()
  await step2Tab.click()
  await page.waitForTimeout(600)
  const step2File = 'quotes-390px-create-step2.png'
  await page.screenshot({ path: path.join(LOCAL_DIR, step2File), fullPage: true })
  mirrorFile(step2File)

  // Navigate to Step 3: Pricing & Deposit
  console.log('Navigating to Step 3: Pricing & Deposit...')
  const step3Tab = page.locator('button:has-text("3. Pricing")').first()
  await step3Tab.click()
  await page.waitForTimeout(600)
  const step3File = 'quotes-390px-create-step3.png'
  await page.screenshot({ path: path.join(LOCAL_DIR, step3File), fullPage: true })
  mirrorFile(step3File)

  // Navigate to Step 4: Review & Send
  console.log('Navigating to Step 4: Review & Send...')
  const step4Tab = page.locator('button:has-text("4. Review")').first()
  await step4Tab.click()
  await page.waitForTimeout(600)
  const step4File = 'quotes-390px-create-step4.png'
  await page.screenshot({ path: path.join(LOCAL_DIR, step4File), fullPage: true })
  mirrorFile(step4File)

  await browser.close()
  console.log('[SUCCESS] All 4 creation steps captured and mirrored successfully.')
}

captureSteps().catch((err) => {
  console.error('[CAPTURE STEPS ERROR]', err)
  process.exit(1)
})
