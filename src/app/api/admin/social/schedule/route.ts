import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { 
  DEFAULT_SCHEDULE_SETTINGS, 
  generateAutomatedQueue, 
  multiCastPost, 
  type DailyScheduleSettings, 
  type ScheduledPostItem 
} from '@/lib/social/social-engine'

// Persistent in-memory store for social automation queue
let currentSettings: DailyScheduleSettings = { ...DEFAULT_SCHEDULE_SETTINGS }
let scheduledQueue: ScheduledPostItem[] = generateAutomatedQueue(3, currentSettings)

export async function GET() {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    return NextResponse.json({
      success: true,
      settings: currentSettings,
      queue: scheduledQueue,
      stats: {
        totalQueued: scheduledQueue.filter(q => q.status === 'queued').length,
        totalPublished: scheduledQueue.filter(q => q.status === 'published').length,
        postsPerDay: currentSettings.postsPerDay,
        timeSlots: currentSettings.timeSlots
      }
    })
  } catch (err: any) {
    console.error('[Social Schedule API GET Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch schedule state' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    const body = await request.json()
    const { action } = body

    // 1. Update Schedule Configuration (posts per day, time slots, platforms)
    if (action === 'update_settings') {
      if (body.settings) {
        currentSettings = {
          ...currentSettings,
          ...body.settings
        }
      }
      return NextResponse.json({
        success: true,
        message: `Updated daily schedule: ${currentSettings.postsPerDay} posts/day.`,
        settings: currentSettings
      })
    }

    // 2. Auto-Generate Next N Days of Creatives & Queue
    if (action === 'auto_generate') {
      const days = body.days || 3
      const newItems = generateAutomatedQueue(days, currentSettings)
      scheduledQueue = [...newItems, ...scheduledQueue.filter(q => q.status === 'published')]
      
      return NextResponse.json({
        success: true,
        message: `Generated and queued ${newItems.length} posts & reels across the next ${days} days.`,
        queue: scheduledQueue
      })
    }

    // 3. Immediately Dispatch a Queued Post
    if (action === 'dispatch_post') {
      const { postId } = body
      const item = scheduledQueue.find(q => q.id === postId)
      if (!item) {
        return NextResponse.json({ error: 'Scheduled item not found in queue' }, { status: 404 })
      }

      const results = await multiCastPost({
        platforms: item.platforms,
        title: item.title,
        content: item.content,
        mediaUrl: item.mediaUrl,
        mediaType: item.mediaType
      })

      item.status = results.every(r => r.success) ? 'published' : 'failed'
      item.publishedAt = new Date().toISOString()

      return NextResponse.json({
        success: true,
        message: `Post dispatched live across ${item.platforms.length} platforms.`,
        results,
        item
      })
    }

    // 4. Delete an item from the queue
    if (action === 'delete_post') {
      const { postId } = body
      scheduledQueue = scheduledQueue.filter(q => q.id !== postId)
      return NextResponse.json({
        success: true,
        message: 'Post removed from scheduled queue.',
        queue: scheduledQueue
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[Social Schedule API POST Error]', err)
    return NextResponse.json({ error: err.message || 'Schedule execution failed' }, { status: 500 })
  }
}
