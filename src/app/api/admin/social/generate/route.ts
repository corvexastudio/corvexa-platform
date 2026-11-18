import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    const { topic, trade, format } = await request.json()

    // Dynamic generation templates for trade contractor acquisition
    const tradeLabel = trade || 'plumber'
    const isVideo = format === 'video_short'

    if (isVideo) {
      return NextResponse.json({
        success: true,
        title: `Viral 25s Short: ${topic || 'Missed Call Recovery'}`,
        content: `NEVER climb down a ladder to answer a ringing phone. 🚫🛠️

Here is what happens when you miss a call in 2026:
Homeowner hears voicemail ➡️ hangs up ➡️ calls your competitor.

With CaptoDesk, an automated SMS calendar link fires in 8 seconds. Homeowners lock in their appointment on your calendar while your hands stay on the tools.

First 3 customer jobs are 100% free with $0 platform fees at captodesk.com!

#${tradeLabel}tok #contractorsofinstagram #bluecollar #shorts #captodesk`,
        mediaType: 'video',
        videoScript: {
          duration: '25 seconds',
          hook: 'STOP CLIMBING DOWN THE LADDER 🚫',
          scenes: [
            {
              timestamp: '0:00 - 0:04',
              visual: `Close-up of a tired ${tradeLabel} with tools, phone ringing in pocket.`,
              captionOverlay: 'STOP ANSWERING THIS 🚫',
              voiceover: `If you are in the middle of a ${tradeLabel} job, do not answer that call.`
            },
            {
              timestamp: '0:04 - 0:08',
              visual: 'Graphic showing red X over voicemail icon.',
              captionOverlay: 'Voicemail = Lost Job 💸',
              voiceover: 'Because 82% of homeowners hang up on voicemail and call the next contractor.'
            },
            {
              timestamp: '0:08 - 0:16',
              visual: 'Smartphone showing CaptoDesk 15s auto-reply text and customer instant booking.',
              captionOverlay: '15-Sec Auto Text-Back ⚡',
              voiceover: 'Instead, CaptoDesk auto-texts them your booking link. They book in 30 seconds.'
            },
            {
              timestamp: '0:16 - 0:25',
              visual: 'Service van driving off, CaptoDesk logo with First 3 Jobs Free.',
              captionOverlay: 'First 3 Jobs 100% Free 🛠️',
              voiceover: 'Keep your hands on the tools. Claim your free 3-job pass at captodesk.com.'
            }
          ]
        }
      })
    }

    // Default High-Converting Feed Post
    return NextResponse.json({
      success: true,
      title: `${topic || 'Missed Call Recovery'} (${tradeLabel.toUpperCase()})`,
      content: `How many ${tradeLabel} jobs did you lose this month simply because your hands were full when the phone rang? 🛠️📱

Most contractors don’t realize that 82% of residential homeowners who get sent to voicemail never leave a message — they simply call the next guy on Google Maps.

That one missed call could have been an easy $800 to $1,500 ticket.

CaptoDesk fixes this forever:
⚡ Instant 15-second SMS auto-reply whenever you can’t pick up
📅 Live Google & Instagram booking link so homeowners schedule 24/7 without phone tag
💳 1-tap Apple Pay driveway invoicing + automated 5-star Google reviews

Zero phone tag. Zero lost jobs.

👉 Claim your Free 3-Job Starter Pass today (no credit card required): captodesk.com

#${tradeLabel}life #contractorsofinstagram #fieldservice #smallbiz #trades #captodesk`,
      mediaType: 'image'
    })
  } catch (err: any) {
    console.error('[Admin Social Generate Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to generate campaign' }, { status: 500 })
  }
}
