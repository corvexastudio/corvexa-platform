import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { fetchConversationMessagesPaginated } from '@/lib/services/sms-handler'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('messages:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase, isSuperAdmin } = tenantResult
  const { searchParams } = new URL(request.url)

  const conversationId = searchParams.get('conversation_id')
  if (!conversationId) {
    return NextResponse.json(
      { error: 'Missing required parameter: conversation_id' },
      { status: 400 }
    )
  }

  // Tenant scoping check
  let convQuery = supabase
    .from('conversations')
    .select('id, org_id')
    .eq('id', conversationId)

  if (!isSuperAdmin) {
    convQuery = convQuery.eq('org_id', orgId)
  }

  const { data: conv, error: convError } = await convQuery.maybeSingle()
  if (convError || !conv) {
    return NextResponse.json(
      { error: 'Conversation not found or access denied' },
      { status: 404 }
    )
  }

  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 50
  const beforeCursor = searchParams.get('before')
  const afterCursor = searchParams.get('after')

  try {
    const result = await fetchConversationMessagesPaginated(supabase, {
      conversationId,
      limit,
      beforeCursor,
      afterCursor
    })

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve messages' },
      { status: 500 }
    )
  }
}
