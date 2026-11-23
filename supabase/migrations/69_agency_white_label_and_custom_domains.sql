-- ==============================================================================
-- CAPTODESK MIGRATION 69: AGENCY WHITE-LABELING AND CUSTOM DOMAIN CNAME SUPPORT
-- Supports Phase 2 White-Labeling, custom CNAME mapping, and agency brand themes.
-- ==============================================================================

-- 1. Add custom_domain and branding columns to partner_agencies
ALTER TABLE public.partner_agencies
ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

ALTER TABLE public.partner_agencies
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{
  "logo_url": null,
  "favicon_url": null,
  "primary_color": null,
  "accent_color": null,
  "portal_title": null,
  "hide_powered_by": false,
  "custom_domain_status": "pending_dns"
}'::jsonb;

-- 2. Performance index for custom domain hostname lookups
CREATE INDEX IF NOT EXISTS idx_partner_agencies_custom_domain
ON public.partner_agencies(custom_domain)
WHERE custom_domain IS NOT NULL;

-- 3. Document table columns
COMMENT ON COLUMN public.partner_agencies.custom_domain IS 'Verified custom domain CNAME (e.g. portal.agencyname.com) for full white-label agency portal routing';
COMMENT ON COLUMN public.partner_agencies.branding IS 'Custom white-label branding configuration: logo, favicon, accent colors, and powered-by badge toggle';
