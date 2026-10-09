import { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { isStopKeyword, isResumeKeyword } from './safety-rules.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { resolveOrganizationByPhoneNumber } from '../telephony/telnyx-numbers.ts'
import { handleInboundComplianceKeyword } from '../compliance/compliance-engine.ts'

interface InboundSmsPayload {
  fromPhone: string
  toPhone: string
  text: string
  telnyxMessageId?: string
}

export async function processInboundSms(
  supabase: SupabaseClient,
  sms: InboundSmsPayload
): Promise<{ success: boolean; action: string }> {
  const normFrom = normalizePhoneToE164(sms.fromPhone)
  const normTo = normalizePhoneToE164(sms.toPhone)

  if (!normFrom.isValid || !normFrom.e164 || !normTo.isValid || !normTo.e164) {
    return { success: false, action: 'invalid_phone_format' }
  }

  const fromNumber = normFrom.e164
  const toNumber = normTo.e164

  // 1. Locate organization via multi-tenant number repository
  const resolution = await resolveOrganizationByPhoneNumber(supabase, toNumber)
  if (!resolution || !resolution.org) {
    return { success: false, action: 'org_not_found' }
  }

  const org = resolution.org

  // 2. Locate or create contact
  let { data: contact } = await supabase
    .from('contacts')
    .select('id, opt_out')
    .eq('org_id', org.id)
    .eq('phone', fromNumber)
    .maybeSingle()

  if (!contact) {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ org_id: org.id, phone: fromNumber, name: 'Caller' })
      .select('id, opt_out')
      .single()
    contact = newContact
  }

  // 3. Handle Inbound Carrier Compliance Keywords (STOP, UNSUBSCRIBE, CANCEL, END, QUIT, START, UNSTOP, YES, HELP, INFO)
  const compliance = await handleInboundComplianceKeyword(supabase, {
    org,
    fromPhone: fromNumber,
    toPhone: toNumber,
    text: sms.text
  })

  if (compliance.handled) {
    return { success: true, action: compliance.action || 'compliance_keyword_processed' }
  }

  // 4. Semantic deduplication: Guard against duplicate delivery of identical telnyxMessageId
  if (sms.telnyxMessageId) {
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('org_id', org.id)
      .eq('telnyx_message_id', sms.telnyxMessageId)
      .maybeSingle()

    if (existingMsg) {
      return { success: true, action: 'message_already_stored' }
    }
  }

  // 5. Append to conversation and messages
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, unread_count')
    .eq('org_id', org.id)
    .eq('contact_id', contact?.id)
    .maybeSingle()

  const nowIso = new Date().toISOString()

  if (!conversation) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        org_id: org.id,
        contact_id: contact?.id,
        last_message_preview: sms.text,
        last_message_at: nowIso,
        unread_count: 1
      })
      .select('id, unread_count')
      .single()
    conversation = newConv
  } else {
    await supabase
      .from('conversations')
      .update({
        last_message_preview: sms.text,
        last_message_at: nowIso,
        unread_count: (conversation.unread_count || 0) + 1
      })
      .eq('id', conversation.id)
  }

  if (conversation) {
    const { error: msgInsertError } = await supabase.from('messages').insert({
      org_id: org.id,
      conversation_id: conversation.id,
      direction: 'inbound',
      sender_type: 'customer',
      body: sms.text,
      delivery_status: 'received',
      telnyx_message_id: sms.telnyxMessageId
    })

    if (msgInsertError) {
      if (
        msgInsertError.code === '23505' ||
        msgInsertError.message?.toLowerCase().includes('unique') ||
        msgInsertError.message?.toLowerCase().includes('duplicate')
      ) {
        return { success: true, action: 'message_already_stored' }
      }
      throw new Error(`Failed to store message: ${msgInsertError.message}`)
    }
  }

  // 6. Inbound Customer Reply: Transition any open lead for this contact from 'new' to 'contacted'
  if (contact?.id) {
    await supabase
      .from('leads')
      .update({
        status: 'contacted',
        updated_at: nowIso
      })
      .eq('org_id', org.id)
      .eq('contact_id', contact.id)
      .eq('status', 'new')
  }

  return { success: true, action: 'message_stored' }
}

export interface PaginatedMessagesResult {
  messages: any[]
  hasMore: boolean
  oldestCursor: string | null
  newestCursor: string | null
  count: number
}

/**
 * Cursor-paginated message retrieval.
 * Fetches up to `limit` (default 50) messages ordered chronologically.
 * Supports `beforeCursor` to paginate backwards in time ("Load older messages").
 */
export async function fetchConversationMessagesPaginated(
  supabase: SupabaseClient,
  options: {
    conversationId: string
    limit?: number
    beforeCursor?: string | null
    afterCursor?: string | null
  }
): Promise<PaginatedMessagesResult> {
  const limit = Math.min(Math.max(options.limit || 50, 1), 100)

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', options.conversationId)

  if (options.beforeCursor) {
    query = query.lt('created_at', options.beforeCursor)
  }

  if (options.afterCursor) {
    query = query.gt('created_at', options.afterCursor)
  }

  // Order descending to get the most recent slice up to limit + 1
  query = query.order('created_at', { ascending: false }).limit(limit + 1)

  const { data, error } = await query

  if (error || !data) {
    return {
      messages: [],
      hasMore: false,
      oldestCursor: null,
      newestCursor: null,
      count: 0
    }
  }

  const hasMore = data.length > limit
  const batch = hasMore ? data.slice(0, limit) : data

  // Reverse so display order is chronological (oldest to newest)
  const chronological = [...batch].reverse()

  const oldestCursor = chronological.length > 0 ? chronological[0].created_at : null
  const newestCursor = chronological.length > 0 ? chronological[chronological.length - 1].created_at : null

  return {
    messages: chronological,
    hasMore,
    oldestCursor,
    newestCursor,
    count: chronological.length
  }
}

