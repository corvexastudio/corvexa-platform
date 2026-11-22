import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const FFMPEG_PATH = 'C:\\Users\\mskar\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v9.0.2.exe';
const CHROMIUM_PATH = 'C:\\Users\\mskar\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
const OUT_FILE = 'c:\\Users\\mskar\\captodesk\\public\\marketing\\pipe_test.mp4';

async function test() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  
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
        ctx.fillText('Test Frame t=' + t.toFixed(2), 200, 500);
      }
    </script></body></html>
  `);

  console.log('Spawning ffmpeg...');
  const ffmpegProc = spawn(FFMPEG_PATH, [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', '30',
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    OUT_FILE
  ]);

  ffmpegProc.stderr.on('data', d => console.log('FFMPEG STDERR:', d.toString()));
  ffmpegProc.on('error', err => console.error('FFMPEG ERROR:', err));

  for (let i = 0; i < 30; i++) {
    await page.evaluate(t => window.renderAt(t), i / 30);
    const dataUrl = await page.evaluate(() => document.getElementById('stage').toDataURL('image/jpeg', 0.85));
    const buffer = Buffer.from(dataUrl.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    
    const canWrite = ffmpegProc.stdin.write(buffer);
    if (!canWrite) {
      console.log('Waiting for drain on frame', i);
      await new Promise(res => ffmpegProc.stdin.once('drain', res));
    }
  }

  console.log('Ending stdin...');
  ffmpegProc.stdin.end();

  await new Promise(res => ffmpegProc.on('close', res));
  console.log('Pipe test done! File exists:', fs.existsSync(OUT_FILE));
  await browser.close();
}

test().catch(console.error);
