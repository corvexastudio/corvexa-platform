/**
 * Web Push Notification Service
 * Encapsulates VAPID authentication, payload serialization, and push dispatch.
 * Handles HTTP 404/410 subscription expiry gracefully by deactivating stale endpoints.
 */

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PushSubscriptionRecord,
  PushNotificationPayload,
  WebPushSendResult
} from '../notification-types.ts'

let vapidInitialized = false

/**
 * Initializes VAPID details once if environment variables are present.
 */
export function ensureVapidConfigured(): boolean {
  if (vapidInitialized) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@captodesk.com'

  if (!publicKey || !privateKey) {
    return false
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidInitialized = true
    return true
  } catch (err) {
    console.warn('[WEB PUSH] Failed to initialize VAPID details:', err)
    return false
  }
}

/**
 * Dispatches a Web Push notification to a specific subscription record.
 * On 404/410 Gone responses, automatically marks the subscription as inactive in the database.
 */
export async function sendWebPushNotification(
  supabase: SupabaseClient | null,
  subscription: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<WebPushSendResult> {
  const isConfigured = ensureVapidConfigured()
  if (!isConfigured) {
    return {
      success: false,
      error: 'VAPID keys not configured in environment'
    }
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh_key,
      auth: subscription.auth_key
    }
  }

  const serializedPayload = JSON.stringify({
    notificationId: payload.notificationId,
    event: payload.event,
    title: payload.title,
    body: payload.body,
    url: payload.url,
    timestamp: payload.timestamp
  })

  try {
    const res = await webpush.sendNotification(pushSubscription, serializedPayload)
    return {
      success: true,
      statusCode: res.statusCode
    }
  } catch (err: any) {
    const statusCode = err?.statusCode || err?.status
    const isExpired = statusCode === 404 || statusCode === 410

    if (isExpired && supabase && subscription.id) {
      try {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', subscription.id)
      } catch (dbErr) {
        console.warn('[WEB PUSH] Failed to deactivate expired push subscription:', dbErr)
      }
    }

    return {
      success: false,
      statusCode,
      expired: isExpired,
      error: err?.message || 'Failed to dispatch web push'
    }
  }
}
