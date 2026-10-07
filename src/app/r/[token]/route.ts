import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordReviewClick } from '@/lib/reviews/review-manager'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params

  if (!token) {
    return NextResponse.json({ error: 'Missing review token' }, { status: 400 })
  }

  // Use service role admin client to record click safely
  const supabase = createAdminClient()

  const result = await recordReviewClick(supabase, token)

  if (!result.success || !result.googleReviewUrl) {
    return NextResponse.json({ error: result.error || 'Review request not found' }, { status: 404 })
  }

  // 302 Found redirect to legitimate Google review page
  return NextResponse.redirect(result.googleReviewUrl, 302)
}
