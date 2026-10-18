import { spawn, execSync } from 'child_process'
import http from 'http'
import fs from 'fs'
import path from 'path'

const PORT = 3088
const BASE_URL = `http://127.0.0.1:${PORT}`
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const OUT_DIR = path.resolve('screenshots/phase2b1')
const ARTIFACT_DIR = 'C:\\Users\\mskar\\.gemini\\antigravity\\brain\\49f801e5-66c3-4a61-8198-85284e862916\\screenshots\\phase2b1'

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        resolve()
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Server timeout'))
        } else {
          setTimeout(check, 500)
        }
      })
    }
    check()
  })
}

function captureScreenshot(url, outFile, width, height) {
  const args = [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--window-size=${width},${height}`,
    `--screenshot="${outFile}"`,
    `"${url}"`
  ]
  console.log(`Capturing ${url} (${width}x${height}) -> ${path.basename(outFile)}`)
  execSync(`"${EDGE_PATH}" ${args.join(' ')}`, { stdio: 'inherit' })
}

async function main() {
  console.log(`Starting Next.js production server on port ${PORT}...`)
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    shell: true,
    stdio: 'pipe'
  })

  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`))
  server.stderr.on('data', (d) => process.stderr.write(`[server-err] ${d}`))

  try {
    console.log('Waiting for server readiness...')
    await waitForServer(`${BASE_URL}/api/health`)
    console.log('Server is healthy and ready!')

    const targets = [
      { name: 'login_desktop', path: '/client/login', w: 1280, h: 800 },
      { name: 'login_mobile', path: '/client/login', w: 390, h: 844 },
      { name: 'login_narrow', path: '/client/login', w: 320, h: 700 },

      { name: 'dashboard_desktop', path: '/client/dashboard', w: 1280, h: 900 },
      { name: 'dashboard_mobile', path: '/client/dashboard', w: 390, h: 844 },
      { name: 'dashboard_narrow', path: '/client/dashboard', w: 320, h: 700 },

      { name: 'inbox_desktop', path: '/client/inbox', w: 1280, h: 900 },
      { name: 'inbox_mobile', path: '/client/inbox', w: 390, h: 844 },
      { name: 'inbox_narrow', path: '/client/inbox', w: 320, h: 700 },

      { name: 'leads_desktop', path: '/client/leads', w: 1280, h: 900 },
      { name: 'leads_mobile', path: '/client/leads', w: 390, h: 844 },
      { name: 'leads_narrow', path: '/client/leads', w: 320, h: 700 },

      { name: 'field_desktop', path: '/client/field', w: 1280, h: 900 },
      { name: 'field_mobile', path: '/client/field', w: 390, h: 844 },
      { name: 'field_narrow', path: '/client/field', w: 320, h: 700 }
    ]

    for (const t of targets) {
      const outPath = path.join(OUT_DIR, `${t.name}.png`)
      captureScreenshot(`${BASE_URL}${t.path}`, outPath, t.w, t.h)
      if (fs.existsSync(outPath)) {
        const artifactPath = path.join(ARTIFACT_DIR, `${t.name}.png`)
        fs.copyFileSync(outPath, artifactPath)
        console.log(`  ✓ Saved: ${outPath} (${fs.statSync(outPath).size} bytes)`)
      }
    }

    console.log('All screenshots captured successfully!')
  } finally {
    console.log('Stopping server...')
    try {
      execSync(`powershell -Command "Stop-Process -Id ${server.pid} -Force -ErrorAction SilentlyContinue"`)
      // Kill any remaining node next processes on port 3088
      execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`)
    } catch {}
  }
}

main().catch(err => {
  console.error('Capture failed:', err)
  process.exit(1)
})
