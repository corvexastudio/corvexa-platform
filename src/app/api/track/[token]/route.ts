import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerViewJobTracking } from '@/lib/jobs/job-manager'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: 'Tracking token is required' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const result = await customerViewJobTracking(supabase, token)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Job not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[API_JOB_TRACKING_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error resolving job tracking' }, { status: 500 })
  }
}
