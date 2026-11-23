import type { SupabaseClient } from '@supabase/supabase-js'

export type CustomerFinancialStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'fully_refunded'
  | 'voided'

export interface CustomerInvoiceSummary {
  id: string
  invoiceNumber: string
  title: string
  total: number
  amountPaid: number
  amountDue: number
  status: string
  financialStatus: CustomerFinancialStatus
  totalRefunded: number
  receiptUrl: string | null
  pdfUrl?: string | null
  dueDate?: string | null
  manageToken: string | null
  paidAt: string | null
  hasMultipleInvoices?: boolean
  multipleInvoicesCount: number
}

/**
 * Authoritatively resolves customer-facing financial state for a job/appointment.
 * Strictly binds to job_id or linked quote_id to prevent cross-job data leakage.
 * Inspects recorded payments and refunds ledger to distinguish paid, partial, refunded, and void.
 */
/**
 * Pure ledger calculation function to derive customer financial summary.
 * Inspects recorded payments and refunds ledger to distinguish paid, partial, refunded, and void.
 */
export function deriveCustomerInvoiceSummary(
  primaryInvoice: any,
  payments: any[] = [],
  multipleInvoicesCount: number = 1
): CustomerInvoiceSummary {
  // Calculate canonical financial sums
  const succeededPayments = payments.filter(p => p.status === 'succeeded' || !p.status)
  const totalSucceeded = succeededPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const totalRefunded = payments.reduce((sum, p) => {
    if (p.amount_refunded && Number(p.amount_refunded) > 0) {
      return sum + Number(p.amount_refunded)
    }
    if (p.status === 'refunded' || p.refunded) {
      return sum + (Number(p.amount) || 0)
    }
    return sum
  }, 0)

  const invoiceTotal = Math.round((Number(primaryInvoice.total) || 0) * 100) / 100
  const recordedAmountPaid = Math.round((Number(primaryInvoice.amount_paid) || 0) * 100) / 100

  // Effective amount paid is max of ledger payments or recorded amount_paid (handles offline recorded payments)
  const effectivePaid = Math.max(totalSucceeded, recordedAmountPaid)
  const calculatedDue = Math.max(0, Math.round((invoiceTotal - effectivePaid) * 100) / 100)

  // Derive customer-facing financial status
  let financialStatus: CustomerFinancialStatus = 'unpaid'

  if (primaryInvoice.status === 'void' || primaryInvoice.status === 'voided') {
    financialStatus = 'voided'
  } else if (totalRefunded > 0 && (totalRefunded >= effectivePaid || effectivePaid === 0)) {
    financialStatus = 'fully_refunded'
  } else if (totalRefunded > 0 && totalRefunded < effectivePaid) {
    financialStatus = 'partially_refunded'
  } else if (effectivePaid >= invoiceTotal && invoiceTotal > 0) {
    financialStatus = 'paid'
  } else if (primaryInvoice.status === 'paid' && calculatedDue === 0) {
    financialStatus = 'paid'
  } else if (effectivePaid > 0) {
    financialStatus = 'partially_paid'
  } else {
    financialStatus = 'unpaid'
  }

  // Extract receipt URL if available
  const receiptUrl = payments.find(p => p.stripe_receipt_url || p.receipt_url)?.stripe_receipt_url ||
    payments.find(p => p.receipt_url)?.receipt_url ||
    null

  return {
    id: primaryInvoice.id,
    invoiceNumber: primaryInvoice.invoice_number,
    title: primaryInvoice.title,
    total: invoiceTotal,
    amountPaid: effectivePaid,
    amountDue: calculatedDue,
    status: primaryInvoice.status,
    financialStatus,
    totalRefunded: Math.round(totalRefunded * 100) / 100,
    receiptUrl,
    manageToken: primaryInvoice.manage_token || null,
    paidAt: primaryInvoice.paid_at || null,
    hasMultipleInvoices: multipleInvoicesCount > 1,
    multipleInvoicesCount
  }
}

/**
 * Reconciles authoritative invoice state for customer-facing tracking and management.
 * Checks for direct job linkage, then quote linkage, and avoids showing orphan invoices.
 * Inspects recorded payments and refunds ledger to distinguish paid, partial, refunded, and void.
 */
export async function resolveCustomerJobFinancials(
  supabase: SupabaseClient,
  params: {
    orgId: string
    jobId?: string | null
    quoteId?: string | null
  }
): Promise<CustomerInvoiceSummary | null> {
  const { orgId, jobId, quoteId } = params
  if (!orgId || (!jobId && !quoteId)) {
    return null
  }

  // 1. Query all active invoices strictly tied to this job
  let invoices: any[] = []

  if (jobId) {
    const { data: jobInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, title, total, amount_paid, amount_due, status, manage_token, paid_at, created_at, deleted_at')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (jobInvoices && jobInvoices.length > 0) {
      invoices = jobInvoices
    }
  }

  // Fallback to quote linkage only if no direct job invoices found
  if (invoices.length === 0 && quoteId) {
    const { data: quoteInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, title, total, amount_paid, amount_due, status, manage_token, paid_at, created_at, deleted_at')
      .eq('org_id', orgId)
      .eq('quote_id', quoteId)
      .is('job_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (quoteInvoices && quoteInvoices.length > 0) {
      invoices = quoteInvoices
    }
  }

  if (invoices.length === 0) {
    return null
  }

  // Prioritize active/billed invoice over voided invoice if multiple exist
  const primaryInvoice = invoices.find(inv => inv.status !== 'void') || invoices[0]

  // 2. Query payments ledger for this primary invoice
  let payments: any[] = []
  try {
    const { data: paymentRows } = await supabase
      .from('payments')
      .select('id, amount, status, payment_method, stripe_receipt_url, created_at')
      .eq('org_id', orgId)
      .eq('invoice_id', primaryInvoice.id)

    if (paymentRows && paymentRows.length > 0) {
      payments = paymentRows
    }
  } catch {
    // Non-fatal if payments query fails
  }

  return deriveCustomerInvoiceSummary(primaryInvoice, payments, invoices.length)
}
