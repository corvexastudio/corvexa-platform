import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { getAuthCookies } from '../test/e2e/auth-helper.mjs'

const BASE_URL = 'http://localhost:3088'
const LOCAL_DIR = path.resolve('screenshots/settings')
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/settings'

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

  const chromePath = path.join(
    process.env.LOCALAPPDATA,
    'ms-playwright',
    'chromium-1243',
    'chrome-win64',
    'chrome.exe'
  )

  console.log('Launching Chromium at:', chromePath)
  const browser = await chromium.launch({
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    headless: true
  })

  // Viewport specs to capture
  const viewports = [
    { name: '320px', width: 320, height: 800, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '430px', width: 430, height: 932, isMobile: true },
    { name: '1440px', width: 1440, height: 900, isMobile: false }
  ]

  for (const vp of viewports) {
    console.log(`\n--- Capturing for viewport: ${vp.name} (${vp.width}x${vp.height}) ---`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    await context.addCookies(cookies)

    const page = await context.newPage()
    await page.goto(`${BASE_URL}/client/settings`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForSelector(vp.isMobile ? 'button[data-hub-card="profile"]' : 'button[data-desktop-tab="profile"]', { timeout: 20000 })
    await page.waitForTimeout(600)

    if (vp.isMobile) {
      // 0. Mobile Setup Center Hub
      console.log(`Capturing mobile hub for ${vp.name}...`)
      const hubFile = `settings-${vp.name}-hub.png`
      await page.screenshot({ path: path.join(LOCAL_DIR, hubFile), fullPage: true })
      mirrorFile(hubFile)

      // Enter Profile category from hub
      console.log(`Entering Profile category from hub for ${vp.name}...`)
      await page.locator('button[data-hub-card="profile"]').first().click({ force: true })
      await page.waitForTimeout(600)
    }

    // 1. Profile Category Screenshot
    console.log(`Capturing Profile category for ${vp.name}...`)
    const profileFile = `settings-${vp.name}-profile.png`
    await page.screenshot({ path: path.join(LOCAL_DIR, profileFile), fullPage: true })
    mirrorFile(profileFile)

    // For 320px: also capture dirty state showing sticky bottom save bar
    if (vp.name === '320px') {
      console.log('Triggering dirty state for 320px mobile sticky bar screenshot...')
      const cityInput = page.locator('input[placeholder="City"]')
      if (await cityInput.count() > 0) {
        await cityInput.fill('Austin Metro')
        await page.waitForTimeout(300)
        const dirtyFile = `settings-320px-dirty-bar.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, dirtyFile) })
        mirrorFile(dirtyFile)
        // Discard by clicking Discard button
        const discardBtn = page.locator('div.fixed button:has-text("Discard")')
        if (await discardBtn.count() > 0) {
          await discardBtn.first().click({ force: true })
          await page.waitForTimeout(300)
        }
      }
    }

    // 2. Billing Category Screenshot
    console.log(`Switching to Billing category for ${vp.name}...`)
    if (vp.isMobile) {
      await page.locator('button[data-tab-pill="billing"]').first().click({ force: true })
    } else {
      await page.locator('button[data-desktop-tab="billing"]').first().click({ force: true })
    }
    await page.waitForSelector('text=Current Plan', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)
    const billingFile = `settings-${vp.name}-billing.png`
    await page.screenshot({ path: path.join(LOCAL_DIR, billingFile), fullPage: true })
    mirrorFile(billingFile)

    // For 390px mobile: capture Annual switch, matrix expansion, and mobile deck tabs
    if (vp.name === '390px') {
      console.log('Capturing Annual Switcher for 390px...')
      const annualBtn = page.locator('button:has-text("Annual")')
      if (await annualBtn.count() > 0) {
        await annualBtn.first().click({ force: true })
        await page.waitForTimeout(300)
        const annualFile = `settings-390px-billing-annual.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, annualFile), fullPage: true })
        mirrorFile(annualFile)
      }

      console.log('Capturing Feature Matrix Expansion for 390px...')
      const matrixBtn = page.locator('button:has-text("Compare All Plan Features")')
      if (await matrixBtn.count() > 0) {
        await matrixBtn.first().click({ force: true })
        await page.waitForTimeout(300)
        const matrixFile = `settings-390px-billing-matrix.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, matrixFile), fullPage: true })
        mirrorFile(matrixFile)
      }
    }

    // For 1440px desktop: capture Feature Matrix
    if (vp.name === '1440px') {
      console.log('Capturing Feature Matrix Expansion for 1440px...')
      const matrixBtn = page.locator('button:has-text("Compare All Plan Features")')
      if (await matrixBtn.count() > 0) {
        await matrixBtn.first().click({ force: true })
        await page.waitForTimeout(300)
        const matrixFile = `settings-1440px-billing-matrix.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, matrixFile), fullPage: true })
        mirrorFile(matrixFile)
      }
    }

    // 3. Telephony Category Screenshot
    console.log(`Switching to Phone category for ${vp.name}...`)
    if (vp.isMobile) {
      await page.locator('button[data-tab-pill="telephony"]').first().click({ force: true })
    } else {
      await page.locator('button[data-desktop-tab="telephony"]').first().click({ force: true })
    }
    await page.waitForTimeout(600)
    const telephonyFile = `settings-${vp.name}-telephony.png`
    await page.screenshot({ path: path.join(LOCAL_DIR, telephonyFile), fullPage: true })
    mirrorFile(telephonyFile)

    // For 390px mobile: capture carrier tab switches and test SMS modal
    if (vp.name === '390px') {
      console.log('Capturing AT&T carrier tab for 390px...')
      const attBtn = page.locator('button:has-text("AT&T")')
      if (await attBtn.count() > 0) {
        await attBtn.first().click({ force: true })
        await page.waitForTimeout(300)
        const attFile = `settings-390px-carrier-att.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, attFile), fullPage: true })
        mirrorFile(attFile)
      }

      console.log('Capturing Prepaid carrier tab for 390px...')
      const prepaidBtn = page.locator('button:has-text("Prepaid / MVNO")')
      if (await prepaidBtn.count() > 0) {
        await prepaidBtn.first().click({ force: true })
        await page.waitForTimeout(300)
        const prepaidFile = `settings-390px-carrier-prepaid.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, prepaidFile), fullPage: true })
        mirrorFile(prepaidFile)
      }

      console.log('Capturing Test SMS Modal for 390px...')
      const testSmsBtn = page.locator('button:has-text("Test Carrier SMS Deliverability")')
      if (await testSmsBtn.count() > 0) {
        await testSmsBtn.first().click({ force: true })
        await page.waitForTimeout(500)
        const modalFile = `settings-390px-test-sms-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, modalFile) })
        mirrorFile(modalFile)
        // Close modal
        const closeBtn = page.locator('button:has-text("Close")')
        if (await closeBtn.count() > 0) {
          await closeBtn.first().click({ force: true })
          await page.waitForTimeout(300)
        }
      }
    }

    // 4. Payments Category Screenshot
    console.log(`Switching to Payments category for ${vp.name}...`)
    if (vp.isMobile) {
      await page.locator('button[data-tab-pill="payments"]').first().click({ force: true })
    } else {
      await page.locator('button[data-desktop-tab="payments"]').first().click({ force: true })
    }
    await page.waitForTimeout(600)
    const paymentsFile = `settings-${vp.name}-payments.png`
    await page.screenshot({ path: path.join(LOCAL_DIR, paymentsFile), fullPage: true })
    mirrorFile(paymentsFile)

    // For 390px mobile: capture Monday Digest Preview Modal
    if (vp.name === '390px') {
      console.log('Capturing Monday Digest Preview Modal for 390px...')
      const digestBtn = page.locator('button:has-text("Send Monday Summary Preview")')
      if (await digestBtn.count() > 0) {
        await digestBtn.first().click({ force: true })
        await page.waitForTimeout(500)
        const digestModalFile = `settings-390px-digest-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, digestModalFile) })
        mirrorFile(digestModalFile)
        // Close modal
        const closeBtn = page.locator('div[role="dialog"] button:has-text("Close")')
        if (await closeBtn.count() > 0) {
          await closeBtn.first().click({ force: true })
          await page.waitForTimeout(300)
        }
      }
    }

    await context.close()
  }

  await browser.close()
  console.log('\nAll screenshots captured and mirrored successfully!')
}

capture().catch(err => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
