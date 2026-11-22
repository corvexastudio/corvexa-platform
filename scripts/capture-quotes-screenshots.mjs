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

async function capture() {
  console.log('Obtaining authenticated test session cookies...')
  const cookies = await getAuthCookies(BASE_URL)

  console.log('Launching browser via msedge channel...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  // 1. Fetch available quotes to find a valid token for public quote view
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  const quotesRes = await fetch(`${BASE_URL}/api/client/quotes`, {
    headers: { cookie: cookieHeader }
  })
  const quotesData = await quotesRes.json()
  const publicToken = quotesData?.quotes?.[0]?.token || quotesData?.quotes?.[0]?.manage_token || '0596f537b960e36785d26b06e43997e4a4546fa0c7c063cd'
  console.log('Using public quote token for customer view:', publicToken)

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
    console.log(`\n--- Capturing Dashboard for viewport: ${vp.name} (${vp.width}x${vp.height}) ---`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    await context.addCookies(cookies)

    const page = await context.newPage()
    await page.goto(`${BASE_URL}/client/quotes`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(600)

    // Capture main dashboard
    const dashFile = `quotes-${vp.name}-dashboard.png`
    await page.screenshot({ path: path.join(LOCAL_DIR, dashFile), fullPage: true })
    mirrorFile(dashFile)

    // If 390px (primary mobile reference), capture detailed interactive states
    if (vp.name === '390px') {
      // 1. Details Modal
      console.log('Capturing Quote Details Modal at 390px...')
      const firstCard = page.locator('div[data-quote-card="true"]').first()
      if (await firstCard.isVisible()) {
        await firstCard.click()
        await page.waitForTimeout(600)
        const detailsFile = `quotes-390px-details-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, detailsFile), fullPage: true })
        mirrorFile(detailsFile)

        // Close details modal via Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
      }

      // 2. Mobile Action Sheet Modal
      console.log('Capturing Mobile Action Sheet at 390px...')
      const actionTrigger = page.locator('button[aria-label="More actions"]').first()
      if (await actionTrigger.isVisible()) {
        await actionTrigger.click()
        await page.waitForTimeout(600)
        const actionSheetFile = `quotes-390px-action-sheet.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, actionSheetFile), fullPage: true })
        mirrorFile(actionSheetFile)

        // Close action sheet via Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
      }

      // 3. Four-Step Create Estimate Flow
      console.log('Capturing 4-Step Create Estimate Modal at 390px...')
      const newQuoteBtn = page.locator('button:has-text("New Estimate")').first()
      if (await newQuoteBtn.isVisible()) {
        await newQuoteBtn.click()
        await page.waitForTimeout(600)

        // Step 1: Customer Selection
        const step1File = `quotes-390px-create-step1.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, step1File), fullPage: true })
        mirrorFile(step1File)

        // Advance to Step 2 via Stepper bar
        const step2Tab = page.locator('button:has-text("2. Items")').first()
        if (await step2Tab.isVisible()) {
          await step2Tab.click()
          await page.waitForTimeout(600)

          // Step 2: Line Items & Trade Presets
          const step2File = `quotes-390px-create-step2.png`
          await page.screenshot({ path: path.join(LOCAL_DIR, step2File), fullPage: true })
          mirrorFile(step2File)

          // Advance to Step 3 via Stepper bar
          const step3Tab = page.locator('button:has-text("3. Pricing")').first()
          if (await step3Tab.isVisible()) {
            await step3Tab.click()
            await page.waitForTimeout(600)

            // Step 3: Financials & Deposits
            const step3File = `quotes-390px-create-step3.png`
            await page.screenshot({ path: path.join(LOCAL_DIR, step3File), fullPage: true })
            mirrorFile(step3File)

            // Advance to Step 4 via Stepper bar
            const step4Tab = page.locator('button:has-text("4. Review")').first()
            if (await step4Tab.isVisible()) {
              await step4Tab.click()
              await page.waitForTimeout(600)

              // Step 4: Settings & Review
              const step4File = `quotes-390px-create-step4.png`
              await page.screenshot({ path: path.join(LOCAL_DIR, step4File), fullPage: true })
              mirrorFile(step4File)
            }
          }
        }

        // Close builder via Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }

    await context.close()
  }

  // 4. Capture Customer Public View (/quote/[token])
  console.log('\n--- Capturing Customer Public Quote View ---')
  if (publicToken) {
    // Mobile 390px
    const pubContextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2
    })
    const pubPageMobile = await pubContextMobile.newPage()
    await pubPageMobile.goto(`${BASE_URL}/quote/${publicToken}`, { waitUntil: 'networkidle', timeout: 30000 })
    await pubPageMobile.waitForTimeout(800)
    const pubMobileFile = `quotes-customer-390px-public.png`
    await pubPageMobile.screenshot({ path: path.join(LOCAL_DIR, pubMobileFile), fullPage: true })
    mirrorFile(pubMobileFile)
    await pubContextMobile.close()

    // Desktop 1440px
    const pubContextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    })
    const pubPageDesktop = await pubContextDesktop.newPage()
    await pubPageDesktop.goto(`${BASE_URL}/quote/${publicToken}`, { waitUntil: 'networkidle', timeout: 30000 })
    await pubPageDesktop.waitForTimeout(800)
    const pubDesktopFile = `quotes-customer-1440px-public.png`
    await pubPageDesktop.screenshot({ path: path.join(LOCAL_DIR, pubDesktopFile), fullPage: true })
    mirrorFile(pubDesktopFile)
    await pubContextDesktop.close()
  }

  await browser.close()
  console.log('\n[SUCCESS] All quotes screenshots captured and mirrored successfully.')
}

capture().catch((err) => {
  console.error('[CAPTURE ERROR]', err)
  process.exit(1)
})
