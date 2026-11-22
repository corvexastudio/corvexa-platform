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
const LOCAL_DIR = path.resolve('screenshots/reviews')
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/reviews'

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
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

  const revRes = await fetch(`${BASE_URL}/api/client/reviews`, {
    headers: { cookie: cookieHeader }
  })
  const revData = await revRes.json().catch(() => ({}))
  const requests = revData?.requests || []
  console.log(`Current review requests count: ${requests.length}`)
  const testToken = requests[0]?.token || 'apex-review-token-live-101'
  console.log(`Using review request token: ${testToken}`)

  console.log('Launching browser via msedge channel...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  // Viewport matrix
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

  // 1. Capture Dashboard across all 8 viewports
  for (const vp of viewports) {
    console.log(`Capturing Reviews Dashboard at ${vp.name} (${vp.width}x${vp.height})...`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    })
    await context.addCookies(cookies)
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/client/reviews`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1000)

    const filename = `reviews-${vp.name}-dashboard.png`
    await page.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
    await context.close()
  }

  // 2. Interactive Modals at 390px (iPhone 14/15 standard)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  })
  await mobileContext.addCookies(cookies)
  const mobilePage = await mobileContext.newPage()

  await mobilePage.goto(`${BASE_URL}/client/reviews`, { waitUntil: 'networkidle', timeout: 30000 })
  await mobilePage.waitForTimeout(1200)

  // A. Send Review Invitation Modal
  console.log('Capturing Send Review Invitation Modal at 390px...')
  const sendBtn = mobilePage.locator('button:has-text("Send Review Invite"), button:has-text("Send Invite")').first()
  if (await sendBtn.isVisible()) {
    await sendBtn.click()
    await mobilePage.waitForTimeout(800)
    const filename = 'reviews-390px-send-modal.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)

    // Close modal
    const cancelBtn = mobilePage.locator('button:has-text("Cancel")').first()
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
      await mobilePage.waitForTimeout(500)
    }
  }

  // B. Review Request Detail Modal
  console.log('Capturing Review Request Detail Modal at 390px...')
  const detailsBtn = mobilePage.locator('button:has-text("Details"):visible').first()
  if (await detailsBtn.isVisible()) {
    await detailsBtn.click()
    await mobilePage.waitForTimeout(800)
    const filename = 'reviews-390px-details-modal.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)

    // Close modal
    const closeBtn = mobilePage.locator('button:has-text("Close")').first()
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
      await mobilePage.waitForTimeout(500)
    }
  } else {
    console.warn('Details button was not visible at 390px')
  }

  // C. Technician QR Code Modal
  console.log('Capturing QR Code Modal at 390px...')
  const qrBtn = mobilePage.locator('button:has-text("QR Code & Link"), button:has-text("Door QR Code")').first()
  if (await qrBtn.isVisible()) {
    await qrBtn.click()
    await mobilePage.waitForTimeout(800)
    const filename = 'reviews-390px-qr-modal.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)

    // Close modal by pressing Escape
    await mobilePage.keyboard.press('Escape')
    await mobilePage.waitForTimeout(500)
  }

  // D. Settings & Cooldown Modal
  console.log('Capturing Automation Rules & Cooldown Modal at 390px...')
  const settingsBtn = mobilePage.locator('button:has-text("Rules & Cooldown")').first()
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click()
    await mobilePage.waitForTimeout(800)
    const filename = 'reviews-390px-settings-modal.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)

    // Close modal
    await mobilePage.keyboard.press('Escape')
    await mobilePage.waitForTimeout(500)
  }

  // E. Customer Feedback Tab
  console.log('Capturing Direct Customer Feedback Tab at 390px...')
  const feedbackTabBtn = mobilePage.locator('button:has-text("Direct Customer Feedback")').first()
  if (await feedbackTabBtn.isVisible()) {
    await feedbackTabBtn.click()
    await mobilePage.waitForTimeout(800)
    const filename = 'reviews-390px-feedback-tab.png'
    await mobilePage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  }

  await mobileContext.close()

  // 3. Public Route /r/[token] Redirect Behavior
  console.log(`Testing /r/[token] redirect behavior on token: ${testToken}...`)
  const publicContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  })
  const publicPage = await publicContext.newPage()
  try {
    const response = await publicPage.goto(`${BASE_URL}/r/${testToken}`, {
      waitUntil: 'commit',
      timeout: 15000
    })
    console.log(`/r/${testToken} response status:`, response?.status())
    await publicPage.waitForTimeout(1000)
    const filename = 'reviews-public-redirect.png'
    await publicPage.screenshot({
      path: path.join(LOCAL_DIR, filename),
      fullPage: false
    })
    mirrorFile(filename)
  } catch (err) {
    console.log('Redirect navigation noted (expected redirect):', err.message)
    try {
      const filename = 'reviews-public-redirect.png'
      await publicPage.screenshot({
        path: path.join(LOCAL_DIR, filename),
        fullPage: false
      })
      mirrorFile(filename)
    } catch {}
  }
  await publicContext.close()

  await browser.close()
  console.log('All reviews screenshots successfully captured and mirrored!')
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
