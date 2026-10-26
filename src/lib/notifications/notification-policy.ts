/**
 * Centralized Notification Platform - Policy & Routing
 * Governs channel policies, priority mapping, copy generation, and open-redirect sanitization.
 */

import type { NotificationEventType, EventChannelPolicy } from './notification-types.ts'

export const NOTIFICATION_EVENT_POLICIES: Record<NotificationEventType, EventChannelPolicy> = {
  missed_call_recovered: {
    priority: 'critical',
    channels: ['push', 'sms', 'in_app']
  },
  customer_reply: {
    priority: 'critical',
    channels: ['push', 'sms', 'in_app']
  },
  new_booking: {
    priority: 'critical',
    channels: ['push', 'sms', 'in_app']
  },
  booking_cancelled: {
    priority: 'important',
    channels: ['push', 'in_app']
  },
  booking_rescheduled: {
    priority: 'important',
    channels: ['push', 'in_app']
  },
  payment_failed: {
    priority: 'critical',
    channels: ['push', 'sms', 'in_app']
  },
  payment_received: {
    priority: 'important',
    channels: ['push', 'in_app']
  },
  review_received: {
    priority: 'important',
    channels: ['push', 'in_app']
  },
  invoice_overdue: {
    priority: 'important',
    channels: ['push', 'in_app']
  },
  messaging_failure: {
    priority: 'critical',
    channels: ['push', 'sms', 'in_app']
  },
  phone_number_failure: {
    priority: 'critical',
    channels: ['push', 'sms', 'in_app']
  },
  system_action_required: {
    priority: 'critical',
    channels: ['push', 'sms', 'in_app']
  }
}

/**
 * Validates whether an event is in the controlled catalog.
 */
export function isKnownEvent(event: string): event is NotificationEventType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_EVENT_POLICIES, event)
}

/**
 * Returns the channel and priority policy for an event, or null if unknown.
 */
export function getEventPolicy(event: NotificationEventType): EventChannelPolicy | null {
  return NOTIFICATION_EVENT_POLICIES[event] || null
}

const ALLOWED_ROUTE_PREFIXES = [
  '/client/inbox',
  '/client/calendar',
  '/client/dashboard',
  '/client/customers',
  '/client/jobs',
  '/client/leads',
  '/client/field',
  '/client/billing',
  '/client/quotes',
  '/client/invoices',
  '/client/reviews',
  '/client/services',
  '/client/team',
  '/client/settings',
  '/client/activity'
]

/**
 * Sanitizes target URLs to strictly prevent open redirects.
 * Rejects external protocols (http:, https:), scheme-relative URLs (//), and unknown paths.
 */
export function sanitizeTargetUrl(rawUrl?: string | null, fallback = '/client/dashboard'): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback
  }

  const trimmed = rawUrl.trim()

  // Prevent protocol or scheme-relative open redirects
  if (trimmed.startsWith('//') || trimmed.includes('://') || trimmed.startsWith('javascript:')) {
    return fallback
  }

  // Must start with /client/ and match allowlisted prefix
  const isAllowed = ALLOWED_ROUTE_PREFIXES.some(prefix => trimmed === prefix || trimmed.startsWith(prefix + '/') || trimmed.startsWith(prefix + '?'))
  if (!isAllowed) {
    return fallback
  }

  return trimmed
}

/**
 * Computes default target URL based on event type.
 */
export function resolveDefaultTargetUrl(event: NotificationEventType, data?: Record<string, any>): string {
  switch (event) {
    case 'missed_call_recovered':
      return '/client/inbox'
    case 'customer_reply':
      if (data?.conversationId) {
        return `/client/inbox?conversation=${encodeURIComponent(data.conversationId)}`
      }
      return '/client/inbox'
    case 'new_booking':
    case 'booking_cancelled':
    case 'booking_rescheduled':
      return '/client/calendar'
    case 'payment_received':
    case 'payment_failed':
    case 'invoice_overdue':
      return '/client/invoices'
    case 'review_received':
      return '/client/reviews'
    default:
      return '/client/dashboard'
  }
}
