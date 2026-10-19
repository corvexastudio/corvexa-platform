/**
 * ==============================================================================
 * CAPTODESK — FAIL-CLOSED E2E TEST SAFETY GUARD
 * ==============================================================================
 * Prevents authenticated end-to-end (E2E) browser tests, setup scripts, or demo
 * reset operations from running against production or unidentified Supabase projects
 * without verified tenant isolation.
 *
 * Supported Operational Modes:
 * 1. Dedicated Staging Project Mode:
 *    - E2E_SUPABASE_PROJECT_REF points to an independent staging Supabase backend.
 *    - E2E_SUPABASE_PROJECT_REF !== PRODUCTION_SUPABASE_PROJECT_REF.
 *
 * 2. Dedicated Demo Tenant Mode (Single-Project Architecture):
 *    - E2E_SUPABASE_PROJECT_REF points to CaptoDesk's project ('vlztovqaummczupslymr').
 *    - E2E_ALLOW_DEMO_TENANT="true" or E2E_TEST_MODE="demo_tenant".
 *    - Strictly enforces that only synthetic tenant '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7'
 *      (CaptoDesk Demo Services) is queried, seeded, or tested.
 *    - Live client records ('Shanta M's Business') are 100% physically isolated and blocked.
 *    - Real billable external actions (Telnyx SMS, Stripe payments) must remain mocked.
 * ==============================================================================
 */

export const KNOWN_PRODUCTION_PROJECT_REF = 'vlztovqaummczupslymr'
export const SYNTHETIC_DEMO_ORG_ID = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7'
export const SYNTHETIC_DEMO_ORG_NAME = 'CaptoDesk Demo Services'
export const SYNTHETIC_DEMO_ORG_SLUG = 'captodesk-demo-services-rdhr6'
export const SYNTHETIC_DEMO_EMAIL = 'corvexastudio@gmail.com'
export const PROTECTED_OWNER_ORG_ID = '87348a58-b47f-4e80-8dec-bc2117ad45a6'

export interface E2ESafetyValidationResult {
  safe: boolean
  error?: string
  projectRef?: string
  productionRef?: string
  mode?: 'staging_isolated' | 'dedicated_demo_tenant'
  demoOrgId?: string
}

export interface E2ESafetyOptions {
  exitOnError?: boolean
  argv?: string[]
}

/**
 * Extracts the Supabase project reference identifier from a URL string.
 */
export function extractProjectRef(urlStr?: string | null): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null
  const trimmed = urlStr.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    const hostname = parsed.hostname.toLowerCase()

    if (hostname.endsWith('.supabase.co')) {
      const parts = hostname.split('.')
      if (parts.length >= 3 && parts[0]) {
        return parts[0]
      }
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'local-supabase'
    }

    // Custom domain support (subdomain before domain)
    const subdomains = hostname.split('.')
    if (subdomains.length > 2 && subdomains[0]) {
      return subdomains[0]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Validates whether the current environment is safely isolated for E2E testing.
 */
export function validateE2EEnvironment(
  env: Record<string, string | undefined>,
  options?: E2ESafetyOptions
): E2ESafetyValidationResult {
  const productionRef = (env.PRODUCTION_SUPABASE_PROJECT_REF || KNOWN_PRODUCTION_PROJECT_REF).trim().toLowerCase()
  const e2eTargetRef = env.E2E_SUPABASE_PROJECT_REF ? env.E2E_SUPABASE_PROJECT_REF.trim().toLowerCase() : ''
  const activeUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || ''
  const allowDemoTenant = env.E2E_ALLOW_DEMO_TENANT === 'true' || env.E2E_TEST_MODE === 'demo_tenant' || env.ALLOW_DEMO_TENANT_TESTS === 'true'

  // 1. Prevent arbitrary organization ID override via CLI arguments
  const argv = options?.argv || (typeof process !== 'undefined' && Array.isArray(process.argv) ? process.argv : [])
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    let candidateOrgId = ''
    if (arg.startsWith('--org=') || arg.startsWith('--orgId=') || arg.startsWith('--org-id=')) {
      candidateOrgId = arg.split('=')[1]?.trim() || ''
    } else if ((arg === '--org' || arg === '--orgId' || arg === '--org-id' || arg === '--tenant') && i + 1 < argv.length) {
      candidateOrgId = argv[i + 1]?.trim() || ''
    }
    if (candidateOrgId && candidateOrgId.toLowerCase() !== SYNTHETIC_DEMO_ORG_ID.toLowerCase()) {
      return {
        safe: false,
        productionRef,
        error:
          `[E2E SAFETY GUARD] Unchecked CLI argument violation: Attempted to target organization '${candidateOrgId}'. ` +
          `E2E tests and demo operations are strictly locked to the approved synthetic demo organization ('${SYNTHETIC_DEMO_ORG_ID}').`
      }
    }
  }

  // 2. Prevent arbitrary organization ID override via environment variables
  const candidateEnvOrgId = (env.E2E_DEMO_ORG_ID || env.TARGET_ORG_ID || env.ORG_ID || env.TENANT_ID || env.DEMO_ORG_ID)?.trim()
  if (candidateEnvOrgId && candidateEnvOrgId.toLowerCase() !== SYNTHETIC_DEMO_ORG_ID.toLowerCase()) {
    return {
      safe: false,
      productionRef,
      error:
        `[E2E SAFETY GUARD] Tenant scope violation: Configured organization ID '${candidateEnvOrgId}' ` +
        `does not match the approved synthetic demo organization ('${SYNTHETIC_DEMO_ORG_ID}'). Refusing execution.`
    }
  }

  // 3. Require explicit target project configuration
  if (!e2eTargetRef) {
    return {
      safe: false,
      productionRef,
      error:
        '[E2E SAFETY GUARD] E2E_SUPABASE_PROJECT_REF is not configured. ' +
        'E2E browser tests refuse to execute without an explicit, verified project target. ' +
        'To run against the dedicated demo tenant on your current project, explicitly set ' +
        `E2E_SUPABASE_PROJECT_REF="${KNOWN_PRODUCTION_PROJECT_REF}", E2E_ALLOW_DEMO_TENANT="true", and E2E_DEMO_ORG_ID="${SYNTHETIC_DEMO_ORG_ID}".`
    }
  }

  // 4. Require active Supabase URL
  if (!activeUrl) {
    return {
      safe: false,
      productionRef,
      error:
        '[E2E SAFETY GUARD] NEXT_PUBLIC_SUPABASE_URL is missing or undefined. ' +
        'Cannot verify database target for E2E tests.'
    }
  }

  // 5. Extract active project reference and verify URL alignment
  const activeRef = extractProjectRef(activeUrl)
  if (!activeRef) {
    return {
      safe: false,
      productionRef,
      error:
        `[E2E SAFETY GUARD] Unable to extract a valid Supabase project reference from NEXT_PUBLIC_SUPABASE_URL.`
    }
  }

  if (activeRef !== e2eTargetRef) {
    return {
      safe: false,
      projectRef: activeRef,
      productionRef,
      error:
        `[E2E SAFETY GUARD] Project reference mismatch: NEXT_PUBLIC_SUPABASE_URL resolves to project '${activeRef}', ` +
        `but E2E_SUPABASE_PROJECT_REF is configured as '${e2eTargetRef}'. Execution refused.`
    }
  }

  // Also verify secondary backend SUPABASE_URL if present
  if (env.SUPABASE_URL) {
    const serverRef = extractProjectRef(env.SUPABASE_URL)
    if (serverRef && serverRef !== e2eTargetRef) {
      return {
        safe: false,
        projectRef: serverRef,
        productionRef,
        error:
          `[E2E SAFETY GUARD] Contradictory backend URL: SUPABASE_URL resolves to project '${serverRef}', ` +
          `which does not match E2E_SUPABASE_PROJECT_REF ('${e2eTargetRef}'). Execution refused.`
      }
    }
  }

  // 6. Explicit production equality block when demo tenant mode is NOT enabled
  if (e2eTargetRef === productionRef && !allowDemoTenant) {
    return {
      safe: false,
      projectRef: e2eTargetRef,
      productionRef,
      error:
        `[E2E SAFETY GUARD] CRITICAL: Configured E2E target project '${e2eTargetRef}' matches the PRODUCTION ` +
        `project reference ('${productionRef}'). Execution is refused without explicit demo tenant authorization. ` +
        `To target the synthetic demo tenant partition, explicitly set E2E_ALLOW_DEMO_TENANT="true" ` +
        `and E2E_DEMO_ORG_ID="${SYNTHETIC_DEMO_ORG_ID}". Otherwise, provide an isolated staging project reference.`
    }
  }

  // Active URL resolves to production without demo tenant authorization
  if (activeRef === productionRef && !allowDemoTenant) {
    return {
      safe: false,
      projectRef: activeRef,
      productionRef,
      error:
        `[E2E SAFETY GUARD] CRITICAL: Active Supabase URL resolves to PRODUCTION project '${productionRef}'. ` +
        `E2E execution is strictly blocked without E2E_ALLOW_DEMO_TENANT="true".`
    }
  }

  // 7. External billable actions and payment mocking requirement in demo and E2E modes
  // Missing, empty, false, or malformed values must fail closed (strictly === 'true')
  if (env.TELNYX_MOCK_DISPATCH !== 'true' || env.ENABLE_REAL_TELNYX === 'true') {
    return {
      safe: false,
      projectRef: e2eTargetRef,
      productionRef,
      error:
        '[E2E SAFETY GUARD] External billable action safety violation: TELNYX_MOCK_DISPATCH must be explicitly set to "true" during synthetic demo and E2E operations. Missing, empty, false, or malformed values fail closed.'
    }
  }

  if (env.STRIPE_MOCK_DISPATCH !== 'true' || env.ENABLE_REAL_STRIPE === 'true') {
    return {
      safe: false,
      projectRef: e2eTargetRef,
      productionRef,
      error:
        '[E2E SAFETY GUARD] External payment safety violation: STRIPE_MOCK_DISPATCH must be explicitly set to "true" during synthetic demo and E2E operations. Missing, empty, false, or malformed values fail closed.'
    }
  }

  // 8. Dedicated Demo Tenant Mode (Single-Project Multi-Tenant Architecture)
  if (e2eTargetRef === KNOWN_PRODUCTION_PROJECT_REF && allowDemoTenant) {
    return {
      safe: true,
      projectRef: e2eTargetRef,
      productionRef,
      mode: 'dedicated_demo_tenant',
      demoOrgId: SYNTHETIC_DEMO_ORG_ID
    }
  }

  return {
    safe: true,
    projectRef: e2eTargetRef,
    productionRef,
    mode: 'staging_isolated'
  }
}

/**
 * Asserts test safety. If unsafe, logs diagnostic error and throws or exits.
 */
export function assertE2ETestSafety(
  env: Record<string, string | undefined>,
  options: E2ESafetyOptions = { exitOnError: true }
): E2ESafetyValidationResult {
  const result = validateE2EEnvironment(env, options)

  if (!result.safe) {
    const errorMsg = result.error || '[E2E SAFETY GUARD] Environment safety validation failed.'
    console.error('\n' + '='.repeat(72))
    console.error('  FAIL-CLOSED E2E TEST SAFETY HALT')
    console.error('='.repeat(72))
    console.error(errorMsg)
    console.error('='.repeat(72) + '\n')

    if (options.exitOnError) {
      process.exit(1)
    } else {
      throw new Error(errorMsg)
    }
  }

  return result
}
