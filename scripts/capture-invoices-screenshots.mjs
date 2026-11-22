import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { getAuthCookies } from '../test/e2e/auth-helper.mjs'

const BASE_URL = 'http://localhost:3088'
const LOCAL_DIR = path.resolve('screenshots/invoices')
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/invoices'

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

async function capture() {
  console.log('Obtaining authenticated test session cookies...')
  const cookies = await getAuthCookies(BASE_URL)

  console.log('Launching browser via msedge channel...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  // 1. Fetch available invoices to find valid public tokens
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  const invRes = await fetch(`${BASE_URL}/api/client/invoices`, {
    headers: { cookie: cookieHeader }
  })
  const invData = await invRes.json()
  const invoices = invData?.invoices || []
  console.log(`Loaded ${invoices.length} invoices for testing`)
  const publicToken = invoices[0]?.manage_token || '6829192a883ee2824dfa10111435cf99eadc7cb0a6ad8b98'
  console.log('Using public invoice token for customer view:', publicToken)

  // Viewport matrix
  const viewports = [
    { name: '320px', width: 320, height: 700, isMobile: true },
    { name: '360px', width: 360, height: 780, isMobile: true },
    { name: '375px', width: 375, height: 812, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '430px', width: 430, height: 932, isMobile: true },
    { name: '768px', width: 768, height: 1024, isMobile: false },
    { name: '1024px', width: 1024, height: 768, isMobile: false },
    { name: '1440px', width: 1440, height: 900, isMobile: false }
  ]

  for (const vp of viewports) {
    console.log(`\n--- Capturing Invoices Dashboard for viewport: ${vp.name} (${vp.width}x${vp.height}) ---`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    await context.addCookies(cookies)

    const page = await context.newPage()
    await page.goto(`${BASE_URL}/client/invoices`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(1500)

    // Capture main dashboard
    const dashFile = `invoices-${vp.name}-dashboard.png`
    await page.screenshot({ path: path.join(LOCAL_DIR, dashFile), fullPage: true })
    mirrorFile(dashFile)

    // If 390px (primary mobile reference), capture interactive modal states
    if (vp.name === '390px') {
      // 1. Details Modal
      console.log('Capturing Invoice Details Modal at 390px...')
      const detailsBtn = page.locator('button:has-text("Details")').first()
      if (await detailsBtn.isVisible()) {
        await detailsBtn.click()
        await page.waitForTimeout(800)
        const detailsFile = `invoices-390px-details-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, detailsFile), fullPage: true })
        mirrorFile(detailsFile)

        // Close details modal via Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }

      // 2. Mobile Action Sheet Modal
      console.log('Capturing Mobile Action Sheet at 390px...')
      const actionTrigger = page.locator('button[aria-label="More invoice actions"]').first()
      if (await actionTrigger.isVisible()) {
        await actionTrigger.click()
        await page.waitForTimeout(800)
        const actionSheetFile = `invoices-390px-action-sheet.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, actionSheetFile), fullPage: true })
        mirrorFile(actionSheetFile)

        // Close action sheet via Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }

      // 3. Payment Collection Modal
      console.log('Capturing Payment Collection Modal at 390px...')
      const collectBtn = page.locator('button:has-text("Collect Payment")').first()
      if (await collectBtn.isVisible()) {
        await collectBtn.click()
        await page.waitForTimeout(800)
        const paymentModalFile = `invoices-390px-payment-collection.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, paymentModalFile), fullPage: true })
        mirrorFile(paymentModalFile)

        // Close payment modal via Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }

      // 4. Create Invoice Modal
      console.log('Capturing Create Invoice Modal at 390px...')
      const newInvoiceBtn = page.locator('button:has-text("New Invoice")').first()
      if (await newInvoiceBtn.isVisible()) {
        await newInvoiceBtn.click()
        await page.waitForTimeout(800)
        const createModalFile = `invoices-390px-create-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, createModalFile), fullPage: true })
        mirrorFile(createModalFile)

        // Close create modal via Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }
    }

    await context.close()
  }

  // 2. Capture Public Customer-Facing Invoice (/invoice/[token])
  console.log('\n--- Capturing Customer Public Invoice at 390px (Mobile) ---')
  const mobileCustContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  })
  const mobileCustPage = await mobileCustContext.newPage()
  await mobileCustPage.goto(`${BASE_URL}/invoice/${publicToken}`, { waitUntil: 'load', timeout: 30000 })
  await mobileCustPage.waitForTimeout(1500)
  const custMobileFile = 'invoices-customer-390px-public.png'
  await mobileCustPage.screenshot({ path: path.join(LOCAL_DIR, custMobileFile), fullPage: true })
  mirrorFile(custMobileFile)
  await mobileCustContext.close()

  console.log('\n--- Capturing Customer Public Invoice at 1440px (Desktop) ---')
  const deskCustContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  })
  const deskCustPage = await deskCustContext.newPage()
  await deskCustPage.goto(`${BASE_URL}/invoice/${publicToken}`, { waitUntil: 'load', timeout: 30000 })
  await deskCustPage.waitForTimeout(1500)
  const custDeskFile = 'invoices-customer-1440px-public.png'
  await deskCustPage.screenshot({ path: path.join(LOCAL_DIR, custDeskFile), fullPage: true })
  mirrorFile(custDeskFile)
  await deskCustContext.close()

  await browser.close()
  console.log('\nAll 14 invoice screenshots captured and mirrored successfully!')
}

capture().catch((err) => {
  console.error('Fatal capture error:', err)
  process.exit(1)
})
