import React from 'react'
import Image from 'next/image'
import {
  Calendar,
  Navigation,
  CreditCard,
  Star,
  PhoneCall,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Check,
  Smartphone,
  Lock,
  DollarSign
} from 'lucide-react'

export function CoreFeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 scroll-mt-20 space-y-20">
      
      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          OPERATIONAL ADVANTAGES
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Practical Features Built for Real Truck Operations
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Every tool inside CaptoDesk was engineered to solve a specific friction point in daily field service, protecting your time, your crew, and your cash flow.
        </p>
      </div>

      {/* Feature 1: Schedule Protection & Smart Travel Buffers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
            ADVANTAGE 01 &bull; SCHEDULE PROTECTION
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Automated Travel Buffers and Anti-Overbooking
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Never get stuck with impossible back-to-back jobs across town. CaptoDesk lets you set automatic travel buffers, minimum notice rules, and service zones so your calendar only offers windows you can actually make.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Automatic 30 or 45-minute travel buffers inserted between appointments.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Minimum notice rules stop customers from booking 10 minutes before arrival.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Collects property address, phone number, and job details upfront.</span>
            </li>
          </ul>
        </div>

        {/* Feature Visual: Placement Guide */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white p-2 sm:p-4">
          <Image
            src="/booking-placement-guide.jpg"
            alt="CaptoDesk booking link displayed on Google Business Profile and Instagram bio"
            width={720}
            height={480}
            className="w-full h-auto rounded-xl object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {/* Feature 2: Zero App Downloads for Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Visual on Left */}
        <div className="lg:col-span-6 order-2 lg:order-1 rounded-2xl border border-slate-200 bg-slate-900 text-white p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase">Customer Mobile Experience</span>
            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">No App Needed</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
                MT
              </div>
              <div>
                <p className="text-xs font-bold text-white">Marcus Turner (Technician)</p>
                <p className="text-[11px] text-slate-400">ProFlow Plumbing &bull; White Service Van</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-700 flex justify-between items-center text-xs">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-400" />
                Live Moving ETA
              </span>
              <span className="font-mono text-emerald-400 font-bold">11 Minutes</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Delivered automatically via SMS when technician taps &quot;On My Way&quot;. Opens directly inside mobile Safari or Chrome without any login or app install.
          </p>
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
            <Smartphone className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
            ADVANTAGE 02 &bull; ZERO FRICTION
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Zero App Downloads for Customers or Crews
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Homeowners with a water leak or broken AC do not want to download a 60MB application from the App Store. CaptoDesk works entirely through lightweight, fast-loading mobile web pages delivered via SMS.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Works instantly on any iPhone or Android phone without passwords.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Customers view live technician map and ETA with a single tap.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Eliminates the #1 reason homeowners abandon digital service tracking.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Feature 3: Driveway Apple Pay with 0% Platform Surcharge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-wider block">
            ADVANTAGE 03 &bull; INSTANT CASH FLOW
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Driveway Apple Pay with 0% Platform Surcharge
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Collect payment in the customer driveway before packing your tools. When the technician marks the job complete, the invoice updates instantly on the customer smartphone, allowing them to pay via Apple Pay, Google Pay, or card in seconds.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Zero percentage cut: CaptoDesk never takes a percentage fee from your earnings.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Direct payouts deposit into your connected Stripe or PayPal account.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No separate card reader hardware or Bluetooth dongles required.</span>
            </li>
          </ul>
        </div>

        {/* Supporting Editorial Photograph of Field Contractor */}
        <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative aspect-[4/3]">
          <Image
            src="/contractor-van-workflow.jpg"
            alt="Independent contractor managing job dispatch and digital invoices inside their service van"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            loading="lazy"
          />
        </div>
      </div>

      {/* Feature 4: Restricted Technician Field Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Visual on Left */}
        <div className="lg:col-span-6 order-2 lg:order-1 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-mono font-bold text-slate-800 uppercase">Multi-Crew Privacy &amp; Security</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
              Field Mode Active
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-900 pb-1 border-b border-slate-200">
              <span>Technician Phone Screen:</span>
              <span className="text-blue-600 font-mono">Job #1042</span>
            </div>
            <p className="text-slate-600">
              Shows: Assigned customer address, service notes, and 1-tap map directions.
            </p>
            <div className="pt-2 text-[11px] text-slate-500 space-y-1">
              <p className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Company revenue and bank account hidden
              </p>
              <p className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Master customer database protected
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900 flex items-center justify-between">
            <span>Automated 5-star Google review attribution per technician</span>
            <span className="font-bold font-mono">Auto-Tracked</span>
          </div>
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider block">
            ADVANTAGE 04 &bull; MULTI-CREW SECURITY
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Restricted Technician Field Mode
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            As your business grows from 1 to 5 trucks, giving technicians full admin access to your software is a security risk. CaptoDesk gives technicians a streamlined mobile login that displays their daily schedule and map navigation while keeping company financials and master client lists strictly private.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Technicians see their assigned route without seeing your business profit margins.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Automated Google review requests credit the specific technician who did the job.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Owner retains 100% control over pricing catalogs and team assignments.</span>
            </li>
          </ul>
        </div>
      </div>

    </section>
  )
}
