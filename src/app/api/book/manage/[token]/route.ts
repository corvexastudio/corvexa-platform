import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseServicePricing } from '@/lib/services/service-pricing'
import {
  checkRateLimitAsync,
  RATE_LIMITS,
  getRateLimitHeaders,
  extractClientIp,
  PRIVATE_CACHE_HEADERS
} from '@/lib/security/rate-limiter'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  let rateHeaders: Record<string, string> | undefined
  try {
    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'Missing management token' }, { status: 400 })
    }

    // IP-based rate limiting on appointment management view (30 req/min)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`manage:view:${clientIp}`, RATE_LIMITS.MANAGE_VIEW)
    rateHeaders = getRateLimitHeaders(rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    const supabase = createAdminClient()

    let apt: any = null
    let error: any = null

    // Attempt select with booking_snapshot; fallback gracefully if column not yet in remote schema
    const primaryRes = await supabase
      .from('appointments')
      .select(`
        id, title, service_type, start_time, end_time, status, source, cancellation_reason, confirmed_at, notes, booking_snapshot,
        organization:organizations(id, name, slug, owner_phone, telnyx_phone_number, timezone, subscription_status, logo_url, industry, google_review_url),
        contact:contacts(id, name, phone, email, address),
        service:services(id, name, duration_minutes, price, description)
      `)
      .eq('manage_token', token)
      .maybeSingle()

    if (primaryRes.error && (primaryRes.error.code === '42703' || primaryRes.error.message?.toLowerCase().includes('does not exist'))) {
      const fallbackRes = await supabase
        .from('appointments')
        .select(`
          id, title, service_type, start_time, end_time, status, source, cancellation_reason, confirmed_at, notes,
          organization:organizations(id, name, slug, owner_phone, telnyx_phone_number, timezone, subscription_status, logo_url, industry, google_review_url),
          contact:contacts(id, name, phone, email, address),
          service:services(id, name, duration_minutes, price, description)
        `)
        .eq('manage_token', token)
        .maybeSingle()

      apt = fallbackRes.data
      error = fallbackRes.error
    } else {
      apt = primaryRes.data
      error = primaryRes.error
    }

    if (error || !apt) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        {
          status: 404,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    const org = Array.isArray(apt.organization) ? apt.organization[0] : apt.organization
    const contact = Array.isArray(apt.contact) ? apt.contact[0] : apt.contact
    const service = Array.isArray(apt.service) ? apt.service[0] : apt.service

    // Query linked job for real-time technician tracking, financial reconciliation, and job items
    let trackingInfo: {
      token: string
      url: string
      jobNumber?: string | null
      jobStatus: string
      etaMinutes?: number | null
      enRouteAt?: string | null
      arrivedAt?: string | null
      startedAt?: string | null
      completedAt?: string | null
    } | null = null

    const { data: linkedJob } = await supabase
      .from('jobs')
      .select('id, job_number, status, tracking_token, en_route_at, arrived_at, started_at, completed_at, eta_minutes')
      .eq('appointment_id', apt.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (linkedJob) {
      let trackingToken = linkedJob.tracking_token
      if (!trackingToken) {
        trackingToken = crypto.randomUUID().replace(/-/g, '')
        await supabase
          .from('jobs')
          .update({ tracking_token: trackingToken })
          .eq('id', linkedJob.id)
      }

      trackingInfo = {
        token: trackingToken,
        url: `/t/${trackingToken}`,
        jobNumber: linkedJob.job_number,
        jobStatus: linkedJob.status || apt.status,
        etaMinutes: linkedJob.eta_minutes,
        enRouteAt: linkedJob.en_route_at,
        arrivedAt: linkedJob.arrived_at,
        startedAt: linkedJob.started_at,
        completedAt: linkedJob.completed_at
      }
    }

    let calculatedDurationMinutes = service?.duration_minutes || 60
    if (apt.start_time && apt.end_time) {
      const diffMinutes = Math.round(
        (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (60 * 1000)
      )
      if (diffMinutes > 0 && !isNaN(diffMinutes)) {
        calculatedDurationMinutes = diffMinutes
      }
    }

    // 1. Authoritative Historical Service Information Resolution (F-04)
    let resolvedService: any = null

    if (apt.booking_snapshot && apt.booking_snapshot.service) {
      const snap = apt.booking_snapshot
      resolvedService = {
        id: snap.service.id,
        name: snap.service.name || apt.service_type,
        durationMinutes: snap.service.durationMinutes || calculatedDurationMinutes,
        price: snap.service.price !== undefined ? snap.service.price : service?.price,
        pricingModel: snap.service.pricingModel || parseServicePricing(snap.service.price, snap.service.description).model,
        description: snap.service.description || service?.description || null,
        addOns: snap.addOns || [],
        pricingSummary: snap.pricingSummary || null,
        pricingSource: 'historical_snapshot'
      }
    } else if (linkedJob?.id) {
      // Reconstruct historical service items from recorded job_items
      let jobItems: any[] = []
      try {
        const { data: items } = await supabase
          .from('job_items')
          .select('id, description, quantity, unit_price, total')
          .eq('job_id', linkedJob.id)
        if (items) jobItems = items
      } catch {
        // Non-fatal
      }

      if (jobItems.length > 0) {
        const aptSvcNameLower = (apt.service_type || '').trim().toLowerCase()
        const baseItem = jobItems.find(it => it.description.trim().toLowerCase() === aptSvcNameLower) || jobItems[0]
        const addOnItems = jobItems.filter(it => it.id !== baseItem.id && !it.description.toLowerCase().includes('priority rush'))
        const catalogPricing = parseServicePricing(service?.price, service?.description)

        let resolvedModel = catalogPricing.model
        if (Number(baseItem.unit_price) === 0) {
          if (service?.description?.toLowerCase().includes('free estimate')) {
            resolvedModel = 'free_estimate'
          } else if (service?.description?.toLowerCase().includes('quote on site')) {
            resolvedModel = 'quote_on_site'
          }
        } else if (resolvedModel === 'quote_on_site' || resolvedModel === 'free_estimate') {
          resolvedModel = 'fixed'
        }

        resolvedService = {
          id: service?.id || null,
          name: apt.service_type || baseItem.description,
          durationMinutes: calculatedDurationMinutes,
          price: Number(baseItem.unit_price),
          pricingModel: resolvedModel,
          description: service?.description || null,
          addOns: addOnItems.map(a => ({
            name: a.description,
            price: Number(a.unit_price) || 0
          })),
          pricingSummary: {
            model: resolvedModel,
            basePrice: Number(baseItem.unit_price),
            addOnsTotal: addOnItems.reduce((sum, a) => sum + (Number(a.unit_price) || 0), 0),
            totalEstimate: jobItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0)
          },
          pricingSource: 'historical_line_items'
        }
      }
    }

    if (!resolvedService) {
      // Fallback: Use current catalog row with explicit distinction
      const notesAddOns: Array<{ name: string; price: number | null }> = []
      if (apt.notes && apt.notes.includes('[ADD-ONS:')) {
        const match = apt.notes.match(/\[ADD-ONS:\s*([^\]]+)\]/)
        if (match && match[1]) {
          const parts = match[1].split(',')
          for (const p of parts) {
            const priceMatch = p.match(/\(\+\$?([\d.]+)\)/)
            const cleanName = p.replace(/\(\+\$?[\d.]+\)/, '').trim()
            notesAddOns.push({
              name: cleanName,
              price: priceMatch ? Number(priceMatch[1]) : null
            })
          }
        }
      }

      resolvedService = service ? {
        id: service.id,
        name: apt.service_type || service.name,
        durationMinutes: calculatedDurationMinutes,
        price: service.price,
        pricingModel: parseServicePricing(service.price, service.description).model,
        description: service.description || null,
        addOns: notesAddOns,
        pricingSummary: null,
        pricingSource: 'catalog_fallback'
      } : {
        id: null,
        name: apt.service_type || 'Scheduled Service',
        durationMinutes: calculatedDurationMinutes,
        price: null,
        pricingModel: 'fixed',
        description: null,
        addOns: notesAddOns,
        pricingSummary: null,
        pricingSource: 'unavailable'
      }
    }

    // 2. Authoritative Reconciled Financials (Section 2 & 3)
    const { resolveCustomerJobFinancials } = await import('@/lib/payments/customer-financials')
    const invoice = await resolveCustomerJobFinancials(supabase, {
      orgId: org?.id,
      jobId: linkedJob?.id || null,
      quoteId: null
    })

    // 3. Cancellation Cutoff and Policy Check
    const cancellationNoticeHours = org?.cancellation_notice_hours !== undefined && org?.cancellation_notice_hours !== null
      ? Number(org.cancellation_notice_hours)
      : 2

    let isWithinCancellationCutoff = false
    if (cancellationNoticeHours > 0 && apt.start_time) {
      const startMs = new Date(apt.start_time).getTime()
      const noticeMs = cancellationNoticeHours * 60 * 60 * 1000
      const cutoffMs = startMs - noticeMs
      const nowMs = Date.now()
      if (nowMs > cutoffMs && nowMs < startMs + 24 * 60 * 60 * 1000) {
        isWithinCancellationCutoff = true
      }
    }

    // 4. Existing In-Portal Feedback Check
    let existingFeedback: { rating: number; feedbackText?: string | null } | null = null
    if (org?.id && (linkedJob?.id || apt.contact_id)) {
      try {
        let feedbackQuery = supabase
          .from('customer_feedback')
          .select('rating, feedback_text')
          .eq('org_id', org.id)

        if (linkedJob?.id) {
          feedbackQuery = feedbackQuery.eq('job_id', linkedJob.id)
        } else if (apt.contact_id) {
          feedbackQuery = feedbackQuery.eq('contact_id', apt.contact_id)
        }

        const { data: fbData } = await feedbackQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (fbData) {
          existingFeedback = {
            rating: fbData.rating,
            feedbackText: fbData.feedback_text
          }
        }
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json(
      {
        appointment: {
          id: apt.id,
          title: apt.title,
          serviceType: apt.service_type,
          startTime: apt.start_time,
          endTime: apt.end_time,
          durationMinutes: calculatedDurationMinutes,
          status: apt.status,
          cancellationReason: apt.cancellation_reason,
          confirmedAt: apt.confirmed_at,
          notes: apt.notes,
          cancellationNoticeHours,
          isWithinCancellationCutoff,
          business: {
            name: org?.name,
            slug: org?.slug,
            phone: org?.telnyx_phone_number || org?.owner_phone,
            timezone: org?.timezone || 'America/Chicago',
            subscriptionStatus: org?.subscription_status || 'active',
            logoUrl: org?.logo_url || null,
            industry: org?.industry || null,
            googleReviewUrl: org?.google_review_url || null
          },
          customer: {
            name: contact?.name,
            phone: contact?.phone,
            email: contact?.email,
            address: contact?.address
          },
          service: resolvedService,
          historicalService: resolvedService,
          invoice: invoice ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            title: invoice.title,
            total: invoice.total,
            amountPaid: invoice.amountPaid,
            amountDue: invoice.amountDue,
            status: invoice.status,
            financialStatus: invoice.financialStatus,
            totalRefunded: invoice.totalRefunded,
            receiptUrl: invoice.receiptUrl,
            manageToken: invoice.manageToken,
            paidAt: invoice.paidAt,
            multipleInvoicesCount: invoice.multipleInvoicesCount
          } : null,
          tracking: trackingInfo,
          feedback: existingFeedback
        }
      },
      {
        status: 200,
        headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
      }
    )
  } catch (err: any) {
    console.error('[BOOKING_GET_MANAGE_ERROR]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: { ...PRIVATE_CACHE_HEADERS, ...(rateHeaders || {}) }
      }
    )
  }
}
