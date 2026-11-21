import React from 'react'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'

export function FinalCtaSection({ onOpenClaim }: { onOpenClaim: () => void }) {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden border border-slate-800">
        {/* Subtle Ambient Backlights */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>START IN 2 MINUTES &bull; FIRST 3 JOBS FREE</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight text-white">
          Make It Easier for Customers to Book Your Next Service Call.
        </h2>

        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Give your customers a straightforward way to request a service, receive real-time arrival updates, and pay on site from their driveway.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={onOpenClaim}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Get Your Free Booking Link</span>
            <ArrowRight className="w-4 h-4 text-emerald-300" />
          </button>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Keep your existing phone number
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Month-to-month flexibility
          </span>
        </div>
      </div>
    </section>
  )
}
