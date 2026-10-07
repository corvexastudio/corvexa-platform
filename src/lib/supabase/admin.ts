import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only privileged Supabase admin client helper.
 * 
 * SECURITY MANDATE:
 * - Privileged backend operations (automations, webhooks, invitations, public token resolution)
 *   MUST use SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security safely.
 * - This helper must NEVER fall back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * - In production, missing SUPABASE_SERVICE_ROLE_KEY is a fatal configuration error.
 * - Bundling or invoking this helper on the client side is prevented at build and runtime.
 */

// Runtime protection against client-side execution
if (typeof window !== 'undefined') {
  throw new Error('FATAL: createAdminClient cannot be invoked or bundled in a client-side environment.')
}

let cachedAdminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient
  }
  cachedAdminClient = createAdminClient()
  return cachedAdminClient
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const isProd = process.env.NODE_ENV === 'production'

  if (!url) {
    const errorMsg = '[CRITICAL] NEXT_PUBLIC_SUPABASE_URL is not configured.'
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  if (!serviceRoleKey) {
    const diagnostic = '[SECURITY FATAL] SUPABASE_SERVICE_ROLE_KEY is required for privileged database operations, but was not found in the environment. Downgrading to anon key is prohibited.'
    console.error(diagnostic)

    if (isProd) {
      throw new Error(diagnostic)
    }

    // In non-production/test environments where the service key is deliberately omitted,
    // throw an explicit error to prevent silent privilege escalation or broken assumptions.
    throw new Error(diagnostic)
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
