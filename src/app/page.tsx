'use client'

import React, { useState, useEffect } from 'react'
import Script from 'next/script'
import { SiteHeader } from '@/components/landing/site-header'
import { HeroSection } from '@/components/landing/hero-section'
import { ProblemSection } from '@/components/landing/problem-section'
import { HowItWorksTimeline } from '@/components/landing/how-it-works-timeline'
import { InteractiveJourneyDemo } from '@/components/landing/interactive-journey-demo'
import { CoreFeaturesSection } from '@/components/landing/core-features-section'
import { AudienceSection } from '@/components/landing/audience-section'
import { ComparisonSection } from '@/components/landing/comparison-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { FaqSection } from '@/components/landing/faq-section'
import { FinalCtaSection } from '@/components/landing/final-cta-section'
import { SiteFooter } from '@/components/landing/site-footer'
import { ClaimBookingModal } from '@/components/landing/claim-booking-modal'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Verify auth state for header navigation
  useEffect(() => {
    try {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }: { data: any }) => {
        if (data?.user) setIsAuthenticated(true)
      })
    } catch {
      // Graceful fallback
    }
  }, [])

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'CaptoDesk',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    description:
      'Online booking link, live technician arrival tracking, and driveway payments for local trade and home-service businesses.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 selection:bg-blue-600 selection:text-white font-[var(--font-sans)] antialiased overflow-x-hidden">
      
      {/* JSON-LD Structured Data for Technical SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* 1. Navigation Header */}
      <SiteHeader
        isAuthenticated={isAuthenticated}
        onOpenClaim={() => setShowClaimModal(true)}
      />

      <main id="main-content">
        {/* 2. Hero Section */}
        <HeroSection onOpenClaim={() => setShowClaimModal(true)} />

        {/* 3. The Operational Problem */}
        <ProblemSection />

        {/* 4. How CaptoDesk Works (4-Step Connected Timeline) */}
        <HowItWorksTimeline />

        {/* 5. Complete Product Experience (Interactive Journey Walkthrough) */}
        <InteractiveJourneyDemo onOpenClaim={() => setShowClaimModal(true)} />

        {/* 6. Core Product Capabilities */}
        <CoreFeaturesSection />

        {/* 7. Who CaptoDesk Is For (Trade Verticals) */}
        <AudienceSection />

        {/* 8. Practical Comparison to Alternatives */}
        <ComparisonSection onOpenClaim={() => setShowClaimModal(true)} />

        {/* 9. Transparent Pricing */}
        <PricingSection onOpenClaim={() => setShowClaimModal(true)} />

        {/* 10. Frequently Asked Questions */}
        <FaqSection />

        {/* 11. Final Conversion CTA */}
        <FinalCtaSection onOpenClaim={() => setShowClaimModal(true)} />
      </main>

      {/* 12. Site Footer */}
      <SiteFooter />

      {/* 13. Frictionless Claim Booking Modal */}
      <ClaimBookingModal
        open={showClaimModal}
        onClose={() => setShowClaimModal(false)}
      />

    </div>
  )
}
