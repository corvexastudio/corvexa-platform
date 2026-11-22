import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const FFMPEG_PATH = 'C:\\Users\\mskar\\AppData\\Local\\ms-playwright\\ffmpeg-1011\\ffmpeg-win64.exe';
const CHROMIUM_PATH = 'C:\\Users\\mskar\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';

async function test() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.setContent(`
    <!DOCTYPE html><html><body><canvas id="stage" width="1080" height="1920"></canvas>
    <script>
      window.renderAt = function(t) {
        const c = document.getElementById('stage');
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#0b132b';
        ctx.fillRect(0,0,1080,1920);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 50px sans-serif';
        ctx.fillText('Test t=' + t.toFixed(2), 200, 500);
      }
    </script></body></html>
  `);

  console.log('Page ready. Testing frame render...');
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) {
    await page.evaluate(t => window.renderAt(t), i / 30);
    const dataUrl = await page.evaluate(() => document.getElementById('stage').toDataURL('image/jpeg', 0.85));
    console.log(`Frame ${i} OK, length: ${dataUrl.length}`);
  }
  console.log(`5 frames completed in ${Date.now() - t0}ms`);
  await browser.close();
}

test().catch(console.error);
