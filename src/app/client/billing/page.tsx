'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ClientBillingPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/client/settings?tab=billing')
  }, [router])

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-zinc-400">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      <span className="text-xs font-medium">Redirecting to Billing & Subscription settings...</span>
    </div>
  )
}
