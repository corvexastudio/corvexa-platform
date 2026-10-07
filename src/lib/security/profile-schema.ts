import { z } from 'zod'

/**
 * Forbidden Privilege Escalation Keys:
 * Ordinary profile update operations must never accept these fields from user payloads.
 */
export const FORBIDDEN_ESCALATION_KEYS = [
  'role',
  'org_id',
  'organization_id',
  'permissions',
  'is_owner',
  'owner',
  'billing_role',
  'is_super_admin',
  'super_admin',
  'tenant_id'
] as const

/**
 * Strict Profile Update Schema:
 * ONLY non-privileged user profile fields are accepted.
 * Strips and rejects any administrative, role, or tenant overrides.
 */
export const profileUpdateSchema = z
  .object({
    first_name: z.string().trim().max(100).optional(),
    last_name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(30).optional(),
    avatar_url: z.string().trim().max(500).optional()
  })
  .strict()

