/**
 * Centralized Notification Platform - Type Definitions
 * Defines the controlled event catalog, channels, priorities, and dispatch payloads.
 */

import type { sendTelnyxSms } from '../telnyx.ts'

export type NotificationEventType =
  // Critical operational & revenue events (Push + SMS by default)
  | 'missed_call_recovered'
  | 'customer_reply'
  | 'new_booking'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'payment_failed'
  | 'messaging_failure'
  | 'phone_number_failure'
  | 'system_action_required'
  // Important events (Push + In-app by default)
  | 'payment_received'
  | 'review_received'
  | 'invoice_overdue'

export type NotificationPriority = 'critical' | 'important' | 'normal' | 'low'

export type NotificationChannel = 'push' | 'sms' | 'in_app' | 'email'

export interface EventChannelPolicy {
  priority: NotificationPriority
  channels: NotificationChannel[]
}

export interface PushSubscriptionRecord {
  id: string
  org_id: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  user_agent?: string | null
  device_label?: string | null
  is_active: boolean
  last_seen_at?: string
  created_at?: string
  updated_at?: string
}

export interface PushNotificationPayload {
  notificationId: string
  event: NotificationEventType
  title: string
  body: string
  url: string
  timestamp: string
}

export interface WebPushSendResult {
  success: boolean
  statusCode?: number
  error?: string
  expired?: boolean
}

export interface NotifyOwnerParams {
  event: NotificationEventType
  organizationId: string
  idempotencyKey?: string
  data: {
    // Shared contextual metadata
    title?: string
    body?: string
    targetUrl?: string
    customerName?: string
    customerPhone?: string
    // Missed call specific
    callerPhone?: string
    calledPhone?: string
    callId?: string
    customerSmsSuccess?: boolean
    // Customer reply specific
    messageId?: string
    conversationId?: string
    replyPreview?: string
    // Booking specific
    appointmentId?: string
    serviceName?: string
    bookingTime?: string
    isInstant?: boolean
    // General payload data
    [key: string]: any
  }
  // Optional mocks / dependency injection for testing
  sendSmsFn?: typeof sendTelnyxSms
  webPushSendFn?: (sub: PushSubscriptionRecord, payload: PushNotificationPayload) => Promise<WebPushSendResult>
}

export interface ChannelDeliveryOutcome {
  channel: NotificationChannel
  success: boolean
  destination?: string
  providerMessageId?: string
  error?: string
  skippedReason?: string
  text?: string
}

export interface NotifyOwnerResult {
  attempted: boolean
  notificationId?: string
  event: NotificationEventType
  deliveries: ChannelDeliveryOutcome[]
  skippedReason?: string
  error?: string
}
