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
  Check
} from 'lucide-react'

export function CoreFeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 scroll-mt-20 space-y-20">
      
      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          CORE CAPABILITIES
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Practical Tools Designed for Field Operations
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Every feature in CaptoDesk directly addresses a real friction point in the home-service workflow, from first discovery to driveway payment.
        </p>
      </div>

      {/* Feature 1: 24/7 Online Booking Link */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
            FEATURE 01 &bull; ONLINE SCHEDULING
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            24/7 Dedicated Online Booking Link
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            One custom link that lives in your Google Business Profile and Instagram bio. Homeowners select the exact service they need, view your standard pricing, and pick an open arrival window directly into your calendar without phone tag.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Works across Google Search, Google Maps, Instagram, and SMS.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Collects property address, phone number, and job description upfront.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Protects your schedule with buffer times and minimum notice settings.</span>
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

      {/* Feature 2: Live Technician Arrival Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Visual on Left */}
        <div className="lg:col-span-6 order-2 lg:order-1 rounded-2xl border border-slate-200 bg-slate-900 text-white p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase">Customer Mobile Screen</span>
            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">GPS Active</span>
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
            Delivered automatically via SMS when technician taps &quot;On My Way&quot;. No mobile app installation required for the customer.
          </p>
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
            FEATURE 02 &bull; ARRIVAL TRANSPARENCY
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Live Technician Arrival Tracking
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Stops repetitive &quot;Where are you?&quot; phone calls before they start. When you roll out of your driveway or leave the previous job, tap On My Way to send homeowners a live tracking link with your photo, vehicle description, and a real-time ETA.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Provides verified technician identification for homeowner peace of mind.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Real-time GPS updates eliminate arrival guesswork.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Frees up your phone line so you stay focused on active work.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Feature 3: Driveway Invoicing & Digital Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-wider block">
            FEATURE 03 &bull; INSTANT PAYMENT
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Driveway Apple Pay and Card Checkout
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Eliminate awkward check collections and forgotten invoices. When you complete the job, tap Complete Job on your smartphone. An itemized invoice immediately updates on the customer&apos;s phone, allowing them to pay via Apple Pay, Google Pay, or card in seconds before you leave.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Collect payments on site without carrying separate card readers.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Itemized digital receipts texted and emailed automatically.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Integrates securely with your Stripe or PayPal merchant account.</span>
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

      {/* Feature 4: Automated Google Review Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Visual on Left */}
        <div className="lg:col-span-6 order-2 lg:order-1 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-mono font-bold text-slate-800 uppercase">Review Follow-Up Automation</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
              Sent 5 Min Post-Payment
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-500">
              <Star className="w-4 h-4 fill-amber-500" />
              <Star className="w-4 h-4 fill-amber-500" />
              <Star className="w-4 h-4 fill-amber-500" />
              <Star className="w-4 h-4 fill-amber-500" />
              <Star className="w-4 h-4 fill-amber-500" />
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              &quot;Thank you for choosing ProFlow Plumbing today! If you are satisfied with your service, please take 30 seconds to share your feedback on Google.&quot;
            </p>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900 flex items-center justify-between">
            <span>Direct link to your Google Business Profile review form</span>
            <span className="font-bold font-mono">1-Tap Open</span>
          </div>
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
            <Star className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-amber-600 uppercase tracking-wider block">
            FEATURE 04 &bull; REPUTATION BUILDING
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Automated Google Review Follow-Up
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Most satisfied homeowners intend to leave a review but forget once the day gets busy. CaptoDesk sends a direct review link minutes after payment settles while the great service is fresh in their mind, helping you collect authentic Google reviews consistently.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Sends review request when customer satisfaction is highest.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Directs happy homeowners directly to your Google review submission box.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Provides a private feedback channel for any customer concerns first.</span>
            </li>
          </ul>
        </div>
      </div>

    </section>
  )
}
