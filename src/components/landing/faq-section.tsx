'use client'

import React, { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'

interface FaqItem {
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  {
    q: 'Do I have to change my existing business phone number?',
    a: "No. You keep your exact phone number on your trucks, business cards, website, and Google Business profile. You simply enable carrier call forwarding (takes 30 seconds by dialing *62 on your phone). Your phone rings normally; CaptoDesk only steps in when you are busy on a job, in an attic, or driving and cannot pick up."
  },
  {
    q: 'How does the free online booking link work?',
    a: "Every contractor can claim a free, dedicated booking page (book.captodesk.com/your-business) with zero credit card required. You can add it to your website, Google Business Profile, or text it to customers so homeowners can schedule service appointments directly on your calendar."
  },
  {
    q: 'What happens if a robocaller, spammer, or wrong number calls?',
    a: 'CaptoDesk verifies incoming telephony carrier metadata in real time. Confirmed robocalls, toll-free lines, and known spam registries are filtered out so automated text credits are never wasted on junk callers.'
  },
  {
    q: 'How does the customer pay their invoice on the job site?',
    a: "When you tap 'Finish Job', an invoice card immediately appears on the homeowner's live tracking link. They can tap Apple Pay, Google Pay, or enter a card right from their phone with zero logins or app downloads. Digital receipts are texted and emailed automatically."
  },
  {
    q: 'Do my customers need to download an app or create an account?',
    a: 'Zero downloads, zero passwords. Homeowners dislike installing apps for a contractor they only call once or twice a year. CaptoDesk runs entirely through a fast, lightweight mobile web link sent via SMS. It opens instantly on any iPhone or Android device.'
  },
  {
    q: 'Can my crew or technicians use this on their phones?',
    a: "Yes. In the Multi-Crew plan, every technician gets their own clean mobile login. When they leave for a job, they tap 'On My Way'. The homeowner instantly gets their live tracking link with the technician's name and ETA, eliminating 'Where are you?' phone calls to your main office line."
  },
  {
    q: 'Can I cancel or change plans at any time?',
    a: 'Yes. CaptoDesk operates month-to-month with zero long-term contracts. If you ever cancel your Pro subscription, your account transitions to the Free tier, preserving your customer history and booking link with no surprise fees.'
  }
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="text-center mb-8">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block mb-2">
          05 / CONTRACTOR QUESTIONS &amp; ANSWERS
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          No corporate buzzwords. Here is how CaptoDesk actually works on the job site.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx
          return (
            <div
              key={faq.q}
              className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
