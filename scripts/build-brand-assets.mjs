import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const brandDir = path.join(process.cwd(), 'public', 'brand')
if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true })

const img1Path = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/.user_uploaded/media_1793454448366_6c384c0b.png'
const img2Path = 'C:/Users/mskar/.gemini/antigravity/brain/49f801e5-66c3-4a61-8198-85284e862916/.user_uploaded/media_1793454460054_a6115a65.jpg'

async function run() {
  console.log('Generating brand assets...')

  // 1. Full logo banner
  await sharp(img1Path).png({ quality: 100 }).toFile(path.join(brandDir, 'captodesk-logo.png'))
  console.log('✓ Saved captodesk-logo.png')

  // 1b. Cropped logo banner (tight bounds around 846x169 content with clean 24px padding)
  await sharp(img1Path)
    .extract({ left: 60, top: 60, width: 900, height: 210 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'captodesk-logo-banner.png'))
  console.log('✓ Saved captodesk-logo-banner.png')

  // 2. Square icon master
  await sharp(img2Path).png({ quality: 100 }).toFile(path.join(brandDir, 'captodesk-icon.png'))
  console.log('✓ Saved captodesk-icon.png')

  // 3. Transparent rounded squircle version (iOS 22% squircle radius = 225px on 1024x1024)
  const squircleSvg = Buffer.from(`
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="1024" height="1024" rx="225" ry="225" fill="#ffffff"/>
    </svg>
  `)

  const roundedIcon = await sharp(img2Path)
    .resize(1024, 1024)
    .composite([{ input: squircleSvg, blend: 'dest-in' }])
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(brandDir, 'captodesk-icon-rounded.png'), roundedIcon)
  console.log('✓ Saved captodesk-icon-rounded.png')

  // 4. Generate app icons for Next.js metadata and PWA
  await sharp(roundedIcon).resize(512, 512).png().toFile(path.join(process.cwd(), 'src', 'app', 'icon.png'))
  await sharp(roundedIcon).resize(512, 512).png().toFile(path.join(process.cwd(), 'public', 'icon.png'))
  await sharp(roundedIcon).resize(192, 192).png().toFile(path.join(process.cwd(), 'public', 'icon-192.png'))
  await sharp(roundedIcon).resize(512, 512).png().toFile(path.join(process.cwd(), 'public', 'icon-512.png'))
  await sharp(roundedIcon).resize(180, 180).png().toFile(path.join(process.cwd(), 'src', 'app', 'apple-icon.png'))
  await sharp(roundedIcon).resize(180, 180).png().toFile(path.join(process.cwd(), 'public', 'apple-icon.png'))
  await sharp(roundedIcon).resize(180, 180).png().toFile(path.join(process.cwd(), 'public', 'apple-touch-icon.png'))
  console.log('✓ Saved app icons (icon.png, apple-icon.png, icon-192, icon-512)')

  // 5. Favicon PNGs
  const icon32 = await sharp(roundedIcon).resize(32, 32).png().toBuffer()
  const icon16 = await sharp(roundedIcon).resize(16, 16).png().toBuffer()
  const icon48 = await sharp(roundedIcon).resize(48, 48).png().toBuffer()

  fs.writeFileSync(path.join(brandDir, 'favicon-32x32.png'), icon32)
  fs.writeFileSync(path.join(brandDir, 'favicon-16x16.png'), icon16)
  fs.writeFileSync(path.join(brandDir, 'favicon-48x48.png'), icon48)
  fs.writeFileSync(path.join(process.cwd(), 'public', 'favicon.png'), icon32)
  console.log('✓ Saved favicon PNG sizes')

  // 6. Generate valid multi-size ICO binary for favicon.ico
  // An ICO file header contains:
  // - 2 bytes: reserved (0)
  // - 2 bytes: type (1 = ICO)
  // - 2 bytes: count of images (3: 16, 32, 48)
  // followed by 16-byte directory entries for each image, then the PNG image data
  function createIco(pngBuffers) {
    const numImages = pngBuffers.length
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0) // reserved
    header.writeUInt16LE(1, 2) // type: 1 = ICO
    header.writeUInt16LE(numImages, 4) // count

    const entries = []
    let currentOffset = 6 + numImages * 16

    for (const buf of pngBuffers) {
      // parse dimension from PNG IHDR (bytes 16-24)
      const width = buf.readUInt32BE(16)
      const height = buf.readUInt32BE(20)
      const entry = Buffer.alloc(16)
      entry.writeUInt8(width >= 256 ? 0 : width, 0) // width (0 = 256)
      entry.writeUInt8(height >= 256 ? 0 : height, 1) // height
      entry.writeUInt8(0, 2) // color palette (0 = no palette)
      entry.writeUInt8(0, 3) // reserved
      entry.writeUInt16LE(1, 4) // color planes
      entry.writeUInt16LE(32, 6) // bits per pixel
      entry.writeUInt32LE(buf.length, 8) // image size in bytes
      entry.writeUInt32LE(currentOffset, 12) // offset of image data
      entries.push(entry)
      currentOffset += buf.length
    }

    return Buffer.concat([header, ...entries, ...pngBuffers])
  }

  const icoBuffer = createIco([icon16, icon32, icon48])
  fs.writeFileSync(path.join(process.cwd(), 'src', 'app', 'favicon.ico'), icoBuffer)
  fs.writeFileSync(path.join(process.cwd(), 'public', 'favicon.ico'), icoBuffer)
  console.log('✓ Generated multi-size favicon.ico (16px, 32px, 48px)')

  // 7. Generate OpenGraph social sharing card (1200x630)
  // Navy backdrop (#020A18) featuring the high-res brand banner
  const ogBanner = await sharp(img1Path)
    .resize(960, 320, { fit: 'contain', background: { r: 2, g: 10, b: 24, alpha: 1 } })
    .toBuffer()

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 2, g: 10, b: 24, alpha: 1 }
    }
  })
    .composite([
      {
        input: ogBanner,
        top: 155,
        left: 120
      }
    ])
    .png()
    .toFile(path.join(process.cwd(), 'public', 'opengraph-image.png'))

  console.log('✓ Generated 1200x630 public/opengraph-image.png')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
