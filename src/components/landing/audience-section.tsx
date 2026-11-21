import React from 'react'
import {
  Flame,
  Wrench,
  Zap,
  Home,
  Car,
  Sparkles,
  TreePine,
  CheckCircle2
} from 'lucide-react'

export function AudienceSection() {
  const industries = [
    {
      name: 'HVAC & Heating',
      icon: Flame,
      headline: 'Seasonal AC tune-ups, diagnostics, and repairs',
      description:
        'Let homeowners schedule urgent diagnostic visits during peak weather spikes. Share exact arrival tracking so customers are home and ready when the technician arrives.',
      exampleService: '24-Point AC Seasonal Tune-Up ($119)'
    },
    {
      name: 'Plumbing & Drain Cleaning',
      icon: Wrench,
      headline: 'Drain clearing, leaks, and water heater replacements',
      description:
        'Capture urgent plumbing inquiries immediately before homeowners call another contractor. Collect service deposits or full driveway payment via Apple Pay right after fixing the pipe.',
      exampleService: 'Emergency Main Drain Clearing ($195)'
    },
    {
      name: 'Electrical & Lighting',
      icon: Zap,
      headline: 'EV charger installation, panel upgrades, and repairs',
      description:
        'Offer upfront, clear package pricing for standard electrical jobs like EV chargers and breaker replacements. Keep busy homeowners informed with live arrival updates.',
      exampleService: 'Level 2 EV Charger Installation ($695)'
    },
    {
      name: 'Roofing & Gutters',
      icon: Home,
      headline: 'Storm damage inspections, leak tarping, and gutter guards',
      description:
        'Give homeowners a direct booking link for free storm assessments or gutter cleaning. Coordinate multi-crew ladder inspections without messy paper scheduling.',
      exampleService: '18-Point Storm Damage Inspection ($0 Free)'
    },
    {
      name: 'Mobile Auto Detailing',
      icon: Car,
      headline: 'Ceramic coatings, interior details, and mobile washes',
      description:
        'Allow customers to book detailing packages for their driveway without back-and-forth phone tag. Settle on site with Apple Pay before packing your sprayers.',
      exampleService: 'Full Interior & Exterior Detail ($249)'
    },
    {
      name: 'Cleaning & Maintenance',
      icon: Sparkles,
      headline: 'Move-in deep cleans, window washing, and handyman work',
      description:
        'Set clear hourly or flat-rate service packages for residential cleaning and handyman repairs. Collect five-star Google reviews right after inspecting the finished job.',
      exampleService: 'Whole-Home Deep Clean Service ($280)'
    }
  ]

  return (
    <section id="who-its-for" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 scroll-mt-20">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          WHO CAPTODESK IS FOR
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Built for Independent and Growing Home-Service Businesses
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Whether you run a single service vehicle or manage a small crew, CaptoDesk provides a clean, practical system to convert online searches into booked appointments.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {industries.map((trade) => {
          const Icon = trade.icon
          return (
            <div
              key={trade.name}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {trade.name}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-500">
                      {trade.headline}
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {trade.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-slate-400">Sample Booking:</span>
                <span className="font-mono font-bold text-slate-900 text-[11px]">
                  {trade.exampleService}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
