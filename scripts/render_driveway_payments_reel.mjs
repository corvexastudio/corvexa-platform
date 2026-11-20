import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const FFMPEG_PATH = 'C:\\Users\\mskar\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v9.0.2.exe';
const CHROMIUM_PATH = 'C:\\Users\\mskar\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';

const MARKETING_DIR = 'C:\\Users\\mskar\\captodesk\\public\\marketing';
const MASTER_AUDIO = path.join(MARKETING_DIR, 'v3_master_audio.mp3');
const FINAL_VIDEO = path.join(MARKETING_DIR, 'captodesk_reel_driveway_payments.mp4');

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION = 44.09;
const TOTAL_FRAMES = Math.round(DURATION * FPS); // ~1323 frames

console.log('='.repeat(70));
console.log('  CaptoDesk High-Converting Reel 3 (Pixel-Perfect Spacing & 1-CTA)');
console.log(`  Target: ${WIDTH}x${HEIGHT} @ ${FPS} FPS | Duration: ${DURATION}s | Frames: ${TOTAL_FRAMES}`);
console.log('='.repeat(70));

async function render() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
  });

  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
  });

  // Inject the animation canvas HTML
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090e1d;
            overflow: hidden;
            width: ${WIDTH}px;
            height: ${HEIGHT}px;
          }
          canvas {
            display: block;
            width: ${WIDTH}px;
            height: ${HEIGHT}px;
          }
        </style>
      </head>
      <body>
        <canvas id="stage" width="${WIDTH}" height="${HEIGHT}"></canvas>
        <script>
          const canvas = document.getElementById('stage');
          const ctx = canvas.getContext('2d');
          const W = ${WIDTH};
          const H = ${HEIGHT};

            // Confetti particles for Scene 3
          const particles = [];
          for (let i = 0; i < 70; i++) {
            particles.push({
              vx: (Math.random() - 0.5) * 32,
              vy: (Math.random() - 0.7) * 38,
              size: Math.random() * 12 + 6,
              color: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#ffffff', '#a855f7'][Math.floor(Math.random() * 6)]
            });
          }

          function resetShadow() {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }

          function easeOutBack(x) {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
          }

          function easeOutCubic(x) {
            return 1 - Math.pow(1 - x, 3);
          }

          function drawRoundRect(x, y, w, h, r, fill, stroke, strokeWidth) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
            if (fill) {
              ctx.fillStyle = fill;
              ctx.fill();
            }
            if (stroke) {
              ctx.strokeStyle = stroke;
              ctx.lineWidth = strokeWidth || 2;
              ctx.stroke();
            }
          }

          window.renderAt = function(t) {
            resetShadow();

            // Background gradient
            const bgGrad = ctx.createLinearGradient(0, 0, W, H);
            bgGrad.addColorStop(0, '#060a16');
            bgGrad.addColorStop(0.5, '#0b132b');
            bgGrad.addColorStop(1, '#050811');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Ambient glowing orbs
            const orb1Y = 320 + Math.sin(t * 1.2) * 70;
            const rad1 = ctx.createRadialGradient(850, orb1Y, 10, 850, orb1Y, 520);
            rad1.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
            rad1.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.fillStyle = rad1;
            ctx.fillRect(0, 0, W, H);

            const orb2Y = 1520 + Math.cos(t * 1.1) * 80;
            const rad2 = ctx.createRadialGradient(220, orb2Y, 10, 220, orb2Y, 550);
            rad2.addColorStop(0, 'rgba(99, 102, 241, 0.20)');
            rad2.addColorStop(1, 'rgba(99, 102, 241, 0)');
            ctx.fillStyle = rad2;
            ctx.fillRect(0, 0, W, H);

            // Subtle Grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
            ctx.lineWidth = 1;
            for (let x = 60; x < W; x += 120) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, H);
              ctx.stroke();
            }
            for (let y = 60; y < H; y += 120) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(W, y);
              ctx.stroke();
            }

            // Top Header Branding Pill
            resetShadow();
            drawRoundRect(W/2 - 180, 60, 360, 52, 26, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)', 1.5);
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 24px -apple-system, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('⚡ CAPTODESK DISPATCH', W/2, 95);

            // ══════════════════════════════════════════════════════
            // SCENE 1: 0.00s to 9.84s (High-Converting Hook)
            // ══════════════════════════════════════════════════════
            if (t < 9.84) {
              const p = Math.min(1, t / 0.7);
              // Clean Y placement: Card starts below subtitle with plenty of breathing room
              const cardY = 660 + (1 - easeOutBack(p)) * 600;

              // Title & Subtitle (Cleanly spaced at y=190 and y=260)
              resetShadow();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 54px -apple-system, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('Chasing Checks 3 Weeks Later? 🤦‍♂️', W/2, 190);

              ctx.fillStyle = '#94a3b8';
              ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
              ctx.fillText('Finished the job in 2 hours... waiting 21 days for pay.', W/2, 260);

              // Old Paper Invoice Card
              ctx.save();
              ctx.translate(W/2, cardY);

              // Card Drop shadow
              ctx.shadowColor = 'rgba(0,0,0,0.6)';
              ctx.shadowBlur = 40;
              ctx.shadowOffsetY = 20;
              drawRoundRect(-380, -250, 760, 520, 24, '#f8fafc', '#cbd5e1', 3);

              // Reset shadow immediately after card background
              resetShadow();

              // Invoice Header
              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 32px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText('CONTRACTOR INVOICE #1084', -330, -180);

              ctx.fillStyle = '#64748b';
              ctx.font = '24px sans-serif';
              ctx.fillText('Service: Full Ceramic Detail & Polish', -330, -130);
              ctx.fillText('Customer: Mark D. (Driveway Job)', -330, -90);

              // Divider
              ctx.strokeStyle = '#e2e8f0';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(-330, -50);
              ctx.lineTo(330, -50);
              ctx.stroke();

              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 28px sans-serif';
              ctx.fillText('Total Amount Due:', -330, 25);

              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 60px sans-serif';
              ctx.textAlign = 'right';
              ctx.fillText('$1,200.00', 330, 35);

              // Customer quote bubble (spaced below amount)
              drawRoundRect(-330, 95, 660, 105, 16, '#f1f5f9', '#e2e8f0', 2);
              ctx.fillStyle = '#475569';
              ctx.font = 'italic 23px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText('"Let me look for my checkbook inside...', -300, 138);
              ctx.fillText('did you get my check in the mail yet?"', -300, 172);

              // RED RUBBER STAMP (slams down in top-right of invoice at t = 2.8s)
              if (t > 2.8) {
                const stampP = Math.min(1, (t - 2.8) / 0.35);
                const stampScale = 2.2 - easeOutBack(stampP) * 1.2;
                ctx.save();
                ctx.translate(130, -110);
                ctx.rotate(0.08);
                ctx.scale(stampScale, stampScale);

                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 5.5;
                drawRoundRect(-190, -42, 380, 84, 14, 'rgba(239, 68, 68, 0.12)', '#ef4444', 5.5);

                resetShadow();
                ctx.fillStyle = '#ef4444';
                ctx.font = '900 34px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('PAST DUE: 21 DAYS', 0, 12);
                ctx.restore();
              }

              ctx.restore();

              // Bottom Warning Banner & Delay Pill (spaced with breathing room at y=1040)
              if (t > 4.2) {
                const warnP = Math.min(1, (t - 4.2) / 0.4);
                ctx.save();
                ctx.globalAlpha = warnP;
                resetShadow();
                drawRoundRect(W/2 - 400, 1030, 800, 105, 24, 'rgba(239, 68, 68, 0.15)', '#ef4444', 2.5);
                ctx.fillStyle = '#f87171';
                ctx.font = 'bold 32px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('❌ 3 Weeks of Begging for Paper Checks', W/2, 1095);

                // Supporting stat badge
                drawRoundRect(W/2 - 320, 1160, 640, 60, 30, 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.12)', 1.5);
                ctx.fillStyle = '#cbd5e1';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText('⏱️ Average Contractor Wait Time: 18-24 Days', W/2, 1198);
                ctx.restore();
              }
            }

            // ══════════════════════════════════════════════════════
            // SCENE 2: 9.84s to 19.63s (The 1-Tap Driveway Solution)
            // ══════════════════════════════════════════════════════
            else if (t < 19.63) {
              const s2T = t - 9.84;
              const p = Math.min(1, s2T / 0.65);

              // Title & Subtitle (Cleanly spaced at y=190 and y=260)
              resetShadow();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 54px -apple-system, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('Send Checkout on the Driveway', W/2, 190);

              ctx.fillStyle = '#10b981';
              ctx.font = 'bold 34px -apple-system, system-ui, sans-serif';
              ctx.fillText('1-Tap SMS Before You Put Truck in Reverse', W/2, 260);

              // 3D Phone Mockup Swooping In
              const phoneY = 1160 - easeOutBack(p) * 160;
              ctx.save();
              ctx.translate(W/2, phoneY);

              // Phone Outer Case
              ctx.shadowColor = 'rgba(0,0,0,0.7)';
              ctx.shadowBlur = 50;
              ctx.shadowOffsetY = 25;
              drawRoundRect(-270, -490, 540, 980, 56, '#1e293b', '#334155', 5);

              // Reset shadow immediately after phone body
              resetShadow();

              // Phone Screen
              drawRoundRect(-248, -468, 496, 936, 46, '#0f172a', null);

              // Dynamic Island Notch
              drawRoundRect(-85, -455, 170, 34, 17, '#000000', null);

              // Screen App Header
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 26px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('CaptoDesk Driveway Pay', 0, -380);

              // Job Invoice Box inside phone
              drawRoundRect(-215, -330, 430, 310, 22, '#1e293b', 'rgba(255,255,255,0.08)', 1.5);

              ctx.fillStyle = '#94a3b8';
              ctx.font = '22px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText('Customer:', -185, -280);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 24px sans-serif';
              ctx.fillText('Sarah Jenkins (BMW X5)', -185, -245);

              ctx.fillStyle = '#94a3b8';
              ctx.font = '22px sans-serif';
              ctx.fillText('Service Completed:', -185, -195);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 24px sans-serif';
              ctx.fillText('Full Ceramic Detail & Polish', -185, -160);

              ctx.fillStyle = '#10b981';
              ctx.font = '900 48px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('$1,200.00', 0, -65);

              // Glowing Action Button (With High-Contrast PURE WHITE text!)
              const buttonPress = (s2T > 4.2 && s2T < 5.2) ? 0.96 : 1.0;
              ctx.save();
              ctx.translate(0, 82);
              ctx.scale(buttonPress, buttonPress);

              ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
              ctx.shadowBlur = 30;
              drawRoundRect(-215, -52, 430, 105, 24, '#10b981', null);

              resetShadow();
              ctx.fillStyle = '#ffffff'; // PURE WHITE text on vibrant green button!
              ctx.font = 'bold 24px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('⚡ Send 1-Tap Text Checkout', 0, 8);
              ctx.restore();

              // SMS Flying Banner (at s2T > 5.0)
              if (s2T > 4.8) {
                const flyP = Math.min(1, (s2T - 4.8) / 0.45);
                ctx.save();
                ctx.globalAlpha = flyP;
                resetShadow();
                drawRoundRect(-220, 200, 440, 130, 20, '#0284c7', null);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 22px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('💬 SMS DELIVERED IN 1 SEC:', -190, 245);
                ctx.font = '20px sans-serif';
                ctx.fillText('"Tap here to review & pay $1,200"', -190, 290);
                ctx.restore();
              }

              ctx.restore();
            }

            // ══════════════════════════════════════════════════════
            // SCENE 3: 19.63s to 29.90s (Apple Pay & Instant Settlement)
            // ══════════════════════════════════════════════════════
            else if (t < 29.90) {
              const s3T = t - 19.63;
              const p = Math.min(1, s3T / 0.6);

              // Title & Subtitle (Cleanly spaced at y=190 and y=260)
              resetShadow();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 54px -apple-system, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('Customer Taps Apple Pay', W/2, 190);

              ctx.fillStyle = '#10b981';
              ctx.font = 'bold 34px -apple-system, system-ui, sans-serif';
              ctx.fillText('Money in Your Bank in 10 Seconds', W/2, 260);

              // Customer Phone
              ctx.save();
              ctx.translate(W/2, 1140);

              // Phone Case
              ctx.shadowColor = 'rgba(0,0,0,0.7)';
              ctx.shadowBlur = 50;
              drawRoundRect(-270, -490, 540, 980, 56, '#0f172a', '#334155', 5);

              resetShadow();
              drawRoundRect(-248, -468, 496, 936, 46, '#020617', null);

              // Top SMS banner on customer phone
              drawRoundRect(-215, -420, 430, 95, 18, '#1e293b', null);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 20px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText('CaptoDesk Invoice #1084', -185, -380);
              ctx.font = '18px sans-serif';
              ctx.fillStyle = '#94a3b8';
              ctx.fillText('Amount due: $1,200.00', -185, -345);

              // Apple Pay Sheet (Slides up from bottom)
              const sheetP = Math.min(1, s3T / 0.7);
              const sheetY = 470 - easeOutCubic(sheetP) * 580;

              drawRoundRect(-248, sheetY, 496, 580, 34, '#18181b', 'rgba(255,255,255,0.15)', 2);

              // Apple Pay Logo Header
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('Apple Pay', 0, sheetY + 70);

              // Divider
              ctx.strokeStyle = '#27272a';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(-210, sheetY + 110);
              ctx.lineTo(210, sheetY + 110);
              ctx.stroke();

              ctx.fillStyle = '#a1a1aa';
              ctx.font = '22px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText('PAYMENT METHOD', -190, sheetY + 160);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 24px sans-serif';
              ctx.fillText('Apple Card (•••• 8492)', -190, sheetY + 200);

              ctx.fillStyle = '#a1a1aa';
              ctx.font = '22px sans-serif';
              ctx.fillText('TOTAL DUE', -190, sheetY + 260);
              ctx.fillStyle = '#10b981';
              ctx.font = 'bold 44px sans-serif';
              ctx.textAlign = 'right';
              ctx.fillText('$1,200.00', 190, sheetY + 270);

              // Checkmark / Paid Status (at s3T > 4.2)
              if (s3T > 4.2) {
                // Green Success Circle
                ctx.shadowColor = '#10b981';
                ctx.shadowBlur = 40;
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(0, sheetY + 410, 75, 0, Math.PI * 2);
                ctx.fill();

                resetShadow();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 70px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('✓', 0, sheetY + 435);

                ctx.font = 'bold 30px sans-serif';
                ctx.fillText('PAID IN 10 SECONDS', 0, sheetY + 530);

                // Confetti Particles bursting cleanly around green checkmark
                const burstT = s3T - 4.2;
                for (let i = 0; i < particles.length; i++) {
                  const pt = particles[i];
                  ctx.fillStyle = pt.color;
                  ctx.beginPath();
                  const px = pt.vx * burstT * 5;
                  const rawPy = (sheetY + 410) + pt.vy * burstT * 3.5 + 0.5 * 32 * Math.pow(burstT, 2);
                  const py = Math.max(sheetY + 320, rawPy); // Keeps particles cleanly below price line
                  ctx.arc(px, py, pt.size, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else {
                // Face ID Scanner / Double Click button
                drawRoundRect(-170, sheetY + 360, 340, 85, 20, '#000000', '#3f3f46', 2);
                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Double Click to Pay', 0, sheetY + 412);
              }

              ctx.restore();
            }

            // ══════════════════════════════════════════════════════
            // SCENE 4: 29.90s to 44.09s (Hormozi Offer & 1 Single CTA)
            // ══════════════════════════════════════════════════════
            else {
              const s4T = t - 29.90;

              // Title & Subtitle (Cleanly spaced at y=190 and y=260)
              resetShadow();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 54px -apple-system, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('Never Leave a Driveway Unpaid', W/2, 190);

              ctx.fillStyle = '#94a3b8';
              ctx.font = 'bold 34px -apple-system, system-ui, sans-serif';
              ctx.fillText('No Card Swipers. No Paper Invoices.', W/2, 260);

              // 3 Value Pillar Cards
              const cardData = [
                { title: '✓ Zero Card Reader Hardware', sub: 'No swipers to charge, break, or lose', color: '#10b981', delay: 0.2 },
                { title: '✓ Zero Paper Invoicing', sub: 'Instant SMS & email receipts sent on the spot', color: '#38bdf8', delay: 1.4 },
                { title: '✓ Next-Day Direct Bank Payouts', sub: 'Funds go straight to your account', color: '#a855f7', delay: 2.6 }
              ];

              for (let i = 0; i < cardData.length; i++) {
                const c = cardData[i];
                if (s4T > c.delay) {
                  const cardP = Math.min(1, (s4T - c.delay) / 0.45);
                  const cardY = 370 + i * 140;

                  ctx.save();
                  ctx.globalAlpha = cardP;
                  resetShadow();
                  drawRoundRect(W/2 - 410, cardY, 820, 115, 22, '#1e293b', 'rgba(255,255,255,0.1)', 1.5);

                  ctx.fillStyle = c.color;
                  ctx.font = 'bold 34px sans-serif';
                  ctx.textAlign = 'left';
                  ctx.fillText(c.title, W/2 - 370, cardY + 48);

                  ctx.fillStyle = '#94a3b8';
                  ctx.font = '22px sans-serif';
                  ctx.fillText(c.sub, W/2 - 370, cardY + 84);
                  ctx.restore();
                }
              }

              // Giant Hormozi Offer Banner (Slams at s4T > 3.8)
              if (s4T > 3.8) {
                const offerP = Math.min(1, (s4T - 3.8) / 0.45);
                ctx.save();
                ctx.globalAlpha = offerP;

                ctx.shadowColor = '#10b981';
                ctx.shadowBlur = 40;
                drawRoundRect(W/2 - 430, 840, 860, 240, 28, 'rgba(16, 185, 129, 0.16)', '#10b981', 3.5);

                resetShadow();
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 28px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('★ EXCLUSIVE CONTRACTOR STARTER PASS ★', W/2, 905);

                ctx.fillStyle = '#ffffff';
                ctx.font = '900 60px sans-serif';
                ctx.fillText('FIRST 3 JOBS 100% FREE', W/2, 975);

                ctx.fillStyle = '#10b981';
                ctx.font = 'bold 30px sans-serif';
                ctx.fillText('$0 Platform Fees • No Credit Card Required', W/2, 1035);
                ctx.restore();
              }

              // High-Converting CTA Button (White bold text on solid emerald button)
              if (s4T > 5.5) {
                const ctaP = Math.min(1, (s4T - 5.5) / 0.45);
                const pulse = 1 + Math.sin((s4T - 5.5) * 4) * 0.025;

                ctx.save();
                ctx.globalAlpha = ctaP;
                ctx.translate(W/2, 1160);
                ctx.scale(pulse, pulse);

                ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
                ctx.shadowBlur = 40;
                drawRoundRect(-410, -55, 820, 110, 28, '#10b981', null);

                resetShadow();
                ctx.fillStyle = '#ffffff'; // PURE WHITE bold text for maximum contrast & readability
                ctx.font = '900 36px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Get Started Free 👉 captodesk.com', 0, 14);
                ctx.restore();

                // High-Converting Trust Badge (Directly below CTA)
                resetShadow();
                drawRoundRect(W/2 - 270, 1310, 540, 60, 30, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)', 1.5);
                ctx.fillStyle = '#cbd5e1';
                ctx.font = 'bold 24px -apple-system, system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔒 No Credit Card Required • Instant Setup', W/2, 1348);
              }
            }
          };
        </script>
      </body>
    </html>
  `);

  console.log('HTML5 Animation Canvas initialized.');
  console.log('Spawning FFmpeg stream encoder with Master Audio...');

  const ffmpegProc = spawn(FFMPEG_PATH, [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', FPS.toString(),
    '-i', '-', // video stream from stdin
    '-i', MASTER_AUDIO, // audio stream
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '19',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    FINAL_VIDEO
  ]);

  ffmpegProc.stderr.on('data', (d) => {
    const str = d.toString();
    if (str.includes('frame=')) {
      const match = str.match(/frame=\s*(\d+)/);
      if (match) {
        process.stdout.write(`\rFFmpeg Encoding Progress: Frame ${match[1]} / ${TOTAL_FRAMES}`);
      }
    }
  });

  const startTime = Date.now();

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;
    await page.evaluate((currT) => window.renderAt(currT), t);
    const dataUrl = await page.evaluate(() => document.getElementById('stage').toDataURL('image/jpeg', 0.88));
    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const canWrite = ffmpegProc.stdin.write(buffer);
    if (!canWrite) {
      await new Promise((res) => ffmpegProc.stdin.once('drain', res));
    }

    if (frame % 75 === 0 || frame === TOTAL_FRAMES - 1) {
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fps = (frame / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`Rendered frame ${frame}/${TOTAL_FRAMES} (${pct}%) | ${fps} FPS | ${elapsed}s elapsed`);
    }
  }

  ffmpegProc.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpegProc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  await browser.close();

  console.log('\n\x1b[32m%s\x1b[0m', '✓ Video rendering complete!');
  const stat = fs.statSync(FINAL_VIDEO);
  console.log(`Final MP4: ${FINAL_VIDEO}`);
  console.log(`File size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
}

render().catch((err) => {
  console.error('\n\x1b[31mRender failed:\x1b[0m', err);
  process.exit(1);
});
