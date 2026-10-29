import { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { getIndustryPreset } from '../constants/industries.ts'
import { createClaimToken } from '../security/claim-token.ts'

export interface AdminOnboardInput {
  businessName: string
  slug?: string
  industry: string
  ownerName?: string
  ownerCellPhone: string
  shopPhone?: string
  ownerEmail?: string
  primaryCarrier?: 'verizon' | 'att' | 'tmobile' | 'other'
  timezone?: string
  googleReviewUrl?: string
  initialPlanStatus?: 'free' | 'solo' | 'fleet'
}

export interface AdminOnboardResult {
  success: boolean
  organization: {
    id: string
    name: string
    slug: string
    industry: string
    timezone: string
    ownerPhone: string
    shopPhone: string
    primaryCarrier: string
    subscriptionStatus: string
    planId: string
  }
  owner: {
    id: string
    email: string
    fullName: string
    phone: string
    isPlaceholderEmail: boolean
  }
  practiceJob: {
    id: string
    jobNumber: string
    title: string
  }
  claimUrl: string
  publicBookingUrl: string
  welcomeSmsText: string
}

/**
 * Onboards a contractor organization phone-first without requiring email or password setup on phone call
 */
export async function adminOnboardTenant(
  supabase: SupabaseClient,
  input: AdminOnboardInput,
  options?: { baseUrl?: string; adminAuthClient?: any; bookingBaseUrl?: string }
): Promise<AdminOnboardResult> {
  const rawBusinessName = (input.businessName || '').trim()
  if (!rawBusinessName) {
    throw new Error('Business name is required.')
  }

  const normCell = normalizePhoneToE164(input.ownerCellPhone)
  if (!normCell.isValid || !normCell.e164) {
    throw new Error(normCell.error || 'A valid mobile cell phone is required for sending the claim link.')
  }

  const industryPreset = getIndustryPreset(input.industry)

  // Generate unique slug
  const baseSlug = (input.slug || rawBusinessName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'contractor'

  const { data: existingSlug } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', baseSlug)
    .maybeSingle()

  const finalSlug = existingSlug
    ? `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`
    : baseSlug

  // Resolve Phone-First Email
  let effectiveEmail = (input.ownerEmail || '').trim().toLowerCase()
  let isPlaceholderEmail = false
  if (!effectiveEmail) {
    const cleanDigits = normCell.e164.replace(/\D/g, '')
    effectiveEmail = `phone.${cleanDigits}@claim.captodesk.com`
    isPlaceholderEmail = true
  }

  const effectiveOwnerName = (input.ownerName || '').trim() || `${rawBusinessName} Owner`

  // Supabase Auth User Creation
  let userId = crypto.randomUUID()
  const generatedPassword = crypto.randomUUID() + '!Aa1'
  const authAdmin = options?.adminAuthClient || supabase.auth?.admin

  if (authAdmin?.createUser) {
    try {
      const createRes = await authAdmin.createUser({
        email: effectiveEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: effectiveOwnerName,
          owner_phone: normCell.e164,
          is_placeholder_email: isPlaceholderEmail
        }
      })

      if (createRes.data?.user?.id) {
        userId = createRes.data.user.id
      } else if (createRes.error?.message?.toLowerCase().includes('already')) {
        // User exists with this email, fetch user
        if (authAdmin.listUsers) {
          const listRes = await authAdmin.listUsers()
          const existingUser = listRes.data?.users?.find(
            (u: any) => u.email?.toLowerCase() === effectiveEmail.toLowerCase()
          )
          if (existingUser?.id) {
            userId = existingUser.id
            if (authAdmin.updateUserById) {
              await authAdmin.updateUserById(userId, {
                user_metadata: {
                  full_name: effectiveOwnerName,
                  owner_phone: normCell.e164,
                  is_placeholder_email: isPlaceholderEmail
                }
              })
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[Admin Onboarding] Auth user creation warning:', e.message)
    }
  }

  // Organization Payload
  const orgId = crypto.randomUUID()
  const initialPlan = input.initialPlanStatus || 'free'
  const subscriptionStatus = initialPlan === 'free' ? 'active' : 'trial'

  let normalizedShopPhone = normCell.e164
  if (input.shopPhone && input.shopPhone.trim()) {
    const normShop = normalizePhoneToE164(input.shopPhone)
    if (normShop.isValid && normShop.e164) {
      normalizedShopPhone = normShop.e164
    }
  }

  const orgPayload = {
    id: orgId,
    name: rawBusinessName,
    slug: finalSlug,
    industry: industryPreset.id,
    timezone: input.timezone || 'America/Chicago',
    owner_phone: normCell.e164,
    phone_number: normalizedShopPhone,
    carrier: input.primaryCarrier || 'other',
    primary_carrier: input.primaryCarrier || 'other',
    google_review_url: input.googleReviewUrl?.trim() || null,
    subscription_status: subscriptionStatus,
    plan_id: initialPlan,
    is_missed_call_active: true,
    is_review_engine_active: true,
    auto_reply_template: industryPreset.templates.auto_reply.replace(/—|–/g, ' - '),
    after_hours_template: industryPreset.templates.after_hours.replace(/—|–/g, ' - '),
    busy_template: industryPreset.templates.busy.replace(/—|–/g, ' - ')
  }

  const { error: orgError } = await supabase.from('organizations').insert(orgPayload)
  if (orgError) {
    // Retry without optional columns if DB schema lacks them
    if (orgError.code === '42703') {
      const strippedPayload: Record<string, any> = {
        id: orgId,
        name: rawBusinessName,
        slug: finalSlug,
        owner_phone: normCell.e164,
        phone_number: normalizedShopPhone,
        subscription_status: subscriptionStatus,
        is_missed_call_active: true,
        auto_reply_template: industryPreset.templates.auto_reply.replace(/—|–/g, ' - ')
      }
      const retryOrg = await supabase.from('organizations').insert(strippedPayload)
      if (retryOrg.error) {
        throw new Error(`Failed to create organization: ${retryOrg.error.message}`)
      }
    } else {
      throw new Error(`Failed to create organization: ${orgError.message}`)
    }
  }

  // Profile Upsert (Guarantees owner lands on dashboard, never redirected to onboarding)
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    org_id: orgId,
    role: 'owner',
    email: effectiveEmail,
    full_name: effectiveOwnerName,
    phone: normCell.e164,
    is_active: true
  })

  if (profileErr && profileErr.code === '42703') {
    // Retry without phone column if schema lacks it
    await supabase.from('profiles').upsert({
      id: userId,
      org_id: orgId,
      role: 'owner',
      email: effectiveEmail,
      full_name: effectiveOwnerName,
      is_active: true
    })
  }

  // Seed Starter Trade Services
  try {
    for (const svc of industryPreset.services) {
      await supabase.from('services').upsert(
        {
          org_id: orgId,
          name: svc.name,
          description: svc.description,
          duration_minutes: svc.duration_minutes,
          price: svc.price,
          requires_address: svc.requires_address,
          is_active: svc.is_active,
          sort_order: svc.sort_order
        },
        { onConflict: 'org_id,name', ignoreDuplicates: true }
      )
    }
  } catch (err: any) {
    console.warn('[Admin Onboarding] Services seed warning:', err.message)
  }

  // Seed Sandbox Practice Job
  const practiceContactId = crypto.randomUUID()
  const practiceJobId = crypto.randomUUID()
  const practiceJobNumber = 'PRACTICE-101'
  const practiceJobTitle = '🧪 [PRACTICE] Water Heater Diagnostic ($89.00)'

  try {
    await supabase.from('contacts').insert({
      id: practiceContactId,
      org_id: orgId,
      name: '[PRACTICE] Alex Homeowner',
      phone: '+15550199999',
      address: '123 Practice Lane, Test City, TX 75001',
      lifecycle_status: 'active'
    })

    const now = new Date()
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)

    await supabase.from('jobs').insert({
      id: practiceJobId,
      org_id: orgId,
      contact_id: practiceContactId,
      job_number: practiceJobNumber,
      title: practiceJobTitle,
      status: 'scheduled',
      scheduled_start: now.toISOString(),
      scheduled_end: inOneHour.toISOString(),
      notes: 'SANDBOX_PRACTICE_JOB: Tap the buttons below to test 1-click dispatch, quotes, and invoices!'
    })
  } catch (err: any) {
    console.warn('[Admin Onboarding] Practice job seed warning:', err.message)
  }

  // Seed Missed Call Automation Settings
  try {
    await supabase.from('automation_settings').insert({
      org_id: orgId,
      module_key: 'missed_call_recovery',
      is_enabled: true,
      config: {
        cooldown_hours: 24,
        min_call_duration_seconds: 3
      }
    })
  } catch {
    // non-fatal
  }

  // Generate 1-Tap Claim Link & Welcome SMS
  const baseUrl = options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://app.captodesk.com'
  const claimToken = createClaimToken({ userId, email: effectiveEmail, orgId })
  const claimUrl = `${baseUrl}/claim/${claimToken}`
  const publicBookingUrl = options?.bookingBaseUrl
    ? `${options.bookingBaseUrl}/${finalSlug}`
    : (baseUrl.includes('captodesk.com') ? `https://book.captodesk.com/${finalSlug}` : `${baseUrl}/book/${finalSlug}`)
  const welcomeSmsText = `Hey ${effectiveOwnerName}! I just set up the free online booking page for ${rawBusinessName} so customers on Google Maps can book slots directly: ${publicBookingUrl} - Tap this link on your cell phone to open your dashboard & test your practice job (no password needed): ${claimUrl}`

  return {
    success: true,
    organization: {
      id: orgId,
      name: rawBusinessName,
      slug: finalSlug,
      industry: industryPreset.id,
      timezone: input.timezone || 'America/Chicago',
      ownerPhone: normCell.e164,
      shopPhone: normalizedShopPhone,
      primaryCarrier: input.primaryCarrier || 'other',
      subscriptionStatus,
      planId: initialPlan
    },
    owner: {
      id: userId,
      email: effectiveEmail,
      fullName: effectiveOwnerName,
      phone: normCell.e164,
      isPlaceholderEmail
    },
    practiceJob: {
      id: practiceJobId,
      jobNumber: practiceJobNumber,
      title: practiceJobTitle
    },
    claimUrl,
    publicBookingUrl,
    welcomeSmsText
  }
}
