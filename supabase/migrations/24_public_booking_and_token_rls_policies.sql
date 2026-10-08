-- ==============================================================================
-- CAPTODESK MIGRATION 24: PUBLIC ACCESS POLICIES FOR BOOKING & TOKENS
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
--
-- Enables anonymous visitors to view:
-- 1. Organizations by slug (for public booking portal /book/[slug])
-- 2. Active services (to choose service to book)
-- 3. Public appointment slot availability checks
-- 4. Customer tokenized appointment / quote / invoice viewing
-- ==============================================================================

-- 1. Organizations: Allow public SELECT by slug
DROP POLICY IF EXISTS "Public can view organization booking profile by slug" ON public.organizations;
CREATE POLICY "Public can view organization booking profile by slug" 
ON public.organizations 
FOR SELECT 
TO anon, authenticated 
USING (slug IS NOT NULL);

-- 2. Services: Allow public SELECT on active services
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
CREATE POLICY "Public can view active services" 
ON public.services 
FOR SELECT 
TO anon, authenticated 
USING (is_active = true);

-- 3. Appointments: Allow public SELECT on manage_token
DROP POLICY IF EXISTS "Public can view appointments by manage_token" ON public.appointments;
CREATE POLICY "Public can view appointments by manage_token" 
ON public.appointments 
FOR SELECT 
TO anon, authenticated 
USING (manage_token IS NOT NULL);

-- 4. Appointments: Allow public INSERT for booking submission
DROP POLICY IF EXISTS "Public can create appointments via booking" ON public.appointments;
CREATE POLICY "Public can create appointments via booking" 
ON public.appointments 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- 5. Contacts: Allow public INSERT for booking submission
DROP POLICY IF EXISTS "Public can create contacts via booking" ON public.contacts;
CREATE POLICY "Public can create contacts via booking" 
ON public.contacts 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- 6. Quotes: Allow public SELECT on manage_token
DROP POLICY IF EXISTS "Public can view quotes by manage_token" ON public.quotes;
CREATE POLICY "Public can view quotes by manage_token" 
ON public.quotes 
FOR SELECT 
TO anon, authenticated 
USING (manage_token IS NOT NULL);

-- 7. Invoices: Allow public SELECT on manage_token
DROP POLICY IF EXISTS "Public can view invoices by manage_token" ON public.invoices;
CREATE POLICY "Public can view invoices by manage_token" 
ON public.invoices 
FOR SELECT 
TO anon, authenticated 
USING (manage_token IS NOT NULL);
