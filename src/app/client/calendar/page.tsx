'use client'
export const dynamic = 'force-dynamic'

import React, { Suspense } from 'react'
import { ScheduleDispatchHub } from '@/components/schedule/schedule-dispatch-hub'
import { Skeleton } from '@/components/ui/skeleton'

// Un-onboarded profile redirects to /client/onboarding via ScheduleDispatchHub
export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <ScheduleDispatchHub defaultView="agenda" />
    </Suspense>
  )
}
