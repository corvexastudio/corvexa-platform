import React from 'react'
import Image from 'next/image'
import { Link2, Calendar, LayoutDashboard, Navigation, CheckCircle2 } from 'lucide-react'

export function HowItWorksTimeline() {
  const steps = [
    {
      number: '01',
      title: 'Add Your Booking Link',
      subtitle: 'Paste link on Google Maps and Instagram',
      description:
        'Copy your custom book.captodesk.com/[your-name] link. Add it directly to your Google Business Profile under booking options and in your social bios. No phone forwarding or carrier changes are needed.',
      icon: Link2,
      viewLabel: 'Where It Lives',
      detailSnippet: 'Google Business Profile > Online Bookings > Paste Link'
    },
    {
      number: '02',
      title: 'Customers Request a Service',
      subtitle: 'Self-service scheduling in 45 seconds',
      description:
        'Homeowners view your service catalog, see clear pricing, and choose an available arrival window directly from their mobile phone or desktop without downloading an application.',
      icon: Calendar,
      viewLabel: 'Customer Experience',
      detailSnippet: 'Service selection, address collection, arrival window'
    },
    {
      number: '03',
      title: 'Manage the Appointment',
      subtitle: 'Field dashboard on any phone or tablet',
      description:
        'Review incoming service requests on your dispatch board. Confirm arrival times, assign technicians, and view customer notes before heading out to the job site.',
      icon: LayoutDashboard,
      viewLabel: 'Contractor Dashboard',
      detailSnippet: 'Visual calendar, technician assignment, customer CRM'
    },
    {
      number: '04',
      title: 'Keep Customers Updated',
      subtitle: 'Live technician arrival and on-site checkout',
      description:
        'Tap On My Way to send the customer a live GPS arrival tracking link with an accurate ETA. When the job is done, collect payment via Apple Pay or card right from the driveway.',
      icon: Navigation,
      viewLabel: 'Live Tracking Experience',
      detailSnippet: 'Real-time ETA, technician photo, driveway Apple Pay'
    }
  ]

  return (
    <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 scroll-mt-20">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          SIMPLE 4-STEP WORKFLOW
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          How CaptoDesk Works From Discovery to Completion
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          A connected workflow designed for truck operations, giving homeowners clarity while eliminating phone tag and scheduling back-and-forth.
        </p>
      </div>

      {/* Connected Visual Timeline */}
      <div className="mt-14 relative">
        {/* Horizontal connector line on large screens */}
        <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-8 z-0" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.number}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-md">
                      STEP {step.number}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    {step.subtitle}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
                    {step.viewLabel}
                  </span>
                  <p className="text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                    {step.detailSnippet}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Supporting Editorial Photograph and Placement Demonstration */}
      <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xs">
        <div className="lg:col-span-6 space-y-4">
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
            REAL RESIDENTIAL ARRIVAL EXPERIENCE
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Arrival Notifications Homeowners Actually Appreciate
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            When you depart for the job, tap On My Way on your smartphone. CaptoDesk texts the customer a private tracking link showing your technician photo, vehicle details, and a live map with an estimated arrival time.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 font-medium">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No separate customer mobile app required. Opens directly in browser.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Stops repetitive &quot;When will someone arrive?&quot; phone calls.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Gives customers peace of mind knowing exactly who is coming to their home.</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative aspect-[4/3]">
          <Image
            src="/technician-arrival-entrance.jpg"
            alt="Professional service technician arriving at a residential home for a scheduled appointment"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}
