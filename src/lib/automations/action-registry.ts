import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { renderTemplate } from '../telephony/template-engine.ts'
import { dispatchReviewRequest } from '../reviews/review-manager.ts'
import { verifyOutboundCompliance, logComplianceAudit } from '../compliance/compliance-engine.ts'

export type ActionType =
  | 'send_sms'
  | 'send_email'
  | 'create_task'
  | 'create_notification'
  | 'change_status'
  | 'add_tag'
  // Extensible future actions:
  | 'create_booking'
  | 'create_invoice'
  | 'send_payment_link'
  | 'send_review_request'
  | 'AI_draft'
  | 'AI_classify'

export interface ActionExecutionContext {
  supabase: SupabaseClient
  orgId: string
  ruleId?: string
  entityId?: string
  contactId?: string
  leadId?: string
  eventPayload?: Record<string, any>
}

export interface ActionResult {
  success: boolean
  actionType: string
  data?: any
  error?: string
}

export type ActionHandler = (
  params: Record<string, any>,
  context: ActionExecutionContext
) => Promise<ActionResult>

/**
 * 1. ACTION: SEND_SMS
 */
async function handleSendSms(
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const { supabase, orgId, contactId, eventPayload } = context
  let targetPhone = params.to || eventPayload?.phone || eventPayload?.callerNumber

  // If no direct phone provided, look up contact
  if (!targetPhone && contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone, opt_out, name')
      .eq('id', contactId)
      .maybeSingle()

    if (contact?.opt_out) {
      return { success: false, actionType: 'send_sms', error: 'Contact has opted out of SMS' }
    }
    targetPhone = contact?.phone
  }

  const norm = normalizePhoneToE164(targetPhone)
  if (!norm.isValid || !norm.e164) {
    return { success: false, actionType: 'send_sms', error: `Invalid recipient phone: ${targetPhone}` }
  }

  // Resolve tenant's assigned Telnyx sender number
  let senderNumber = params.from
  if (!senderNumber) {
    const { data: numRow } = await supabase
      .from('telnyx_phone_numbers')
      .select('phone_number')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (numRow) {
      senderNumber = numRow.phone_number
    } else {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('telnyx_phone_number')
        .eq('id', orgId)
        .maybeSingle()
      senderNumber = orgRow?.telnyx_phone_number
    }
  }

  // Render variables into template
  const text = renderTemplate(params.message || params.text || params.body || '', {
    business_name: eventPayload?.business_name,
    caller_name: eventPayload?.caller_name || eventPayload?.name,
    customer_name: eventPayload?.customer_name
  })

  const flowType = params.flowType || (eventPayload?.event_type ? String(eventPayload.event_type) : 'automation')
  const messageType = params.messageType || undefined

  const compliance = await verifyOutboundCompliance(supabase, {
    orgId,
    toPhone: norm.e164,
    fromPhone: senderNumber,
    flowType,
    messageType,
    body: text,
    contactId: context.contactId
  })

  if (!compliance.allowed) {
    return {
      success: false,
      actionType: 'send_sms',
      error: `Suppressed: ${compliance.suppressionReason}`
    }
  }

  const outboundText = compliance.formattedText

  const smsRes = await sendTelnyxSms({
    to: norm.e164,
    from: senderNumber,
    text: outboundText
  })

  if (smsRes.success) {
    await logComplianceAudit(supabase, {
      orgId,
      phone: norm.e164,
      contactId: context.contactId,
      action: 'message_sent',
      messageType: compliance.classification,
      reason: flowType
    })
  }

  // Log to messages table if conversation exists
  if (context.contactId) {
    let { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('org_id', orgId)
      .eq('contact_id', context.contactId)
      .maybeSingle()

    if (conv) {
      await supabase.from('messages').insert({
        org_id: orgId,
        conversation_id: conv.id,
        direction: 'outbound',
        sender_type: 'system',
        body: outboundText,
        delivery_status: smsRes.success ? 'sent' : 'failed',
        telnyx_message_id: smsRes.messageId,
        automation_source: 'automation_engine',
        failure_reason: smsRes.error || null
      })
    }
  }

  return {
    success: smsRes.success,
    actionType: 'send_sms',
    data: { messageId: smsRes.messageId, recipient: norm.e164 },
    error: smsRes.error
  }
}

/**
 * 2. ACTION: SEND_EMAIL
 */
async function handleSendEmail(
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const { supabase, orgId } = context
  const recipient = params.to || params.email
  const subject = params.subject || 'Notification'
  const body = params.body || params.message || ''

  if (!recipient) {
    return { success: false, actionType: 'send_email', error: 'Missing recipient email' }
  }

  // Log email delivery intent to activity_logs
  await supabase.from('activity_logs').insert({
    org_id: orgId,
    event_type: 'automation.email_dispatched',
    description: `Automated email dispatched to ${recipient}: ${subject}`,
    metadata: { recipient, subject, preview: body.slice(0, 100) }
  })

  return {
    success: true,
    actionType: 'send_email',
    data: { recipient, subject }
  }
}

/**
 * 3. ACTION: CREATE_TASK
 */
async function handleCreateTask(
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const { supabase, orgId, entityId } = context
  const title = params.title || 'Follow-up Task'
  const description = params.description || ''

  await supabase.from('activity_logs').insert({
    org_id: orgId,
    event_type: 'automation.task_created',
    description: `Task Created: ${title}`,
    metadata: { title, description, entityId, dueDate: params.due_date }
  })

  return {
    success: true,
    actionType: 'create_task',
    data: { title, description }
  }
}

/**
 * 4. ACTION: CREATE_NOTIFICATION
 */
async function handleCreateNotification(
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const { supabase, orgId } = context
  const title = params.title || 'Automation Alert'
  const message = params.message || ''
  const link = params.link || null

  let userId = params.user_id
  if (!userId) {
    // Default notification to the organization owner profile
    const { data: owner } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle()
    userId = owner?.id
  }

  if (!userId) {
    return { success: false, actionType: 'create_notification', error: 'No user target found for notification' }
  }

  const { data: notif, error } = await supabase.from('notifications').insert({
    org_id: orgId,
    user_id: userId,
    title,
    message,
    link
  }).select('id').single()

  if (error) {
    return { success: false, actionType: 'create_notification', error: error.message }
  }

  return {
    success: true,
    actionType: 'create_notification',
    data: { notificationId: notif?.id, title }
  }
}

/**
 * 5. ACTION: CHANGE_STATUS
 */
async function handleChangeStatus(
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const { supabase, orgId, entityId, leadId } = context
  const targetTable = params.entity_type || 'leads'
  const targetId = params.entity_id || entityId || leadId
  const newStatus = params.status

  if (!targetId || !newStatus) {
    return { success: false, actionType: 'change_status', error: 'Missing entity_id or status' }
  }

  const allowedTables = new Set(['leads', 'jobs', 'quotes', 'invoices', 'appointments'])
  if (!allowedTables.has(targetTable)) {
    return { success: false, actionType: 'change_status', error: `Unsupported table: ${targetTable}` }
  }

  const { error } = await supabase
    .from(targetTable)
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', targetId)
    .eq('org_id', orgId)

  if (error) {
    return { success: false, actionType: 'change_status', error: error.message }
  }

  return {
    success: true,
    actionType: 'change_status',
    data: { table: targetTable, id: targetId, status: newStatus }
  }
}

/**
 * 6. ACTION: ADD_TAG
 */
async function handleAddTag(
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const { supabase, orgId, contactId } = context
  const tagToAdd = params.tag
  const targetContactId = params.contact_id || contactId

  if (!targetContactId || !tagToAdd) {
    return { success: false, actionType: 'add_tag', error: 'Missing contact_id or tag' }
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, tags')
    .eq('id', targetContactId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!contact) {
    return { success: false, actionType: 'add_tag', error: 'Contact not found' }
  }

  const currentTags: string[] = contact.tags || []
  if (!currentTags.includes(tagToAdd)) {
    currentTags.push(tagToAdd)
    await supabase
      .from('contacts')
      .update({ tags: currentTags })
      .eq('id', targetContactId)
  }

  return {
    success: true,
    actionType: 'add_tag',
    data: { contactId: targetContactId, tag: tagToAdd }
  }
}

/**
 * 7. ACTION: SEND_REVIEW_REQUEST
 */
async function handleSendReviewRequest(
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const { supabase, orgId, contactId, entityId, eventPayload } = context
  const targetContactId = params.contact_id || contactId || eventPayload?.contact_id
  const targetJobId = params.job_id || entityId || eventPayload?.job_id

  if (!targetContactId) {
    return { success: false, actionType: 'send_review_request', error: 'Missing contact_id for review request' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.captodesk.com'

  const result = await dispatchReviewRequest(supabase, {
    orgId,
    contactId: targetContactId,
    jobId: targetJobId,
    baseUrl,
    customMessage: params.message
  })

  if (result.suppressed) {
    return {
      success: true,
      actionType: 'send_review_request',
      data: { suppressed: true, reason: result.reason }
    }
  }

  if (!result.success) {
    return {
      success: false,
      actionType: 'send_review_request',
      error: result.error
    }
  }

  return {
    success: true,
    actionType: 'send_review_request',
    data: result.reviewRequest
  }
}

/**
 * PLUGGABLE ACTION REGISTRY
 */
const ACTION_REGISTRY: Record<string, ActionHandler> = {
  send_sms: handleSendSms,
  send_email: handleSendEmail,
  create_task: handleCreateTask,
  create_notification: handleCreateNotification,
  change_status: handleChangeStatus,
  add_tag: handleAddTag,
  send_review_request: handleSendReviewRequest
}

/**
 * Executes a registered action by type
 */
export async function executeAction(
  actionType: string,
  params: Record<string, any>,
  context: ActionExecutionContext
): Promise<ActionResult> {
  const handler = ACTION_REGISTRY[actionType]

  if (!handler) {
    return {
      success: false,
      actionType,
      error: `Unknown action type '${actionType}'. Action not registered.`
    }
  }

  try {
    return await handler(params, context)
  } catch (err: any) {
    return {
      success: false,
      actionType,
      error: err?.message || 'Action handler execution exception'
    }
  }
}

/**
 * Allows registering additional custom actions dynamically
 */
export function registerCustomAction(actionType: string, handler: ActionHandler): void {
  ACTION_REGISTRY[actionType] = handler
}
