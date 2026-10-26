import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { lookupPhoneNumber } from '@/lib/telephony/carrier-lookup'
import { normalizePhoneToE164 } from '@/lib/telephony/phone-normalizer'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const url = new URL(request.url)
  const phone = url.searchParams.get('phone')

  if (!phone || !phone.trim()) {
    return NextResponse.json(
      { error: 'Query parameter "phone" is required.' },
      { status: 400 }
    )
  }

  const normalized = normalizePhoneToE164(phone)
  if (!normalized.isValid || !normalized.e164) {
    return NextResponse.json(
      {
        error: normalized.error || 'Invalid phone number format.',
        e164Phone: phone,
        lineType: 'unknown',
        carrierName: null,
        detectedCarrierPreset: 'other',
        canReceiveSms: false,
        warning: 'Invalid phone number format'
      },
      { status: 400 }
    )
  }

  try {
    const lookupResult = await lookupPhoneNumber(normalized.e164)
    return NextResponse.json({
      success: true,
      ...lookupResult
    })
  } catch (err: any) {
    console.error('[Admin Phone Lookup Error]', err)
    return NextResponse.json(
      {
        success: true,
        e164Phone: normalized.e164,
        lineType: 'unknown',
        carrierName: null,
        detectedCarrierPreset: 'other',
        canReceiveSms: true,
        warning: null
      }
    )
  }
}
