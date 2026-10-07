import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createQuote,
  sendQuote,
  customerAcceptQuote,
  customerDeclineQuote,
  customerViewQuote,
  softDeleteQuote,
  restoreQuote,
  type CreateQuoteInput
} from '../quotes/quote-manager.ts'

/**
 * QuoteService
 * 
 * Domain service managing the estimate generation, customer presentation,
 * interactive clarification, acceptance/declination, and soft-delete retention.
 */
export class QuoteService {
  /**
   * Creates a draft quote with line items and transactional document numbering.
   */
  static async create(supabase: SupabaseClient, input: CreateQuoteInput) {
    return createQuote(supabase, input)
  }

  /**
   * Alias for create.
   */
  static async createQuote(supabase: SupabaseClient, input: CreateQuoteInput) {
    return this.create(supabase, input)
  }

  /**
   * Sends quote to customer via Telnyx SMS with manage link and follow-up schedules.
   */
  static async sendViaSms(
    supabase: SupabaseClient,
    input: { quoteId: string; orgId: string; baseUrl: string }
  ) {
    return sendQuote(supabase, input.quoteId, input.orgId, input.baseUrl)
  }

  /**
   * Records customer viewing quote.
   */
  static async view(supabase: SupabaseClient, token: string) {
    return customerViewQuote(supabase, token)
  }

  /**
   * Records customer digital acceptance, halting follow-up automations.
   */
  static async accept(
    supabase: SupabaseClient,
    token: string,
    signatureName?: string
  ) {
    return customerAcceptQuote(supabase, token, signatureName)
  }

  /**
   * Alias for accept.
   */
  static async acceptQuote(
    supabase: SupabaseClient,
    token: string,
    signatureName?: string
  ) {
    return this.accept(supabase, token, signatureName)
  }

  /**
   * Records customer declination with optional reason feedback.
   */
  static async decline(
    supabase: SupabaseClient,
    token: string,
    reason?: string
  ) {
    return customerDeclineQuote(supabase, token, reason)
  }

  /**
   * Alias for decline.
   */
  static async declineQuote(
    supabase: SupabaseClient,
    token: string,
    reason?: string
  ) {
    return this.decline(supabase, token, reason)
  }

  /**
   * Logs a customer clarification question and notifies owner/dispatcher.
   */
  static async sendClarificationQuestion(
    supabase: SupabaseClient,
    token: string,
    question: string
  ) {
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, org_id, quote_number, contact_id, contacts(name, phone)')
      .eq('manage_token', token)
      .single()

    if (quoteError || !quote) {
      return { success: false, error: 'Quote not found' }
    }

    const contactName = (quote as any).contacts?.name || 'Customer'

    await supabase.from('notifications').insert({
      org_id: quote.org_id,
      title: `Quote #${quote.quote_number} Question`,
      message: `${contactName} asked: "${question}"`,
      link: '/client/inbox'
    })

    await supabase.from('activity_logs').insert({
      org_id: quote.org_id,
      event_type: 'quote.clarification_requested',
      description: `Customer asked regarding quote #${quote.quote_number}: ${question}`,
      metadata: { quote_id: quote.id, question }
    })

    return { success: true }
  }

  /**
   * Resolves public quote details by secure manage token.
   */
  static async getQuoteByToken(supabase: SupabaseClient, manageToken: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select('*, quote_items(*), organizations(name, phone, slug)')
      .eq('manage_token', manageToken)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return data
  }

  /**
   * Soft-deletes a quote preserving customer audit history.
   */
  static async softDelete(supabase: SupabaseClient, quoteId: string, orgId: string) {
    return softDeleteQuote(supabase, { orgId, quoteId })
  }

  /**
   * Restores a previously soft-deleted quote.
   */
  static async restore(supabase: SupabaseClient, quoteId: string, orgId: string) {
    return restoreQuote(supabase, { orgId, quoteId })
  }
}
