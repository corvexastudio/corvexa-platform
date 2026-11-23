import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUTPUT_DIR = 'C:\\Users\\mskar\\.gemini\\antigravity\\brain\\49f801e5-66c3-4a61-8198-85284e862916\\screenshots\\live-tracker'
const TOKEN = '05e70de518a342bfb0cd909c5dc3fc25'
const BASE_URL = `http://localhost:3088/track/${TOKEN}`
const ALIAS_URL = `http://localhost:3088/t/${TOKEN}`

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
    { name: 'desktop-1280px', width: 1280, height: 800 },
    { name: 'desktop-1024px', width: 1024, height: 768 },
    { name: 'tablet-768px', width: 768, height: 1024 },
    { name: 'mobile-430px', width: 430, height: 932 },
    { name: 'mobile-390px', width: 390, height: 844 },
    { name: 'mobile-375px', width: 375, height: 667 },
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

    // Wait for tracker content to load
    await page.waitForSelector('text=Plumbing Diagnostic & Leak Inspection', { timeout: 15000 })

    const filePath = path.join(OUTPUT_DIR, `tracker-completed-${vp.name}.png`)
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`Saved: ${filePath}`)

    await context.close()
  }

  // Also verify short alias /t/[token] loads identically on desktop-1440px
  console.log('Verifying short alias /t/[token]...')
  const aliasContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  })
  const aliasPage = await aliasContext.newPage()
  await aliasPage.goto(ALIAS_URL, { waitUntil: 'networkidle' })
  await aliasPage.waitForSelector('text=Plumbing Diagnostic & Leak Inspection', { timeout: 15000 })
  const aliasFilePath = path.join(OUTPUT_DIR, 'tracker-alias-short-1440px.png')
  await aliasPage.screenshot({ path: aliasFilePath, fullPage: true })
  console.log(`Saved alias screenshot: ${aliasFilePath}`)
  await aliasContext.close()

  await browser.close()
  console.log('All screenshots captured successfully!')
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
