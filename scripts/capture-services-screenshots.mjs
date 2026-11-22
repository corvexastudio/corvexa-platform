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
const ARTIFACT_DIR = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/screenshots/services'
const LOCAL_DIR = ARTIFACT_DIR

fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

function mirrorFile(filename) {
  console.log(`[SAVED] Saved ${filename} to artifact directory`)
}

async function capture() {
  console.log('Obtaining authenticated test session cookies...')
  const cookies = await getAuthCookies(BASE_URL)

  console.log('Launching browser via msedge channel...')
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  // Viewport matrix requested: 320px, 360px, 390px, 430px, 768px, 1440px
  const viewports = [
    { name: '320px', width: 320, height: 700, isMobile: true },
    { name: '360px', width: 360, height: 780, isMobile: true },
    { name: '375px', width: 375, height: 812, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '430px', width: 430, height: 932, isMobile: true },
    { name: '768px', width: 768, height: 1024, isMobile: false },
    { name: '1440px', width: 1440, height: 900, isMobile: false }
  ]

  for (const vp of viewports) {
    console.log(`\n--- Capturing Services Catalog for viewport: ${vp.name} (${vp.width}x${vp.height}) ---`)
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    })
    await context.addCookies(cookies)

    const page = await context.newPage()
    await page.goto(`${BASE_URL}/client/services`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    try {
      await page.waitForSelector('button:has-text("Add Service")', { timeout: 20000 })
    } catch {
      await page.waitForTimeout(3000)
    }
    await page.waitForTimeout(600)

    // Capture main services dashboard
    const dashFile = `services-${vp.name}-catalog.png`
    await page.screenshot({ path: path.join(LOCAL_DIR, dashFile), fullPage: true })
    mirrorFile(dashFile)

    // If 390px (primary mobile reference), capture detailed interactive states
    if (vp.name === '390px') {
      console.log('Capturing New Service Full-Screen Editor at 390px...')
      const addServiceBtn = page.locator('button:has-text("Add Service")').first()
      try {
        await addServiceBtn.waitFor({ state: 'visible', timeout: 10000 })
        await addServiceBtn.click()
        await page.waitForTimeout(800)

        // Capture initial New Service form (Basic Info & Pricing Models)
        const newFormFile = `services-390px-new-service-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, newFormFile), fullPage: true })
        mirrorFile(newFormFile)

        // Fill in test data to demonstrate live customer preview
        const nameInput = page.locator('input#svc-editor-name')
        if (await nameInput.isVisible()) {
          await nameInput.fill('Emergency AC Diagnostic & Tune-Up')
        }

        const catInput = page.locator('input#svc-editor-category')
        if (await catInput.isVisible()) {
          await catInput.fill('Cooling Diagnostics')
        }

        // Switch pricing model to Diagnostic Fee
        const diagModelBtn = page.locator('button:has-text("Diagnostic Fee")').first()
        if (await diagModelBtn.isVisible()) {
          await diagModelBtn.click()
        }

        const priceInput = page.locator('input#svc-editor-price')
        if (await priceInput.isVisible()) {
          await priceInput.fill('89.00')
        }

        // Add an optional add-on
        const addOptionBtn = page.locator('button:has-text("Add Option")').first()
        if (await addOptionBtn.isVisible()) {
          await addOptionBtn.click()
          await page.waitForTimeout(300)
          const addonNameInput = page.locator('input[placeholder*="Add-on name"]').first()
          if (await addonNameInput.isVisible()) {
            await addonNameInput.fill('MERV 11 Allergen Air Filter')
          }
          const addonPriceInput = page.locator('input[placeholder="0.00"]').first()
          if (await addonPriceInput.isVisible()) {
            await addonPriceInput.fill('35.00')
          }
        }

        await page.waitForTimeout(400)
        const filledNewFile = `services-390px-new-service-preview.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, filledNewFile), fullPage: true })
        mirrorFile(filledNewFile)

        // Test Unsaved Changes Confirmation Modal
        const closeBtn = page.locator('button[aria-label="Close service editor"]').first()
        if (await closeBtn.isVisible()) {
          await closeBtn.click()
          await page.waitForTimeout(400)

          const discardConfirmFile = `services-390px-discard-confirm-modal.png`
          await page.screenshot({ path: path.join(LOCAL_DIR, discardConfirmFile), fullPage: true })
          mirrorFile(discardConfirmFile)

          // Confirm discard to close
          const discardBtn = page.locator('button:has-text("Discard Changes")').first()
          if (await discardBtn.isVisible()) {
            await discardBtn.click()
            await page.waitForTimeout(400)
          }
        }
      } catch (err) {
        console.warn('[390px New Service capture warning]', err.message)
      }

      // Open Edit Service on first available service card
      console.log('Capturing Edit Service Modal at 390px...')
      const editTrigger = page.locator('button:has-text("Edit")').first()
      try {
        await editTrigger.waitFor({ state: 'visible', timeout: 10000 })
        await editTrigger.click()
        await page.waitForTimeout(800)

        const editModalFile = `services-390px-edit-service-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, editModalFile), fullPage: true })
        mirrorFile(editModalFile)

        // Close editor via Cancel button
        const cancelBtn = page.locator('button:has-text("Cancel")').first()
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click()
          await page.waitForTimeout(400)
        }
      } catch (err) {
        console.warn('[390px Edit Service capture warning]', err.message)
      }
    }

    // If 1440px (desktop), capture spacious modal experience
    if (vp.name === '1440px') {
      console.log('Capturing Spacious Desktop New Service Modal at 1440px...')
      const addServiceBtnDesktop = page.locator('button:has-text("Add Service")').first()
      try {
        await addServiceBtnDesktop.waitFor({ state: 'visible', timeout: 10000 })
        await addServiceBtnDesktop.click()
        await page.waitForTimeout(800)

        const desktopModalFile = `services-1440px-new-service-modal.png`
        await page.screenshot({ path: path.join(LOCAL_DIR, desktopModalFile), fullPage: true })
        mirrorFile(desktopModalFile)

        // Close modal
        const closeDesktop = page.locator('button[aria-label="Close service editor"]').first()
        if (await closeDesktop.isVisible()) {
          await closeDesktop.click()
          await page.waitForTimeout(400)
        }
      } catch (err) {
        console.warn('[1440px capture warning]', err.message)
      }
    }

    await context.close()
  }

  await browser.close()
  console.log('\n[SUCCESS] All services screenshots captured and mirrored successfully.')
}

capture().catch((err) => {
  console.error('[CAPTURE ERROR]', err)
  process.exit(1)
})
