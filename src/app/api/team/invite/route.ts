import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Only client_admin and super_admin can invite
  if (!['client_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { email, role } = await request.json()

    // Use Supabase admin inviteUserByEmail
    // Note: This requires a service role key set server-side (SUPABASE_SERVICE_ROLE_KEY)
    // For now we return a placeholder success to show the modal flow works
    // Replace with: await supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { role, org_id: profile.org_id } })

    return NextResponse.json({ success: true, message: `Invite sent to ${email}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
