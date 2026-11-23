import { NextRequest, NextResponse } from 'next/server'
import { offboardClientFromAgencySlot } from '@/lib/agency/agency-service'
import { getAgencyContext } from '@/lib/agency/agency-auth'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload received' },
        { status: 400 }
      )
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object' },
        { status: 400 }
      )
    }

    const { organizationId, transitionType, releasePhoneNumber, reason } = body

    if (!organizationId || typeof organizationId !== 'string' || !UUID_REGEX.test(organizationId.trim())) {
      return NextResponse.json(
        { error: 'Valid organizationId UUID is required' },
        { status: 400 }
      )
    }

    // 1. Resolve agency identity strictly from authenticated context
    const authResult = await getAgencyContext()
    if (!authResult.ok) {
      return authResult.response!
    }

    const { agency, user } = authResult

    // 2. Offboard contractor client and release wholesale slot capacity
    const result = await offboardClientFromAgencySlot(
      agency.id,
      organizationId.trim(),
      {
        organizationId: organizationId.trim(),
        transitionType: transitionType === 'retain_phone' || transitionType === 'transfer' ? transitionType : 'release',
        releasePhoneNumber: Boolean(releasePhoneNumber),
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Offboarded by agency'
      },
      user?.id
    )

    if (!result.success) {
      const isNotFoundOrForbidden = result.error?.includes('not belong') || result.error?.includes('not found')
      return NextResponse.json(
        { error: result.error || 'Failed to offboard client' },
        { status: isNotFoundOrForbidden ? 403 : 422 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Contractor client successfully offboarded and wholesale slot released',
        offboardedOrganizationId: result.organizationId,
        slotsReleased: result.slotsReleased,
        freedCapacity: result.freedCapacity,
        telephonyAction: result.telephonyAction,
        historicalRecordsPreserved: result.historicalRecordsPreserved,
        pendingItemsSummary: {
          pendingAppointments: result.pendingAppointmentsCount,
          unpaidInvoices: result.unpaidInvoicesCount
        },
        offboardedAt: result.offboardedAt
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[AGENCY OFFBOARD CLIENT API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error while offboarding client' },
      { status: 500 }
    )
  }
}
