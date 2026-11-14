import { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { isStopKeyword, isResumeKeyword } from './safety-rules.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { resolveOrganizationByPhoneNumber } from '../telephony/telnyx-numbers.ts'
import { handleInboundComplianceKeyword } from '../compliance/compliance-engine.ts'
import { notifyOwner } from '../notifications/notification-service.ts'
import {
  PLATFORM_TOLL_FREE_NUMBER,
  hasDedicatedPhoneNumber,
  resolvePlatformTollFreeNumber,
} from '../billing/plans.ts'

export interface InboundSmsPayload {
  fromPhone: string
  toPhone: string
  text: string
  telnyxMessageId?: string
  sendSmsFn?: typeof sendTelnyxSms
  webPushSendFn?: any
}

function parseTimestampMs(val: unknown): number {
  if (!val || typeof val !== 'string') return 0
  const parsed = Date.parse(val)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Resolves candidate organizations sharing the platform toll-free number (+18777713802)
 * that have recently communicated with `fromNumber`, ordered most recently active first.
 * Excludes organizations that already own an active dedicated DID.
 */
async function resolveSharedTollFreeInboundOrgs(
  supabase: SupabaseClient,
  fromNumber: string
): Promise<any[]> {
  const activityByOrg = new Map<string, number>()
  const contactIdsByOrg = new Map<string, string[]>()

  const bumpScore = (orgId: string | null | undefined, ts: unknown) => {
    if (!orgId) return
    const ms = parseTimestampMs(ts)
    const prev = activityByOrg.get(orgId) ?? -1
    if (ms > prev) {
      activityByOrg.set(orgId, ms)
    }
  }

  try {
    const contactRes = await supabase
      .from('contacts')
      .select('id, org_id, updated_at, created_at')
      .eq('phone', fromNumber)
    const contactRows = Array.isArray(contactRes?.data) ? contactRes.data : []

    for (const c of contactRows) {
      if (!c?.org_id) continue
      bumpScore(c.org_id, c.updated_at || c.created_at)
      if (c.id) {
        const list = contactIdsByOrg.get(c.org_id) || []
        list.push(c.id)
        contactIdsByOrg.set(c.org_id, list)
      }
    }
  } catch {
    // Defensive against minimal test mocks
  }

  try {
    const auditRes = await supabase
      .from('compliance_audit_logs')
      .select('org_id, action, created_at')
      .eq('phone', fromNumber)
    const auditRows = Array.isArray(auditRes?.data) ? auditRes.data : []

    for (const a of auditRows) {
      if (!a?.org_id) continue
      if (!a.action || a.action === 'message_sent' || a.action === 'opt_in') {
        bumpScore(a.org_id, a.created_at)
      }
    }
  } catch {
    // Defensive against minimal test mocks
  }

  const candidateOrgIds = Array.from(activityByOrg.keys())
  if (candidateOrgIds.length === 0) {
    return []
  }

  // Load candidate organizations safely across real Supabase and eq-only mocks
  let loadedOrgs: any[] = []
  try {
    const orgQuery: any = supabase.from('organizations').select('*')
    if (typeof orgQuery?.in === 'function') {
      const { data } = await orgQuery.in('id', candidateOrgIds)
      if (Array.isArray(data)) loadedOrgs = data
    } else if (typeof orgQuery?.eq === 'function') {
      const results = await Promise.all(
        candidateOrgIds.map((id) =>
          supabase.from('organizations').select('*').eq('id', id).maybeSingle()
        )
      )
      loadedOrgs = results.map((r: any) => r?.data).filter(Boolean)
    }
  } catch {
    return []
  }

  // Only route shared toll-free replies to orgs without an active dedicated DID
  const sharedOrgs = loadedOrgs.filter((org) => org?.id && !hasDedicatedPhoneNumber(org))
  if (sharedOrgs.length === 0) {
    return []
  }

  // Check conversations.last_message_at for shared org contacts to break ties accurately
  const sharedOrgIds = new Set(sharedOrgs.map((o) => o.id))
  const sharedContactIds: string[] = []
  for (const [oId, cIds] of contactIdsByOrg.entries()) {
    if (sharedOrgIds.has(oId)) {
      sharedContactIds.push(...cIds)
    }
  }

  if (sharedContactIds.length > 0) {
    try {
      const convQuery: any = supabase.from('conversations').select('org_id, contact_id, last_message_at, created_at')
      let convRows: any[] = []
      if (typeof convQuery?.in === 'function') {
        const { data } = await convQuery.in('contact_id', sharedContactIds)
        if (Array.isArray(data)) convRows = data
      } else if (typeof convQuery?.eq === 'function') {
        const results = await Promise.all(
          sharedContactIds.map((cid) =>
            supabase
              .from('conversations')
              .select('org_id, contact_id, last_message_at, created_at')
              .eq('contact_id', cid)
              .maybeSingle()
          )
        )
        convRows = results.map((r: any) => r?.data).filter(Boolean)
      }

      for (const conv of convRows) {
        if (conv?.org_id && sharedOrgIds.has(conv.org_id)) {
          bumpScore(conv.org_id, conv.last_message_at || conv.created_at)
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return sharedOrgs.sort((a, b) => (activityByOrg.get(b.id) ?? 0) - (activityByOrg.get(a.id) ?? 0))
}

export function extractCustomerDetailsFromText(text: string): {
  extractedName?: string
  extractedAddress?: string
} {
  const result: { extractedName?: string; extractedAddress?: string } = {}
  if (!text || typeof text !== 'string') return result

  // Name heuristic: "my name is [Name]", "this is [Name]", "i'm [Name]", "name: [Name]"
  const introMatch = text.match(/(?:my name is|this is|i'm|im|name\s*[:\-])\s+([^,.\n!?]+)/i)
  if (introMatch && introMatch[1]) {
    const rawWords = introMatch[1].trim().split(/\s+/)
    const nameWords: string[] = []
    const stopWords = new Set([
      'and', 'at', 'from', 'with', 'for', 'my', 'our', 'the', 'we', 'i', 'im',
      'is', 'in', 'address', 'need', 'needs', 'needed', 'please', 'call', 'text',
      'a', 'an', 'to', 'here', 'there', 'having', 'got', 'have'
    ])
    for (const w of rawWords) {
      const cleanWord = w.replace(/[^A-Za-z'-]/g, '')
      if (!cleanWord || stopWords.has(cleanWord.toLowerCase())) break
      nameWords.push(cleanWord)
      if (nameWords.length >= 3) break
    }
    if (nameWords.length > 0) {
      const candidate = nameWords.join(' ')
      const lower = candidate.toLowerCase()
      if (!['urgent', 'broken', 'important', 'leaking', 'help', 'bad', 'good', 'needed', 'fine'].includes(lower)) {
        result.extractedName = candidate
      }
    }
  }

  // Address heuristic:
  // 1) Explicit prefix: "address is [Address]", "address: [Address]"
  const explicitAddressMatch = text.match(/(?:(?:my|our)?\s*address\s*(?:is|:)\s*)([^.\n!?]+)/i)
  if (explicitAddressMatch && explicitAddressMatch[1]) {
    let cleanAddress = explicitAddressMatch[1].trim()
    const clauseBreak = cleanAddress.search(/\s+(?:and\s+(?:our|my|the|we|it)|our\s+|my\s+|we\s+|need\s+|please\s+)/i)
    if (clauseBreak !== -1) {
      cleanAddress = cleanAddress.slice(0, clauseBreak).trim()
    }
    result.extractedAddress = cleanAddress.replace(/[,;]+$/, '').trim()
  } else {
    // 2) Location preposition: "at [123 Main St...]"
    const prepositionMatch = text.match(/(?:at\s+)(\d+[A-Za-z0-9\s.,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Circle|Cir|Square|Sq)\b[^\n.!?]*)/i)
    if (prepositionMatch && prepositionMatch[1]) {
      let cleanAddress = prepositionMatch[1].trim()
      const clauseBreak = cleanAddress.search(/\s+(?:and\s+(?:our|my|the|we|it)|our\s+|my\s+|we\s+|need\s+|please\s+)/i)
      if (clauseBreak !== -1) {
        cleanAddress = cleanAddress.slice(0, clauseBreak).trim()
      }
      result.extractedAddress = cleanAddress.replace(/[,;]+$/, '').trim()
    }
  }

  return result
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

  const platformTollFree = resolvePlatformTollFreeNumber()
  const isPlatformTollFree = toNumber === platformTollFree || toNumber === PLATFORM_TOLL_FREE_NUMBER

  // 1. Locate target organization:
  // - Dedicated DIDs route strictly 1:1 via resolveOrganizationByPhoneNumber.
  // - Shared platform toll-free (+18777713802) correlates recent shared-number tenant interactions first,
  //   falling back to resolveOrganizationByPhoneNumber (Demo org) when no client thread exists.
  let sharedCandidateOrgs: any[] = []
  let org: any = null

  if (isPlatformTollFree) {
    sharedCandidateOrgs = await resolveSharedTollFreeInboundOrgs(supabase, fromNumber)
    if (sharedCandidateOrgs.length > 0) {
      org = sharedCandidateOrgs[0]
    }
  }

  if (!org) {
    const resolution = await resolveOrganizationByPhoneNumber(supabase, toNumber)
    if (!resolution || !resolution.org) {
      return { success: false, action: 'org_not_found' }
    }
    org = resolution.org
  }

  // 2. Locate or create contact
  let { data: contact } = await supabase
    .from('contacts')
    .select('id, name, address, opt_out')
    .eq('org_id', org.id)
    .eq('phone', fromNumber)
    .maybeSingle()

  if (!contact) {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ org_id: org.id, phone: fromNumber, name: 'Caller' })
      .select('id, name, address, opt_out')
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
    // Propagate STOP/START opt-state across all shared-number trial orgs for this recipient
    // while sending only the single carrier confirmation reply above.
    if (
      isPlatformTollFree &&
      sharedCandidateOrgs.length > 1 &&
      (compliance.action === 'opt_out_processed' || compliance.action === 'opt_in_processed')
    ) {
      for (const secondaryOrg of sharedCandidateOrgs.slice(1)) {
        await handleInboundComplianceKeyword(supabase, {
          org: secondaryOrg,
          fromPhone: fromNumber,
          toPhone: toNumber,
          text: sms.text,
          suppressReply: true,
        }).catch((err) => console.warn('[SHARED_TOLL_FREE_COMPLIANCE_PROPAGATION_WARNING]', err))
      }
    }
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
    const { data: newConv, error: convInsertError } = await supabase
      .from('conversations')
      .insert({
        org_id: org.id,
        contact_id: contact?.id,
        status: 'open',
        last_message_preview: sms.text,
        last_message_at: nowIso,
        unread_count: 1
      })
      .select('id, unread_count')
      .single()

    if (convInsertError) {
      console.error('[INBOUND_SMS_CONV_INSERT_ERROR]', convInsertError.message || convInsertError)
    }
    conversation = newConv
  } else {
    const { error: convUpdateError } = await supabase
      .from('conversations')
      .update({
        status: 'open',
        last_message_preview: sms.text,
        last_message_at: nowIso,
        unread_count: (conversation.unread_count || 0) + 1
      })
      .eq('id', conversation.id)

    if (convUpdateError) {
      console.warn('[INBOUND_SMS_CONV_UPDATE_ERROR]', convUpdateError.message || convUpdateError)
    }
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

  // 6. Inbound Customer Reply: Extract details, update contact & transition lead to 'contacted'
  if (contact?.id) {
    const extracted = extractCustomerDetailsFromText(sms.text)
    const contactUpdates: Record<string, any> = { updated_at: nowIso }
    const isGenericName = !contact.name || contact.name === 'Caller' || contact.name === 'New Caller'

    if (extracted.extractedName && isGenericName) {
      contactUpdates.name = extracted.extractedName
      contact.name = extracted.extractedName
    }
    if (extracted.extractedAddress && !contact.address) {
      contactUpdates.address = extracted.extractedAddress
      contact.address = extracted.extractedAddress
    }

    if (Object.keys(contactUpdates).length > 1) {
      try {
        await supabase
          .from('contacts')
          .update(contactUpdates)
          .eq('id', contact.id)
      } catch (err) {
        console.warn('[INBOUND_CONTACT_UPDATE_WARNING]', err)
      }
    }

    await supabase
      .from('leads')
      .update({
        status: 'contacted',
        notes: sms.text,
        updated_at: nowIso
      })
      .eq('org_id', org.id)
      .eq('contact_id', contact.id)
      .eq('status', 'new')
  }

  // 7. Dispatch Owner Notification for Inbound Customer Reply (Push + SMS)
  try {
    const contactName = contact?.name && contact.name !== 'Caller' ? contact.name : 'Customer'
    await notifyOwner(supabase, {
      event: 'customer_reply',
      organizationId: org.id,
      idempotencyKey: sms.telnyxMessageId ? `customer_reply:${sms.telnyxMessageId}` : undefined,
      data: {
        customerName: contactName,
        customerPhone: fromNumber,
        replyPreview: sms.text,
        conversationId: conversation?.id,
        targetUrl: conversation?.id ? `/client/inbox?conversation=${encodeURIComponent(conversation.id)}` : '/client/inbox'
      },
      sendSmsFn: sms.sendSmsFn,
      webPushSendFn: sms.webPushSendFn
    })
  } catch (notifErr) {
    console.warn('[CUSTOMER REPLY NOTIFICATION ERROR]', notifErr)
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

