import { NextRequest, NextResponse } from 'next/server'
import { deployClientToAgencySlot, validateDeployClientRequest } from '@/lib/agency/agency-service'
import { getAgencyContext } from '@/lib/agency/agency-auth'

export const dynamic = 'force-dynamic'

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

    // 1. Validate payload against canonical DeployClientRequest contract
    const validation = validateDeployClientRequest(body)
    if (!validation.isValid || !validation.validatedData) {
      return NextResponse.json(
        { 
          error: validation.error || 'Invalid deployment payload',
          details: validation.fieldErrors 
        },
        { status: 400 }
      )
    }

    const clientData = validation.validatedData

    // 2. Resolve agency identity strictly from authenticated context
    // Never trust browser-supplied agency ID for regular agency callers
    const authResult = await getAgencyContext()
    if (!authResult.ok) {
      return authResult.response!
    }

    const { agency, user } = authResult

    // 3. Deploy contractor client into an available wholesale slot with concurrency safety
    const result = await deployClientToAgencySlot(agency.id, clientData, undefined, user?.id)

    if (!result.success) {
      if (result.duplicate) {
        return NextResponse.json(
          { error: result.error || 'A contractor client with this business name or phone is already deployed in your portfolio' },
          { status: 409 }
        )
      }

      if (result.adminReviewRequired) {
        return NextResponse.json(
          {
            error: result.error || 'Fleets with 6 or more vehicles require Enterprise or Super Admin review and cannot be auto-deployed under standard wholesale packages.',
            status: 'admin_review_required'
          },
          { status: 422 }
        )
      }

      return NextResponse.json(
        { error: result.error || 'Failed to deploy client slot' },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Contractor client deployed successfully into slot',
        slot: result.slot,
        claimUrl: result.claimUrl
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[AGENCY DEPLOY CLIENT API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error while deploying client' },
      { status: 500 }
    )
  }
}
