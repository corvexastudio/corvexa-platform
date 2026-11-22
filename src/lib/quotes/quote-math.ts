/**
 * Authoritative financial math for quotes and estimates
 * Pure calculation functions with zero Node.js/server dependencies
 */

export interface QuoteLineItemInput {
  description: string
  quantity: number
  unit_price: number
}

export interface CalculatedLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface CalculatedFinancials {
  lineItems: CalculatedLineItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
}

/**
 * Calculates subtotal, tax, and grand total from line items
 */
export function calculateQuoteFinancials(
  items: QuoteLineItemInput[],
  options: { taxRate?: number; discount?: number } = {}
): CalculatedFinancials {
  const lineItems: CalculatedLineItem[] = items.map((item) => {
    const qty = Number(item.quantity) || 1
    const price = Number(item.unit_price) || 0
    const total = Math.round(qty * price * 100) / 100
    return {
      description: item.description.trim(),
      quantity: qty,
      unit_price: price,
      total
    }
  })

  const subtotal = lineItems.reduce((acc, it) => acc + it.total, 0)
  const discount = Math.max(0, Number(options.discount) || 0)
  const taxableAmount = Math.max(0, subtotal - discount)
  const safeTaxRate = Math.max(0, Number(options.taxRate) || 0)
  // Standardize taxRate as percentage (e.g. 8.25 for 8.25%, 1.0 for 1%)
  const taxFraction = safeTaxRate / 100
  const tax = Math.round(taxableAmount * taxFraction * 100) / 100
  const grandTotal = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100)

  return {
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    tax,
    discount,
    total: grandTotal
  }
}
