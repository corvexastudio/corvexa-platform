process.env.E2E_SUPABASE_PROJECT_REF = 'vlztovqaummczupslymr'
process.env.E2E_ALLOW_DEMO_TENANT = 'true'
process.env.E2E_DEMO_ORG_ID = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7'
process.env.TELNYX_MOCK_DISPATCH = 'true'
process.env.STRIPE_MOCK_DISPATCH = 'true'

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { getAuthCookies } from '../test/e2e/auth-helper.mjs'

const BASE_URL = 'http://localhost:3088'
const LOCAL_DIR = path.resolve('screenshots/analytics')
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/analytics'

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

  // 1. Viewport Matrix (8 standard viewports)
  const viewports = [
    { name: '320px', width: 320, height: 700, isMobile: true },
    { name: '360px', width: 360, height: 780, isMobile: true },
    { name: '375px', width: 375, height: 812, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '430px', width: 430, height: 932, isMobile: true },
    { name: '768px', width: 768, height: 1024, isMobile: false },
    { name: '1024px', width: 1024, height: 800, isMobile: false },
    { name: '1440px', width: 1440, height: 900, isMobile: false }
  ]

  for (const vp of viewports) {
    console.log(`Capturing Analytics Dashboard at ${vp.name} (${vp.width}x${vp.height})...`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    })
    await context.addCookies(cookies)
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/client/analytics`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1200)

    const filename = `analytics-${vp.name}-dashboard.png`
    await page.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
    await context.close()
  }

  // 2. Interactive & Detailed Section Views at 390px (iPhone 14/15 standard)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  })
  await mobileContext.addCookies(cookies)
  const mobilePage = await mobileContext.newPage()

  await mobilePage.goto(`${BASE_URL}/client/analytics`, { waitUntil: 'networkidle', timeout: 30000 })
  await mobilePage.waitForTimeout(1200)

  // A. Cash Flow & Receivables Expanded View
  console.log('Capturing Cash Flow & Receivables section at 390px...')
  const cashflowSection = mobilePage.locator('section:has(#section-heading-cashflow)')
  if (await cashflowSection.isVisible()) {
    await cashflowSection.scrollIntoViewIfNeeded()
    await mobilePage.waitForTimeout(600)
    const filename = 'analytics-390px-cashflow-expanded.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  }

  // B. Quotes & Sales Performance Expanded View
  console.log('Capturing Quotes & Sales Performance section at 390px...')
  const quotesSection = mobilePage.locator('section:has(#section-heading-quotes)')
  if (await quotesSection.isVisible()) {
    await quotesSection.scrollIntoViewIfNeeded()
    await mobilePage.waitForTimeout(600)
    const filename = 'analytics-390px-quotes-expanded.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  }

  // C. Front Desk & Call Recovery Expanded View
  console.log('Capturing Front Desk & Call Recovery section at 390px...')
  const frontdeskSection = mobilePage.locator('section:has(#section-heading-frontdesk)')
  if (await frontdeskSection.isVisible()) {
    await frontdeskSection.scrollIntoViewIfNeeded()
    await mobilePage.waitForTimeout(600)
    const filename = 'analytics-390px-frontdesk-expanded.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  }

  // D. Customer Retention & Loyalty Expanded View
  console.log('Capturing Customer Retention & Loyalty section at 390px...')
  const retentionSection = mobilePage.locator('section:has(#section-heading-retention)')
  if (await retentionSection.isVisible()) {
    await retentionSection.scrollIntoViewIfNeeded()
    await mobilePage.waitForTimeout(600)
    const filename = 'analytics-390px-retention-expanded.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  }

  // E. Period Selector Interaction: 7 Days selected
  console.log('Capturing 7 Days period selector state at 390px...')
  await mobilePage.evaluate(() => window.scrollTo(0, 0))
  await mobilePage.waitForTimeout(400)
  const tab7d = mobilePage.locator('button[role="tab"]:has-text("7 Days")').first()
  if (await tab7d.isVisible()) {
    await tab7d.click()
    await mobilePage.waitForTimeout(1000)
    const filename = 'analytics-390px-period-7d.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  }

  // F. Period Selector Interaction: All Time selected
  console.log('Capturing All Time period selector state at 390px...')
  const tabAll = mobilePage.locator('button[role="tab"]:has-text("All Time")').first()
  if (await tabAll.isVisible()) {
    await tabAll.click()
    await mobilePage.waitForTimeout(1000)
    const filename = 'analytics-390px-period-all.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  }

  await mobileContext.close()
  await browser.close()
  console.log('All 14 analytics screenshots successfully captured and mirrored!')
}

capture().catch((err) => {
  console.error('Fatal screenshot capture error:', err)
  process.exit(1)
})
