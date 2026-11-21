import React from 'react'
import { PhoneMissed, Clock, HelpCircle, Receipt, ArrowRight } from 'lucide-react'

export function ProblemSection() {
  const problems = [
    {
      icon: PhoneMissed,
      title: 'Missed Calls Turn Into Lost Jobs',
      description:
        'When you are in a crawlspace, on a ladder, or driving, you cannot answer the phone. Most homeowners with urgent repairs will not leave a voicemail; they simply call the next contractor on Google.'
    },
    {
      icon: Clock,
      title: 'Scheduling Back-and-Forth',
      description:
        'Trading text messages and phone calls just to agree on a time slot costs hours every week. Customers want to see open appointment windows immediately and book their service without delays.'
    },
    {
      icon: HelpCircle,
      title: 'Constant Arrival Check-In Calls',
      description:
        'Waiting in a wide four-hour appointment window makes customers anxious. They call your phone repeatedly to ask when the technician is arriving, interrupting active service work.'
    },
    {
      icon: Receipt,
      title: 'Delayed Driveway Payments',
      description:
        'Writing paper invoices or sending payment links hours after leaving the property leads to delayed cash flow, forgotten balances, and uncomfortable payment follow-up calls.'
    }
  ]

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          THE OPERATIONAL CHALLENGE
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Getting Found Online Is Only Half the Job.
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Local homeowners find you on Google Search and Maps. But if the booking process involves phone tag, voicemail, and uncertainty, potential customers quickly move to another company.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {problems.map((item, idx) => {
          const Icon = item.icon
          return (
            <div
              key={item.title}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center font-bold">
                  <Icon className="w-5 h-5 text-slate-700" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-400">
                Problem {idx + 1} of 4
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
