import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

const DEFAULT_SUPABASE_URL = 'https://vlztovqaummczupslymr.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-oDOORboDGd7KSTXZYCzbQ_X46fc_1w'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

  if (typeof window === 'undefined') {
    return createBrowserClient(url, anonKey)
  }

  if (!client) {
    client = createBrowserClient(url, anonKey)
  }

  return client
}
