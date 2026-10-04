/**
 * CaptoDesk Production Environment Configuration & Validation Engine
 * 
 * Enforces strict environment separation (development, staging, production, test),
 * validates all required secrets, and fails safely with actionable diagnostic output.
 */

export type EnvironmentTier = 'development' | 'staging' | 'production' | 'test'

export interface EnvValidationResult {
  ok: boolean
  tier: EnvironmentTier
  errors: string[]
  warnings: string[]
  config: SafeEnvConfig
}

export interface SafeEnvConfig {
  tier: EnvironmentTier
  supabaseUrl: string
  hasSupabaseAnonKey: boolean
  hasSupabaseServiceRoleKey: boolean
  appUrl: string
  hasTelnyxApiKey: boolean
  hasTelnyxPublicKey: boolean
  telnyxDefaultPhone?: string
  hasStripeSecretKey: boolean
  stripeMode: 'live' | 'test' | 'missing'
  hasStripeWebhookSecret: boolean
  hasCronSecret: boolean
  superAdminEmails: string[]
}

/**
 * Resolves current environment tier
 */
export function getEnvironmentTier(envSource: NodeJS.ProcessEnv = process.env): EnvironmentTier {
  const env = (envSource.APP_ENV || envSource.NODE_ENV || 'development').toLowerCase()
  if (env === 'production' || env === 'prod') return 'production'
  if (env === 'staging' || env === 'stage') return 'staging'
  if (env === 'test') return 'test'
  return 'development'
}

export const isProduction = (): boolean => getEnvironmentTier() === 'production'
export const isStaging = (): boolean => getEnvironmentTier() === 'staging'
export const isDevelopment = (): boolean => getEnvironmentTier() === 'development'
export const isTest = (): boolean => getEnvironmentTier() === 'test'

/**
 * Validates the runtime environment against required production specifications
 */
export function validateEnvironment(envSource: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const tier = getEnvironmentTier(envSource)
  const errors: string[] = []
  const warnings: string[] = []

  const supabaseUrl = envSource.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = envSource.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const supabaseServiceKey = envSource.SUPABASE_SERVICE_ROLE_KEY || ''
  const appUrl = envSource.NEXT_PUBLIC_APP_URL || ''
  const telnyxApiKey = envSource.TELNYX_API_KEY || ''
  const telnyxPublicKey = envSource.TELNYX_PUBLIC_KEY || ''
  const telnyxPhone = envSource.TELNYX_PHONE_NUMBER || ''
  const stripeSecretKey = envSource.STRIPE_SECRET_KEY || ''
  const stripeWebhookSecret = envSource.STRIPE_WEBHOOK_SECRET || ''
  const cronSecret = envSource.CRON_SECRET || ''
  const superAdminEmailsStr = envSource.SUPER_ADMIN_EMAILS || ''

  // 1. Supabase Validation
  if (!supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required.')
  } else if (!supabaseUrl.startsWith('https://') && tier === 'production') {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must use HTTPS protocol in production.')
  }

  if (!supabaseAnonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for client authentication.')
  }

  if (!supabaseServiceKey) {
    if (tier === 'production') {
      errors.push('SUPABASE_SERVICE_ROLE_KEY is required in production for background automation processing and webhook handling.')
    } else {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY is absent. Some background services may fail.')
    }
  }

  // 2. Application Base URL
  if (!appUrl) {
    if (tier === 'production') {
      errors.push('NEXT_PUBLIC_APP_URL is required in production (e.g. https://app.corvexastudio.com).')
    } else {
      warnings.push('NEXT_PUBLIC_APP_URL is not set. Defaulting to http://localhost:3000.')
    }
  } else if (!appUrl.startsWith('https://') && tier === 'production') {
    errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in production.')
  }

  // 3. Telephony (Telnyx)
  if (!telnyxApiKey) {
    if (tier === 'production') {
      errors.push('TELNYX_API_KEY is required for production SMS and voice recovery.')
    } else {
      warnings.push('TELNYX_API_KEY is not set. Running in simulated telephony mode.')
    }
  }

  if (!telnyxPublicKey && tier === 'production') {
    warnings.push('TELNYX_PUBLIC_KEY is missing. Webhooks will not be cryptographically validated with Ed25519.')
  }

  // 4. Invoicing & Billing (Stripe)
  let stripeMode: 'live' | 'test' | 'missing' = 'missing'
  if (stripeSecretKey) {
    if (stripeSecretKey.startsWith('sk_live_')) {
      stripeMode = 'live'
    } else if (stripeSecretKey.startsWith('sk_test_')) {
      stripeMode = 'test'
      if (tier === 'production') {
        warnings.push('STRIPE_SECRET_KEY is using a test key (sk_test_...) in a production environment.')
      }
    }
  } else {
    if (tier === 'production') {
      warnings.push('STRIPE_SECRET_KEY is not configured. Customer checkout flows will run in simulation mode.')
    }
  }

  if (!stripeWebhookSecret && tier === 'production' && stripeSecretKey) {
    warnings.push('STRIPE_WEBHOOK_SECRET is not set. Stripe webhook signatures cannot be validated.')
  }

  // 5. Worker Cron Security
  if (!cronSecret && tier === 'production') {
    warnings.push('CRON_SECRET is not set. Background automation worker endpoint is only protected by rate limiting.')
  }

  // Parse super admin emails
  const superAdminEmails = superAdminEmailsStr
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (superAdminEmails.length === 0 && tier === 'production') {
    warnings.push('SUPER_ADMIN_EMAILS is not configured. Super admin email restriction is inactive.')
  }

  const config: SafeEnvConfig = {
    tier,
    supabaseUrl: supabaseUrl || 'http://localhost:54321',
    hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    hasSupabaseServiceRoleKey: Boolean(supabaseServiceKey),
    appUrl: appUrl || 'http://localhost:3000',
    hasTelnyxApiKey: Boolean(telnyxApiKey),
    hasTelnyxPublicKey: Boolean(telnyxPublicKey),
    telnyxDefaultPhone: telnyxPhone || undefined,
    hasStripeSecretKey: Boolean(stripeSecretKey),
    stripeMode,
    hasStripeWebhookSecret: Boolean(stripeWebhookSecret),
    hasCronSecret: Boolean(cronSecret),
    superAdminEmails
  }

  return {
    ok: errors.length === 0,
    tier,
    errors,
    warnings,
    config
  }
}

/**
 * Returns safe environment configuration.
 * Throws a formatted error if critical configuration is missing in production.
 */
export function getRequiredEnv(): SafeEnvConfig {
  const validation = validateEnvironment()
  if (!validation.ok && validation.tier === 'production') {
    const errorDetails = validation.errors.map(err => `  - ${err}`).join('\n')
    throw new Error(`[CRITICAL CONFIGURATION ERROR] Production environment validation failed:\n${errorDetails}`)
  }
  return validation.config
}
