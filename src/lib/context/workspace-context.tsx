'use client'

import React, { createContext, useContext } from 'react'

export interface WorkspaceContextValue {
  orgId: string | null
  orgName: string
  orgSlug: string
  orgPhone: string
  orgTimezone: string
  orgIndustry: string
  subscriptionStatus: string | null
  planId: string | null
  isSuperAdmin: boolean
  role: string | null
  userId: string | null
  userEmail: string | null
  userFullName: string | null
  unreadTotal: number
}

export const WorkspaceContext = createContext<WorkspaceContextValue>({
  orgId: null,
  orgName: '',
  orgSlug: '',
  orgPhone: '',
  orgTimezone: 'America/Chicago',
  orgIndustry: 'general',
  subscriptionStatus: 'free',
  planId: 'free',
  isSuperAdmin: false,
  role: null,
  userId: null,
  userEmail: null,
  userFullName: null,
  unreadTotal: 0
})

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
