import type { SupabaseClient } from '@supabase/supabase-js'

export interface LogOutboundMessageInput {
  orgId: string
  contactId?: string | null
  phone?: string | null
  body: string
  deliveryStatus: 'sent' | 'failed' | 'delivered' | string
  telnyxMessageId?: string | null
  automationSource: string
  failureReason?: string | null
  direction?: 'outbound' | 'inbound'
  senderType?: 'system' | 'owner' | 'customer'
  incrementUnread?: boolean
}

export interface LogOutboundMessageResult {
  conversationId: string | null
  messageLogged: boolean
}

/**
 * Ensures an inbox conversation exists for (orgId, contactId), updates conversation
 * preview/timestamp/unread metadata, and inserts the message row with explicit error logging.
 */
export async function logOutboundConversationMessage(
  supabase: SupabaseClient,
  input: LogOutboundMessageInput
): Promise<LogOutboundMessageResult> {
  const {
    orgId,
    contactId,
    phone,
    body,
    deliveryStatus,
    telnyxMessageId = null,
    automationSource,
    failureReason = null,
    direction = 'outbound',
    senderType = 'system',
    incrementUnread = false,
  } = input

  let resolvedContactId = contactId
  if (!resolvedContactId && phone && orgId) {
    try {
      const cleanPhone = phone.replace(/[^\d+]/g, '')
      let contactQuery: any = supabase
        .from('contacts')
        .select('id')
        .eq('org_id', orgId)

      if (typeof contactQuery?.or === 'function') {
        contactQuery = contactQuery.or(`phone.eq.${cleanPhone},phone.eq.${phone}`)
      } else {
        contactQuery = contactQuery.eq('phone', cleanPhone)
      }

      const { data: matchedContact } = await contactQuery.limit(1).maybeSingle()
      if (matchedContact?.id) {
        resolvedContactId = matchedContact.id
      }
    } catch {
      // Non-blocking lookup
    }
  }

  if (!orgId || !resolvedContactId) {
    return { conversationId: null, messageLogged: false }
  }

  const nowIso = new Date().toISOString()

  let conversation: { id: string; unread_count?: number | null } | null = null
  const { data: existingConv, error: lookupError } = await supabase
    .from('conversations')
    .select('id, unread_count')
    .eq('org_id', orgId)
    .eq('contact_id', resolvedContactId)
    .maybeSingle()

  if (lookupError) {
    console.warn('[CONVERSATION_LOGGER] Conversation lookup failed:', lookupError.message || lookupError)
  } else {
    conversation = existingConv || null
  }

  if (!conversation) {
    const { data: newConv, error: insertConvErr } = await supabase
      .from('conversations')
      .insert({
        org_id: orgId,
        contact_id: resolvedContactId,
        status: 'open',
        last_message_at: nowIso,
        last_message_preview: body,
        unread_count: incrementUnread ? 1 : 0,
      })
      .select('id')
      .single()

    if (insertConvErr) {
      console.error('[CONVERSATION_LOGGER] Failed to create conversation:', insertConvErr.message || insertConvErr)
    } else {
      conversation = newConv || null
    }
  } else {
    const nextUnreadCount = incrementUnread
      ? Number(conversation.unread_count || 0) + 1
      : Number(conversation.unread_count || 0)

    const { error: updateConvErr } = await supabase
      .from('conversations')
      .update({
        status: 'open',
        last_message_at: nowIso,
        last_message_preview: body,
        unread_count: nextUnreadCount,
      })
      .eq('id', conversation.id)

    if (updateConvErr) {
      console.warn('[CONVERSATION_LOGGER] Failed to update conversation metadata:', updateConvErr.message || updateConvErr)
    }
  }

  if (!conversation?.id) {
    return { conversationId: null, messageLogged: false }
  }

  const { error: msgErr } = await supabase.from('messages').insert({
    org_id: orgId,
    conversation_id: conversation.id,
    direction,
    sender_type: senderType,
    body,
    delivery_status: deliveryStatus,
    telnyx_message_id: telnyxMessageId,
    automation_source: automationSource,
    failure_reason: failureReason,
  })

  if (msgErr) {
    console.error('[CONVERSATION_LOGGER] Failed to insert message:', msgErr.message || msgErr)
    return { conversationId: conversation.id, messageLogged: false }
  }

  return { conversationId: conversation.id, messageLogged: true }
}
