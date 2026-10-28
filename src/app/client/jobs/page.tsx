'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Forward legacy /client/jobs route to unified Schedule & Jobs hub with Dispatch List view
function JobsRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '')
    if (!params.has('view')) {
      params.set('view', 'list')
    }
    const queryString = params.toString()
    const target = `/client/calendar${queryString ? `?${queryString}` : '?view=list'}`
    router.replace(target)
  }, [router, searchParams])

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-zinc-400">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      <span className="text-xs font-semibold">Opening Schedule & Jobs (Dispatch List)...</span>
    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Opening Schedule & Jobs...</span>
        </div>
      }
    >
      <JobsRedirectContent />
    </Suspense>
  )
}
