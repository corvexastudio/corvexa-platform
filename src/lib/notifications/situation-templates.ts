/**
 * Centralized Situation-Aware Template Engine
 * Generates dynamic, context-sensitive copy for both Contractor Alerts and Customer SMS.
 * Adapts tone and action calls based on Operation Mode (Solo vs Multi-Crew) and Starter Pass milestones.
 */

export type OperationMode = 'solo' | 'multi_crew'

export interface NotificationTemplateContext {
  operationMode?: OperationMode
  ownerName?: string
  businessName?: string
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  serviceName?: string
  technicianName?: string
  etaMinutes?: number
  bookingTime?: string
  jobMilestone?: number // 1, 2, 3, 4+
  remainingJobs?: number // 2, 1, 0
  jobRevenue?: number // e.g. 250
  totalRevenue?: number // e.g. 675
  targetUrl?: string
  manageUrl?: string
  reviewUrl?: string
  upgradeUrl?: string
  trackingUrl?: string
}

export type SituationTemplateKey =
  | 'starter_pass_welcome'
  | 'starter_job_booked'
  | 'starter_job_completed'
  | 'starter_job_gated'
  | 'customer_booking_confirmation'
  | 'customer_en_route'
  | 'customer_review_request'

/**
 * Formats a customer name for SMS/UI greetings while preserving interior casing
 * (e.g. "karl Marx" -> "Karl Marx", "Mary McDonald" -> "Mary McDonald")
 * and keeping missing/"there" fallbacks lowercase.
 */
export function formatCustomerGreetingName(
  name?: string | null,
  fallback = 'there'
): string {
  const cleaned = (name || '').trim().replace(/\s+/g, ' ')
  if (!cleaned || cleaned.toLowerCase() === 'there') {
    return fallback
  }
  return cleaned
    .split(' ')
    .map(part => (/^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ')
}

/**
 * Resolves the operational mode from organization record or team indicators.
 */
export function resolveOperationMode(org?: any): OperationMode {
  if (!org) return 'solo'
  const mode = String(org.operation_mode || org.operationMode || '').toLowerCase().trim()
  if (mode === 'multi_crew' || mode === 'fleet') return 'multi_crew'
  if (mode === 'solo') return 'solo'

  // Heuristic fallbacks if unset
  if (Array.isArray(org.crews) && org.crews.length > 1) return 'multi_crew'
  if (typeof org.crew_count === 'number' && org.crew_count > 1) return 'multi_crew'

  return 'solo'
}

/**
 * Formats a currency amount to a clean integer or standard dollar display.
 */
function formatDollars(amount?: number | null, fallback = '0'): string {
  if (typeof amount !== 'number' || isNaN(amount)) return fallback
  return Math.round(amount).toLocaleString('en-US')
}

/**
 * Renders situation-aware notification text.
 */
export function renderSituationAwareText(
  templateKey: SituationTemplateKey,
  context: NotificationTemplateContext
): string {
  const mode = context.operationMode || 'solo'
  const customer = context.customerName?.trim() || 'A new customer'
  const business = context.businessName?.trim() || 'CaptoDesk'
  const service = context.serviceName?.trim() || 'Service'
  const time = context.bookingTime?.trim() || 'Upcoming'
  const tech = context.technicianName?.trim() || context.ownerName?.trim() || 'Your technician'
  const targetUrl = context.targetUrl || '/client/jobs'
  const upgradeUrl = context.upgradeUrl || '/client/billing?reason=starter_limit'
  const milestone = context.jobMilestone ?? 1
  const remaining = context.remainingJobs ?? Math.max(0, 3 - milestone)

  switch (templateKey) {
    case 'starter_pass_welcome': {
      const link = context.targetUrl || 'captodesk.com'
      return `Welcome to CaptoDesk! Your first 3 customer jobs are 100% free with automated dispatch, payments, and Google review requests. Share your free booking link on Google & social: ${link}`
    }

    case 'starter_job_booked': {
      const actionText = mode === 'multi_crew' ? 'Tap to assign crew' : 'Tap to review'
      if (milestone === 3) {
        return `🎉 [Job 3 of 3 Free] Final Free Job Booked: ${customer} booked ${service} for ${time}! ${actionText}: ${targetUrl}`
      }
      return `🎉 [Job ${milestone} of 3 Free] New Booking: ${customer} booked ${service} for ${time}! ${actionText}: ${targetUrl}`
    }

    case 'starter_job_completed': {
      const revText = formatDollars(context.jobRevenue, '0')
      const totalText = formatDollars(context.totalRevenue, revText)

      if (milestone >= 3) {
        return `🏆 [Free Starter Pass Completed] You just earned $${totalText} across 3 jobs on CaptoDesk with $0 platform fees! Upgrade to Pro to keep automated bookings, dispatch & reviews rolling without interruption: ${upgradeUrl}`
      }

      if (milestone === 1) {
        const remainingLabel = remaining === 1 ? '1 free job' : `${remaining} free jobs`
        return `💰 [Job 1 of 3 Free Completed] Nice work! Paid $${revText} for ${customer}. Review request sent automatically! You have ${remainingLabel} remaining.`
      }

      // milestone === 2
      const remainingLabel = remaining === 1 ? '1 free job left' : `${remaining} free jobs remaining`
      return `💰 [Job 2 of 3 Free Completed] Excellent! $${revText} collected ($${totalText} total on free pass). ${remainingLabel}!`
    }

    case 'starter_job_gated': {
      const estRev = formatDollars(context.jobRevenue, '200+')
      return `🚨 New Job Waiting: ${customer} booked ${service} ($${estRev} est. revenue)! You've used your 3 free jobs. Upgrade to Pro to unlock this job and dispatch immediately: ${upgradeUrl}`
    }

    case 'customer_booking_confirmation': {
      const manage = context.manageUrl ? ` Manage or reschedule: ${context.manageUrl}` : ''
      if (mode === 'multi_crew') {
        return `Hi ${customer}! Your appointment with ${business} for ${service} is confirmed for ${time}. Our crew looks forward to serving you.${manage}`
      }
      return `Hi ${customer}! Your appointment with ${business} for ${service} is confirmed for ${time}.${manage}`
    }

    case 'customer_en_route': {
      const greetingCustomer = formatCustomerGreetingName(context.customerName)
      const eta = context.etaMinutes ? ` ETA ~${context.etaMinutes} mins.` : ''
      const track = context.trackingUrl ? ` Track live: ${context.trackingUrl}` : ''
      if (mode === 'multi_crew') {
        return `Hi ${greetingCustomer}, your technician ${tech} from ${business} is en route to your location.${eta}${track}`
      }
      return `Hi ${greetingCustomer}, ${tech} from ${business} is en route to your location.${eta}${track}`
    }

    case 'customer_review_request': {
      const reviewLink = context.reviewUrl || ''
      if (mode === 'multi_crew') {
        return `Hi ${customer}, thank you for choosing ${business} today! How did our crew do? Please take 30 seconds to leave us a Google review: ${reviewLink}`
      }
      return `Hi ${customer}, thank you for choosing ${business} today! Could you take 30 seconds to leave ${tech} a quick Google review? It helps my small business tremendously: ${reviewLink}`
    }

    default:
      return `Update from ${business}: ${service} for ${customer}.`
  }
}
