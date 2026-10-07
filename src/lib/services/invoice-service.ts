import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createInvoice,
  convertJobToInvoice,
  convertQuoteToInvoice,
  sendInvoice,
  recordPayment,
  voidInvoice,
  softDeleteInvoice,
  restoreInvoice,
  type CreateInvoiceInput,
  type PaymentMethod,
  type PaymentStatus
} from '../payments/invoice-manager.ts'

/**
 * InvoiceService
 * 
 * Domain service managing the complete billing and accounts receivable lifecycle:
 * quote/job conversion, invoicing, Stripe/Telnyx dispatch, offline payment collection,
 * and soft-delete retention.
 */
export class InvoiceService {
  /**
   * Generates a new invoice with line items, tax, and discount computations.
   */
  static async create(supabase: SupabaseClient, input: CreateInvoiceInput) {
    return createInvoice(supabase, input)
  }

  /**
   * Alias for create.
   */
  static async createInvoice(supabase: SupabaseClient, input: CreateInvoiceInput) {
    return this.create(supabase, input)
  }

  /**
   * Records payment against invoice (online via Stripe or offline via cash/check).
   */
  static async recordPayment(
    supabase: SupabaseClient,
    input: {
      invoiceId: string
      orgId: string
      amount: number
      paymentMethod: PaymentMethod
      paymentStatus?: PaymentStatus
      stripePaymentIntentId?: string
      stripeCheckoutSessionId?: string
      stripeReceiptUrl?: string
      referenceNote?: string
    }
  ) {
    return recordPayment(supabase, input)
  }

  /**
   * Records an offline payment (cash, check, or on-site card).
   */
  static async recordOfflinePayment(
    supabase: SupabaseClient,
    input: {
      invoiceId: string
      orgId: string
      amount: number
      paymentMethod: 'cash' | 'check' | 'card_offline'
      referenceNote?: string
    }
  ) {
    return this.recordPayment(supabase, {
      ...input,
      paymentMethod: input.paymentMethod as PaymentMethod,
      paymentStatus: 'succeeded'
    })
  }

  /**
   * Voids an invoice and halts automated overdue reminders.
   */
  static async void(supabase: SupabaseClient, invoiceId: string, orgId: string, reason?: string) {
    return voidInvoice(supabase, { invoiceId, orgId, reason })
  }

  /**
   * Alias for void.
   */
  static async voidInvoice(supabase: SupabaseClient, invoiceId: string, orgId: string, reason?: string) {
    return this.void(supabase, invoiceId, orgId, reason)
  }

  /**
   * Resolves public invoice details by secure manage token.
   */
  static async getInvoiceByToken(supabase: SupabaseClient, manageToken: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*), organizations(name, phone, slug)')
      .eq('manage_token', manageToken)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return data
  }

  /**
   * Bridges completed job line items into a draft invoice.
   */
  static async convertFromJob(
    supabase: SupabaseClient,
    input: { jobId: string; orgId: string; dueDate?: string; taxRate?: number; discountAmount?: number }
  ) {
    return convertJobToInvoice(supabase, input)
  }

  /**
   * Bridges an accepted quote into a draft invoice.
   */
  static async convertFromQuote(
    supabase: SupabaseClient,
    input: { quoteId: string; orgId: string; dueDate?: string }
  ) {
    return convertQuoteToInvoice(supabase, input)
  }

  /**
   * Sends an invoice to customer via Telnyx SMS with tokenized Stripe payment link.
   */
  static async sendViaSms(
    supabase: SupabaseClient,
    input: { invoiceId: string; orgId: string; baseUrl: string }
  ) {
    return sendInvoice(supabase, input)
  }

  /**
   * Soft-deletes an invoice preserving financial and audit history.
   */
  static async softDelete(supabase: SupabaseClient, invoiceId: string, orgId: string) {
    return softDeleteInvoice(supabase, { invoiceId, orgId })
  }

  /**
   * Restores a previously soft-deleted invoice.
   */
  static async restore(supabase: SupabaseClient, invoiceId: string, orgId: string) {
    return restoreInvoice(supabase, { invoiceId, orgId })
  }
}
