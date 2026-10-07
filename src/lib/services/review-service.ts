import type { SupabaseClient } from '@supabase/supabase-js'
import {
  scheduleJobReviewAutomation,
  checkReviewEligibility,
  dispatchReviewRequest,
  recordReviewClick,
  formatCompliantReviewMessage
} from '../reviews/review-manager.ts'
import {
  computeLifecycleStatus,
  evaluateCustomerReactivation,
  updateCustomerServiceDate,
  type LifecycleStatus,
  type CustomerReactivationInput
} from '../retention/lifecycle-manager.ts'

/**
 * ReviewService
 * 
 * Domain service managing post-service Google review automation, link tracking,
 * TCPA complaint messaging, and customer reactivation cycles.
 */
export class ReviewService {
  /**
   * Evaluates customer eligibility for post-job review solicitation.
   */
  static async checkEligibility(
    supabase: SupabaseClient,
    input: { orgId: string; contactId: string; jobId?: string }
  ) {
    return checkReviewEligibility(supabase, input)
  }

  /**
   * Schedules automated review solicitation sequence following job completion.
   */
  static async scheduleForJob(
    supabase: SupabaseClient,
    options: { orgId: string; jobId: string; contactId: string }
  ) {
    return scheduleJobReviewAutomation(supabase, options)
  }

  /**
   * Alias for scheduleForJob.
   */
  static async sendReviewRequest(
    supabase: SupabaseClient,
    options: { orgId: string; jobId: string; contactId: string }
  ) {
    return this.scheduleForJob(supabase, options)
  }

  /**
   * Dispatches review request immediately.
   */
  static async dispatch(
    supabase: SupabaseClient,
    options: {
      orgId: string
      contactId: string
      jobId?: string
      baseUrl?: string
      customMessage?: string
    }
  ) {
    return dispatchReviewRequest(supabase, {
      ...options,
      baseUrl: options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
    })
  }

  /**
   * Formats compliant review text without rating coercion.
   */
  static formatMessage(businessName: string, reviewUrl: string): string {
    return formatCompliantReviewMessage(businessName, reviewUrl)
  }

  /**
   * Records click on short review redirect link /r/[token].
   */
  static async recordClick(supabase: SupabaseClient, token: string) {
    return recordReviewClick(supabase, token)
  }

  /**
   * Alias for recordClick.
   */
  static async recordReviewLinkClick(supabase: SupabaseClient, token: string) {
    return this.recordClick(supabase, token)
  }

  /**
   * Computes customer lifecycle status based on service frequency and days since last job.
   */
  static getLifecycleStatus(
    lastServiceDate: string | null | undefined,
    frequencyDays = 90
  ): LifecycleStatus {
    return computeLifecycleStatus(lastServiceDate, frequencyDays)
  }

  /**
   * Evaluates and dispatches reactivation reminders for overdue customers.
   */
  static async runReactivations(supabase: SupabaseClient, input: CustomerReactivationInput) {
    return evaluateCustomerReactivation(supabase, input)
  }

  /**
   * Alias for runReactivations.
   */
  static async triggerReactivationBatch(
    supabase: SupabaseClient,
    orgId: string,
    baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
  ) {
    return this.runReactivations(supabase, { orgId, baseUrl })
  }

  /**
   * Updates customer last service date when a job is marked completed.
   */
  static async updateServiceDate(
    supabase: SupabaseClient,
    input: {
      contactId: string
      orgId: string
      serviceDate?: string | Date
      frequencyDays?: number
    }
  ) {
    return updateCustomerServiceDate(supabase, input)
  }
}
