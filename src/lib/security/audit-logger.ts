import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditEventType =
  | 'security.login'
  | 'security.auth_callback'
  | 'security.access_denied'
  | 'security.privilege_escalation_attempt'
  | 'user.profile_updated'
  | 'team.invite_sent'
  | 'team.invite_created_email_pending'
  | 'team.invite_failed'
  | 'team.member_removed'
  | 'sms.outbound_dispatched'
  | 'sms.inbound_received'
  | 'sms.opt_out'
  | 'telephony.test_sms_sent'
  | 'automation.settings_updated'
  | 'automation.run_retried'
  | 'billing.status_toggled'
  | 'admin.action_performed'
  | 'call.missed_recovered'
  | 'call.answered_logged'


export interface AuditLogPayload {
  org_id?: string | null
  event_type: AuditEventType
  description: string
  metadata?: Record<string, any>
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'service_role_key',
  'access_token',
  'refresh_token',
  'credit_card',
  'cvv'
])

/**
 * Deeply scrubs sensitive keys and values from logging metadata
 */
export function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item))
  }

  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('password')) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Persists a security audit log event to activity_logs table and emits structured stdout
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  payload: AuditLogPayload
): Promise<void> {
  const sanitizedMetadata = redactSensitiveData(payload.metadata || {})
  const timestamp = new Date().toISOString()

  console.log(`[AUDIT LOG ${timestamp}] [${payload.event_type}] org=${payload.org_id || 'global'} | ${payload.description}`)

  if (!payload.org_id) {
    // If event is platform-level without an org_id, it is logged to stdout
    return
  }

  try {
    const { error } = await supabase.from('activity_logs').insert({
      org_id: payload.org_id,
      event_type: payload.event_type,
      description: payload.description,
      metadata: {
        ...sanitizedMetadata,
        logged_at: timestamp
      }
    })

    if (error) {
      console.error('[AUDIT LOG INSERT ERROR]', error.message)
    }
  } catch (err: any) {
    console.error('[AUDIT LOG EXCEPTION]', err?.message || err)
  }
}
