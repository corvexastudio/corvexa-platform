/**
 * CaptoDesk Provider-Independent Billing Boundary
 * 
 * Defines the contract for payment providers. The core CaptoDesk subscription
 * and entitlement engine evaluates state strictly from internal database models,
 * decoupling access decisions from external payment gateways.
 */

export interface BillingProvider {
  readonly name: string
  readonly isManual: boolean
}

/**
 * Initial provider for early customer onboarding.
 * Payments are collected outside the platform (e.g. PayPal invoice / payment link)
 * and verified manually by an operator/admin before subscription activation.
 */
export class ManualBillingProvider implements BillingProvider {
  readonly name = 'manual'
  readonly isManual = true
}

export const defaultBillingProvider = new ManualBillingProvider()
