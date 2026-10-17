/**
 * Centralized Notification Platform - Orchestrator Engine
 * Dispatches multi-channel notifications (Push, SMS, In-App) for business events
 * with strict tenant isolation, idempotency, failure isolation, and rate-limiting.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  NotifyOwnerParams,
  NotifyOwnerResult,
  ChannelDeliveryOutcome,
  PushNotificationPayload
} from './notification-types.ts'
import {
  isKnownEvent,
  getEventPolicy,
  sanitizeTargetUrl,
  resolveDefaultTargetUrl
} from './notification-policy.ts'
import { sendWebPushNotification } from './push/web-push-service.ts'
import {
  notifyOwnerOfMissedCall,
  resolveOwnerPhone,
  buildOwnerMissedCallAlertText
} from '../telephony/owner-notifier.ts'
import { sendTelnyxSms } from '../telnyx.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { checkRateLimitAsync } from '../security/rate-limiter.ts'
import { logAuditEvent } from '../security/audit-logger.ts'

/**
 * Reusable notification engine entrypoint.
 * Business logic calls this method instead of coupling directly to Web Push, Telnyx, or database delivery details.
 */
export async function notifyOwner(
  supabase: SupabaseClient,
  params: NotifyOwnerParams
): Promise<NotifyOwnerResult> {
  const { event, organizationId, idempotencyKey, data } = params

  // 1. Validate controlled event catalog
  if (!isKnownEvent(event)) {
    return {
      attempted: false,
      event,
      deliveries: [],
      error: `Unknown event type: ${event}`
    }
  }

  // 2. Validate tenant organization ID
  if (!organizationId) {
    return {
      attempted: false,
      event,
      deliveries: [],
      error: 'Missing organization ID'
    }
  }

  const policy = getEventPolicy(event)
  if (!policy) {
    return {
      attempted: false,
      event,
      deliveries: [],
      error: `Policy not found for event: ${event}`
    }
  }

  try {
    // 3. Idempotency Check: Prevent duplicate notifications for identical business events
    if (idempotencyKey && typeof supabase?.from === 'function') {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('org_id', organizationId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existing) {
        return {
          attempted: false,
          notificationId: existing.id,
          event,
          deliveries: [],
          skippedReason: 'already_processed'
        }
      }
    }

    // 4. Rate Limiting: Prevent automated spam storms per organization
    const rateLimit = await checkRateLimitAsync(`notif:org:${organizationId}`, {
      max: 60,
      windowMs: 60 * 1000
    })

    if (!rateLimit.allowed) {
      return {
        attempted: false,
        event,
        deliveries: [],
        skippedReason: 'rate_limited',
        error: 'Notification rate limit exceeded'
      }
    }

    // 5. Retrieve organization details server-side
    let org: any = null
    if (typeof supabase?.from === 'function') {
      const { data: orgLookup } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .maybeSingle()
      org = orgLookup
    }

    // 6. Build Title, Body, Target URL, and SMS Copy
    const targetUrl = sanitizeTargetUrl(
      data.targetUrl || resolveDefaultTargetUrl(event, data)
    )

    let notificationTitle = data.title || ''
    let notificationBody = data.body || ''
    let smsCopy = ''

    const customerName = data.customerName || 'Customer'

    switch (event) {
      case 'missed_call_recovered': {
        notificationTitle = notificationTitle || 'Missed Call Recovered'
        notificationBody =
          notificationBody ||
          buildOwnerMissedCallAlertText({
            callerPhone: data.callerPhone,
            customerSmsSuccess: data.customerSmsSuccess ?? true,
            businessName: org?.name
          })
        smsCopy = notificationBody
        break
      }
      case 'customer_reply': {
        notificationTitle = notificationTitle || 'New Customer Reply'
        notificationBody =
          notificationBody ||
          (data.replyPreview
            ? `${customerName}: ${data.replyPreview.slice(0, 100)}`
            : `New reply from ${customerName}. Open your inbox to respond.`)
        smsCopy = `CaptoDesk: New reply from ${customerName}. Open your inbox to respond: ${targetUrl}`
        break
      }
      case 'new_booking': {
        const isInstant = data.isInstant ?? true
        const serviceName = data.serviceName || 'Service'
        const bookingTime = data.bookingTime || 'Upcoming'
        notificationTitle =
          notificationTitle || (isInstant ? 'New Appointment Booked' : 'New Booking Request')
        notificationBody =
          notificationBody || `${customerName} booked ${serviceName} for ${bookingTime}.`
        smsCopy = `CaptoDesk: New booking: ${customerName} booked ${serviceName} for ${bookingTime}.`
        break
      }
      default: {
        notificationTitle = notificationTitle || event.replace(/_/g, ' ')
        notificationBody = notificationBody || `Update for ${org?.name || 'your business'}`
        smsCopy = `CaptoDesk: ${notificationTitle} - ${notificationBody}`
      }
    }

    // 7. Insert In-App Notification (Durable primary record)
    let notificationId: string | undefined
    if (typeof supabase?.from === 'function') {
      const { data: insertRow, error: insertErr } = await supabase
        .from('notifications')
        .insert({
          org_id: organizationId,
          title: notificationTitle,
          message: notificationBody,
          link: targetUrl,
          event_type: event,
          priority: policy.priority,
          idempotency_key: idempotencyKey || null
        })
        .select('id')
        .maybeSingle()

      if (insertErr) {
        // If unique constraint violation occurred concurrently, treat as duplicate
        if (
          insertErr.code === '23505' ||
          insertErr.message?.toLowerCase().includes('unique') ||
          insertErr.message?.toLowerCase().includes('duplicate')
        ) {
          return {
            attempted: false,
            event,
            deliveries: [],
            skippedReason: 'already_processed'
          }
        }
        console.warn('[NOTIFICATION SERVICE] Failed to insert in-app notification:', insertErr.message)
      } else if (insertRow?.id) {
        notificationId = insertRow.id
      }
    }

    const deliveries: ChannelDeliveryOutcome[] = []
    const nowIso = new Date().toISOString()

    // Record in-app delivery
    deliveries.push({
      channel: 'in_app',
      success: true,
      destination: 'inbox'
    })

    if (notificationId && typeof supabase?.from === 'function') {
      try {
        await supabase.from('notification_deliveries').insert({
          org_id: organizationId,
          notification_id: notificationId,
          channel: 'in_app',
          destination: 'inbox',
          status: 'sent',
          attempts: 1,
          sent_at: nowIso
        })
      } catch {
        // Non-blocking delivery logging
      }
    }

    // 8. Push Delivery (if policy includes 'push')
    if (policy.channels.includes('push')) {
      let pushSubs: any[] = []
      if (typeof supabase?.from === 'function') {
        const { data: activeSubs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('org_id', organizationId)
          .eq('is_active', true)
        pushSubs = activeSubs || []
      }

      if (pushSubs.length === 0) {
        deliveries.push({
          channel: 'push',
          success: false,
          skippedReason: 'no_active_subscriptions'
        })
      } else {
        const pushPayload: PushNotificationPayload = {
          notificationId: notificationId || 'temp_' + Date.now(),
          event,
          title: notificationTitle,
          body: notificationBody,
          url: targetUrl,
          timestamp: nowIso
        }

        const pushPromises = pushSubs.map(async sub => {
          try {
            const sendFn = params.webPushSendFn || ((s, p) => sendWebPushNotification(supabase, s, p))
            const pushRes = await sendFn(sub, pushPayload)

            if (notificationId && typeof supabase?.from === 'function') {
              try {
                await supabase.from('notification_deliveries').insert({
                  org_id: organizationId,
                  notification_id: notificationId,
                  channel: 'push',
                  destination: sub.endpoint,
                  status: pushRes.success ? 'sent' : 'failed',
                  attempts: 1,
                  last_error: pushRes.error || null,
                  sent_at: pushRes.success ? nowIso : null
                })
              } catch {
                // Non-blocking delivery logging
              }
            }

            return {
              channel: 'push' as const,
              success: pushRes.success,
              destination: sub.endpoint,
              error: pushRes.error
            }
          } catch (err: any) {
            return {
              channel: 'push' as const,
              success: false,
              destination: sub.endpoint,
              error: err?.message || 'Push dispatch failed'
            }
          }
        })

        const pushResults = await Promise.all(pushPromises)
        deliveries.push(...pushResults)
      }
    }

    // 9. SMS Delivery (if policy includes 'sms')
    if (policy.channels.includes('sms')) {
      if (event === 'missed_call_recovered') {
        // Reuse battle-tested owner alert implementation from owner-notifier.ts
        const smsOutcome = await notifyOwnerOfMissedCall(supabase, {
          org,
          callerPhone: data.callerPhone || '',
          calledPhone: data.calledPhone || org?.telnyx_phone_number || '',
          customerSmsSuccess: data.customerSmsSuccess ?? true,
          callId: data.callId,
          sendSmsFn: params.sendSmsFn,
          skipInApp: true
        })

        const smsDelivery: ChannelDeliveryOutcome = {
          channel: 'sms',
          success: smsOutcome.sent,
          destination: smsOutcome.ownerPhone,
          providerMessageId: smsOutcome.messageId,
          error: smsOutcome.error,
          skippedReason: smsOutcome.skippedReason,
          text: smsOutcome.text
        }
        deliveries.push(smsDelivery)

        if (notificationId && typeof supabase?.from === 'function') {
          try {
            await supabase.from('notification_deliveries').insert({
              org_id: organizationId,
              notification_id: notificationId,
              channel: 'sms',
              destination: smsOutcome.ownerPhone || 'unresolved',
              status: smsOutcome.sent ? 'sent' : (smsOutcome.skippedReason ? 'skipped' : 'failed'),
              attempts: smsOutcome.attempted ? 1 : 0,
              provider_message_id: smsOutcome.messageId || null,
              last_error: smsOutcome.error || smsOutcome.skippedReason || null,
              sent_at: smsOutcome.sent ? nowIso : null
            })
          } catch {
            // Non-blocking
          }
        }
      } else {
        // Direct critical SMS alert for other events (customer_reply, new_booking, etc.)
        const ownerRes = await resolveOwnerPhone(supabase, org)
        if (!ownerRes.phone) {
          deliveries.push({
            channel: 'sms',
            success: false,
            skippedReason: 'no_owner_phone'
          })
        } else {
          const ownerPhone = ownerRes.phone
          const senderNorm = org?.telnyx_phone_number ? normalizePhoneToE164(org.telnyx_phone_number) : null

          if (!senderNorm?.isValid || !senderNorm.e164 || senderNorm.e164.startsWith('+1999')) {
            deliveries.push({
              channel: 'sms',
              success: false,
              destination: ownerPhone,
              skippedReason: 'invalid_sender_phone'
            })
          } else {
            const senderPhone = senderNorm.e164
            const smsRateLimit = await checkRateLimitAsync(`sms:owner_alert:${organizationId}`, {
              max: 10,
              windowMs: 60 * 1000
            })

            if (!smsRateLimit.allowed) {
              deliveries.push({
                channel: 'sms',
                success: false,
                destination: ownerPhone,
                skippedReason: 'rate_limited',
                error: 'Owner SMS alert rate limit exceeded'
              })
            } else {
              const sendSms = params.sendSmsFn || sendTelnyxSms
              try {
                const smsRes = await sendSms({
                  to: ownerPhone,
                  from: senderPhone,
                  text: smsCopy
                })

                deliveries.push({
                  channel: 'sms',
                  success: smsRes.success,
                  destination: ownerPhone,
                  providerMessageId: smsRes.messageId,
                  error: smsRes.error
                })

                if (notificationId && typeof supabase?.from === 'function') {
                  try {
                    await supabase.from('notification_deliveries').insert({
                      org_id: organizationId,
                      notification_id: notificationId,
                      channel: 'sms',
                      destination: ownerPhone,
                      status: smsRes.success ? 'sent' : 'failed',
                      attempts: 1,
                      provider_message_id: smsRes.messageId || null,
                      last_error: smsRes.error || null,
                      sent_at: smsRes.success ? nowIso : null
                    })
                  } catch {
                    // Non-blocking
                  }
                }

                if (smsRes.success) {
                  try {
                    await logAuditEvent(supabase, {
                      org_id: organizationId,
                      event_type: 'notification.dispatched',
                      description: `Owner alert for ${event} sent to ${ownerPhone}`,
                      metadata: {
                        event,
                        owner_phone: ownerPhone,
                        sender_did: senderPhone,
                        telnyx_message_id: smsRes.messageId
                      }
                    })
                  } catch {
                    // Non-blocking
                  }
                }
              } catch (smsErr: any) {
                deliveries.push({
                  channel: 'sms',
                  success: false,
                  destination: ownerPhone,
                  error: smsErr?.message || 'Failed to dispatch owner SMS'
                })
              }
            }
          }
        }
      }
    }

    return {
      attempted: true,
      notificationId,
      event,
      deliveries
    }
  } catch (err: any) {
    console.error('[NOTIFICATION SERVICE ERROR]', err)
    return {
      attempted: true,
      event,
      deliveries: [],
      error: err?.message || 'Unexpected failure in notification engine'
    }
  }
}
