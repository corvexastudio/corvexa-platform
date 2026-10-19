'use client'

import React, { createContext, useContext } from 'react'

export interface WorkspaceContextValue {
  orgId: string | null
  orgName: string
  orgPhone: string
  orgTimezone: string
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
  orgPhone: '',
  orgTimezone: 'America/Chicago',
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
