/**
 * CaptoDesk Canonical Role-Based Access Control (RBAC)
 * Defines canonical roles, permission sets, and evaluation functions.
 */

export type CanonicalRole = 'owner' | 'admin' | 'member' | 'super_admin'

export type Action =
  | 'org:view'
  | 'org:update'
  | 'org:delete'
  | 'org:billing'
  | 'team:view'
  | 'team:invite'
  | 'team:remove'
  | 'automations:view'
  | 'automations:update'
  | 'messages:read'
  | 'messages:send'
  | 'contacts:read'
  | 'contacts:manage'
  | 'leads:read'
  | 'leads:manage'
  | 'appointments:read'
  | 'appointments:manage'
  | 'reviews:send'
  | 'reviews:view'
  | 'reviews:manage'
  | 'admin:all'

/**
 * Normalizes pre-existing and legacy database role strings into canonical roles
 */
export function normalizeRole(role: string | null | undefined): CanonicalRole {
  if (!role) return 'member'
  const normalized = role.toLowerCase().trim()
  if (normalized === 'super_admin') return 'super_admin'
  if (normalized === 'owner') return 'owner'
  if (normalized === 'admin' || normalized === 'client_admin') return 'admin'
  if (normalized === 'member' || normalized === 'dispatcher') return 'member'
  return 'member'
}

/**
 * Strict role-to-permissions capability mapping
 */
const ROLE_PERMISSIONS: Record<CanonicalRole, Set<Action>> = {
  super_admin: new Set([
    'org:view', 'org:update', 'org:delete', 'org:billing',
    'team:view', 'team:invite', 'team:remove',
    'automations:view', 'automations:update',
    'messages:read', 'messages:send',
    'contacts:read', 'contacts:manage',
    'leads:read', 'leads:manage',
    'appointments:read', 'appointments:manage',
    'reviews:send', 'reviews:view', 'reviews:manage',
    'admin:all'
  ]),
  owner: new Set([
    'org:view', 'org:update', 'org:delete', 'org:billing',
    'team:view', 'team:invite', 'team:remove',
    'automations:view', 'automations:update',
    'messages:read', 'messages:send',
    'contacts:read', 'contacts:manage',
    'leads:read', 'leads:manage',
    'appointments:read', 'appointments:manage',
    'reviews:send', 'reviews:view', 'reviews:manage'
  ]),
  admin: new Set([
    'org:view', 'org:update',
    'team:view', 'team:invite', 'team:remove',
    'automations:view', 'automations:update',
    'messages:read', 'messages:send',
    'contacts:read', 'contacts:manage',
    'leads:read', 'leads:manage',
    'appointments:read', 'appointments:manage',
    'reviews:send', 'reviews:view', 'reviews:manage'
  ]),
  member: new Set([
    'org:view',
    'team:view',
    'automations:view',
    'messages:read', 'messages:send',
    'contacts:read', 'contacts:manage',
    'leads:read', 'leads:manage',
    'appointments:read', 'appointments:manage',
    'reviews:send', 'reviews:view'
  ])
}

/**
 * Determines whether a given role holds permission to execute a specific action
 */
export function hasPermission(rawRole: string | null | undefined, action: Action): boolean {
  const canonical = normalizeRole(rawRole)
  const permissions = ROLE_PERMISSIONS[canonical]
  if (!permissions) return false
  return permissions.has(action)
}
