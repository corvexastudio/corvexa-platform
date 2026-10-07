import type { SupabaseClient } from '@supabase/supabase-js'
import {
  verifyOutboundCompliance,
  logComplianceAudit,
  isPhoneSuppressed
} from '../compliance/compliance-engine.ts'
import {
  isWithinBusinessHours,
  isTcpaQuietHours
} from './safety-rules.ts'
import {
  sendTelnyxSms
} from '../telnyx.ts'
import {
  fetchConversationMessagesPaginated,
  type PaginatedMessagesResult
} from './sms-handler.ts'

export interface SendMessageOptions {
  supabase: SupabaseClient
  orgId: string
  toPhone: string
  text: string
  contactId?: string
  messageType?: 'transactional' | 'marketing'
  flowType?: string
  timezone?: string
}

/**
 * MessagingService
 * 
 * Domain service managing all customer SMS communications, TCPA quiet hours,
 * opt-out compliance, audit logging, and message thread pagination.
 */
export class MessagingService {
  /**
   * Verifies TCPA, quiet hours, and opt-out compliance prior to SMS delivery.
   */
  static async verifyCompliance(
    supabase: SupabaseClient,
    options: {
      orgId: string
      toPhone: string
      body: string
      messageType?: 'transactional' | 'marketing'
      flowType?: string
      contactId?: string
      timezone?: string
    }
  ) {
    return verifyOutboundCompliance(supabase, {
      orgId: options.orgId,
      toPhone: options.toPhone,
      body: options.body,
      messageType: options.messageType || 'transactional',
      flowType: options.flowType || 'manual_outbound',
      contactId: options.contactId,
      timezone: options.timezone
    })
  }

  /**
   * Dispatches an outbound SMS with strict compliance enforcement.
   */
  static async sendCompliantSms(options: SendMessageOptions): Promise<{
    sent: boolean
    reason?: string
    compliance?: any
  }> {
    const {
      supabase,
      orgId,
      toPhone,
      text,
      contactId,
      messageType = 'transactional',
      flowType = 'outbound_dispatch',
      timezone
    } = options

    const compliance = await verifyOutboundCompliance(supabase, {
      orgId,
      toPhone,
      body: text,
      messageType,
      flowType,
      contactId,
      timezone
    })

    if (!compliance.allowed) {
      return {
        sent: false,
        reason: compliance.suppressionReason || 'Blocked by compliance filter',
        compliance
      }
    }

    await sendTelnyxSms({
      to: toPhone,
      text: compliance.formattedText || text
    })

    await logComplianceAudit(supabase, {
      orgId,
      phone: toPhone,
      contactId,
      action: 'message_sent',
      messageType,
      reason: flowType
    })

    return {
      sent: true,
      compliance
    }
  }

  /**
   * Retrieves conversation message history with cursor-based pagination.
   */
  static async fetchMessagesPaginated(
    supabase: SupabaseClient,
    options: {
      conversationId: string
      limit?: number
      beforeCursor?: string | null
      afterCursor?: string | null
    }
  ): Promise<PaginatedMessagesResult> {
    return fetchConversationMessagesPaginated(supabase, options)
  }

  /**
   * Alias for fetchMessagesPaginated.
   */
  static async fetchConversationHistory(
    supabase: SupabaseClient,
    options: {
      conversationId: string
      limit?: number
      beforeCursor?: string | null
      afterCursor?: string | null
    }
  ): Promise<PaginatedMessagesResult> {
    return this.fetchMessagesPaginated(supabase, options)
  }

  /**
   * Formats standard opt-out footer for outbound compliance.
   */
  static formatOptOutFooter(): string {
    return 'Reply STOP to cancel'
  }

  /**
   * Checks whether a phone number has opted out of automated communications.
   */
  static async isOptedOut(
    supabase: SupabaseClient,
    orgId: string,
    phone: string
  ): Promise<boolean> {
    const res = await isPhoneSuppressed(supabase, orgId, phone)
    return res.suppressed
  }

  /**
   * Evaluates whether current timestamp is within business hours for timezone.
   */
  static isBusinessHours(
    businessHours?: Record<string, { open: string; close: string; closed: boolean }>,
    timezone: string = 'America/Chicago'
  ): boolean {
    return isWithinBusinessHours(businessHours, timezone)
  }

  /**
   * Evaluates whether current timestamp is within TCPA quiet hours (9pm - 8am).
   */
  static isQuietHours(timezone?: string): boolean {
    return isTcpaQuietHours(timezone)
  }

  /**
   * Alias for isQuietHours.
   */
  static checkQuietHours(timezone?: string): boolean {
    return this.isQuietHours(timezone)
  }
}
