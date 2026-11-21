import React from 'react'
import { Check, X, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react'

export function ComparisonSection({ onOpenClaim }: { onOpenClaim: () => void }) {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          PRACTICAL DIFFERENCE
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          How CaptoDesk Compares to the Alternatives
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          See how an integrated direct booking and live arrival system compares to traditional voicemail or bloated enterprise platforms.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
        
        {/* Option 1: Voicemail & Answering Services */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-2xs">
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              OPTION 01
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Voicemail and Call Centers
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Traditional call centers take handwritten messages or transfer calls during business hours, leaving customers waiting for callbacks.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <li className="flex items-start gap-2 text-rose-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Callers often hang up before leaving a voicemail message</span>
              </li>
              <li className="flex items-start gap-2 text-rose-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Callbacks involve phone tag to find open appointment windows</span>
              </li>
              <li className="flex items-start gap-2 text-rose-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Zero live technician arrival tracking for homeowners</span>
              </li>
              <li className="flex items-start gap-2 text-rose-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>No automated digital checkout or review follow-up</span>
              </li>
            </ul>
          </div>
          <div className="pt-4 border-t border-slate-100 text-[11px] font-mono text-slate-400">
            $300+ monthly retainers for basic message taking
          </div>
        </div>

        {/* Option 2: Heavy Enterprise CRMs */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-2xs">
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              OPTION 02
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Complex Enterprise CRMs
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Large platforms designed for 50-truck corporate fleets with dedicated office dispatchers and complex custom configurations.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <li className="flex items-start gap-2 text-amber-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>$250 to $500 monthly fees with 2 to 4 weeks of setup</span>
              </li>
              <li className="flex items-start gap-2 text-amber-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Steep learning curve for field technicians on the road</span>
              </li>
              <li className="flex items-start gap-2 text-amber-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Often requires customers to download separate mobile applications</span>
              </li>
              <li className="flex items-start gap-2 text-amber-600">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Overly complex features that solo or small crews never use</span>
              </li>
            </ul>
          </div>
          <div className="pt-4 border-t border-slate-100 text-[11px] font-mono text-slate-400">
            $250 to $500 monthly base fees before add-ons
          </div>
        </div>

        {/* Option 3: CaptoDesk */}
        <div className="rounded-3xl border-2 border-blue-600 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl relative">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
            FOCUSED ON FIELD OPERATIONS
          </span>

          <div className="space-y-4 pt-1">
            <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
              THE CAPTODESK SYSTEM
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              CaptoDesk Platform
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              A straightforward booking link, live arrival tracking map, and driveway checkout system built specifically for trade trucks.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-800 pt-2 border-t border-blue-100 font-medium">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Dedicated booking link added to Google Business Profile in 2 minutes</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Live technician arrival tracking texted with zero customer app downloads</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Driveway Apple Pay and card checkout before packing tools</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Automated review requests sent right after payment clears</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>First 3 completed customer jobs free with zero platform fees</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={onOpenClaim}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              Get Your Free Booking Link &rarr;
            </button>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Just 1 booked job covers months of service
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
