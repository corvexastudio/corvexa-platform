import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, phone } = await request.json()
    
    // Get user's org
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

    // Insert activity log
    const { error } = await supabase.from('activity_logs').insert({
      org_id: profile.org_id,
      type: 'review_invite',
      contact_name: name,
      contact_phone: phone,
      status: 'pending',
      source: 'Dashboard Quick Action'
    })

    if (error) throw error

    // Here you would integrate with Twilio to actually send the SMS
    // For now, we return success as we've logged it.

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
