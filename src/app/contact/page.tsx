'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building,
  User,
  Wrench,
  Clock,
  Sparkles,
  HelpCircle,
  Truck
} from 'lucide-react'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    email: '',
    trade: 'hvac',
    fleetSize: '1',
    message: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulate clean submission
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 selection:bg-emerald-500 selection:text-white font-[var(--font-sans)] antialiased">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold text-base shadow-sm shadow-emerald-600/20 group-hover:bg-emerald-500 transition-colors">
              C
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                CaptoDesk
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold uppercase tracking-wider">
                  CONTACT
                </span>
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
            <Link
              href="/client/login"
              className="hidden sm:inline-flex px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm shadow-emerald-600/20"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Contact Container ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 items-start">
          
          {/* Left Column: Context & Proof */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Trade Specialist Consultation</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Talk to a Trade Operations Specialist
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Whether you want a 10-minute live screen walkthrough, have questions about forwarding from your carrier, or want help setting up multi-crew routing—we&apos;re here to help.
              </p>
            </div>

            {/* Benefit Highlights */}
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Same-Day Onboarding Support</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                    Get your dedicated carrier number and missed-call triggers set up in under 15 minutes.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Built Exclusively for Field Trades</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                    Plumbing, HVAC, Electrical, Roofing, and Home Services. No generic enterprise bloat.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">30-Day Money-Back Guarantee</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                    If CaptoDesk doesn&apos;t save you at least two jobs in your first month, we refund 100% of your fee.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Contact Channels */}
            <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 space-y-2">
              <span className="font-bold text-slate-800 block">Direct Support & Inquiries:</span>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>General: <a href="mailto:support@captodesk.com" className="text-emerald-700 font-medium hover:underline">support@captodesk.com</a></span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>Carrier Compliance: <a href="mailto:privacy@captodesk.com" className="text-emerald-700 font-medium hover:underline">privacy@captodesk.com</a></span>
              </div>
            </div>
          </div>

          {/* Right Column: Form Container */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    Walkthrough Request Received!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you, {formData.name || 'there'}! A CaptoDesk operations specialist will reach out to you via SMS and email within 1 business hour to schedule your walkthrough.
                  </p>
                  <div className="pt-4">
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Return to CaptoDesk Home</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-slate-900">Request a 10-Minute Walkthrough</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tell us a bit about your business so we can tailor the live setup to your trade.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Your Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Mike Johnson"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50 text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Business Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Company / Business Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Johnson HVAC & Plumbing"
                          value={formData.businessName}
                          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50 text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mobile Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          required
                          placeholder="(555) 234-5678"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50 text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          required
                          placeholder="mike@johnsonhvac.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50 text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Primary Trade */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Trade Specialty
                      </label>
                      <div className="relative">
                        <Wrench className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <select
                          value={formData.trade}
                          onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50 text-slate-900 cursor-pointer"
                        >
                          <option value="hvac">HVAC / Heating & Air</option>
                          <option value="plumbing">Plumbing</option>
                          <option value="electrical">Electrical</option>
                          <option value="roofing">Roofing & Gutters</option>
                          <option value="garage_door">Garage Door</option>
                          <option value="general">General Contractor / Handyman</option>
                          <option value="other">Other Field Service</option>
                        </select>
                      </div>
                    </div>

                    {/* Fleet Size */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Team &amp; Fleet Size
                      </label>
                      <div className="relative">
                        <Truck className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <select
                          value={formData.fleetSize}
                          onChange={(e) => setFormData({ ...formData, fleetSize: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50 text-slate-900 cursor-pointer"
                        >
                          <option value="1">Solo Operator (1 Tech)</option>
                          <option value="2-5">2 to 5 Trucks / Technicians</option>
                          <option value="6-15">6 to 15 Trucks / Technicians</option>
                          <option value="16+">16+ Fleet</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Anything specific you&apos;d like to solve? <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Missing calls while on roofs, want Uber-style tracking for our 3 trucks..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50 text-slate-900 resize-none"
                    />
                  </div>

                  {/* ── MANDATORY CARRIER B2B SMS OPT-IN DISCLOSURE BLOCK ── */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>SMS Communication Consent &amp; Privacy Notice</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500">
                      By providing your mobile phone number and clicking <strong>&quot;Request 10-Min Walkthrough&quot;</strong>, you authorize CaptoDesk to contact you via SMS regarding your walkthrough scheduling, product demonstration, and account onboarding updates. Consent is not a condition of purchasing any software or services. Message frequency varies. Standard message and data rates may apply. You may cancel at any time by replying <strong>STOP</strong>. Reply <strong>HELP</strong> for assistance.
                    </p>
                    <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-2">
                      <span>View our:</span>
                      <Link href="/privacy" target="_blank" className="text-emerald-700 hover:underline font-semibold">
                        Privacy Policy
                      </Link>
                      <span>•</span>
                      <Link href="/terms" target="_blank" className="text-emerald-700 hover:underline font-semibold">
                        Terms of Service
                      </Link>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Sending Request...</span>
                        </>
                      ) : (
                        <>
                          <span>Request 10-Min Walkthrough</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-center text-xs text-slate-500 mt-16">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} CaptoDesk Platform. All rights reserved. 10DLC &amp; TCPA Compliant Carrier Architecture.</p>
          <div className="flex items-center gap-4 text-slate-600">
            <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-slate-900">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
