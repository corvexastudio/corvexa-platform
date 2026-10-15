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
    a: "No. You keep your exact number on your trucks, business cards, and Google profile. You simply enable carrier call forwarding (takes 30 seconds by dialing *62 or *72 on your phone). Your phone rings normally; CaptoDesk only steps in when you are busy on a job or driving and can't pick up."
  },
  {
    q: 'What happens if a robocaller or spam number calls?',
    a: 'CaptoDesk verifies the incoming carrier metadata. Confirmed robocalls, 800-toll-free numbers, and spam listings are filtered out so you never waste automated text credits on junk callers.'
  },
  {
    q: 'How does the customer pay their invoice on the job site?',
    a: "When you tap 'Finish Job', an invoice card immediately appears on the homeowner's live tracking link. They can tap Apple Pay, Google Pay, or enter a card right from their phone with zero logins. Funds deposit directly into your linked bank account via Stripe on a rolling 48-hour schedule."
  },
  {
    q: 'Why do you only charge 0.5% for invoicing when other CRMs charge 1% to 2%?',
    a: 'Legacy software companies inflate their take-rates with high markups on your hard-earned revenue. We believe trade contractors working with their hands should keep their money. A 0.5% flat platform fee covers our Stripe Connect bank rails and infrastructure—nothing more.'
  },
  {
    q: 'Do my customers need to download an app or create an account?',
    a: 'Zero downloads, zero passwords. Homeowners despise installing apps for a contractor they only call once or twice a year. CaptoDesk runs entirely through a lightweight mobile web link sent via SMS (/t/[token]). It opens instantly on any iPhone or Android.'
  },
  {
    q: 'Can my crew or sub-contractors use this on their phones?',
    a: "Yes. Every technician gets their own clean mobile login. When they leave for a job, they tap 'On My Way'. The homeowner instantly gets their live tracking link with the technician's name and ETA, eliminating 'Where are you?' phone calls to your main line."
  },
  {
    q: 'Why do you offer a 30-day money-back guarantee instead of a free trial?',
    a: "Unlike generic software apps, CaptoDesk provisions a real, dedicated phone number and pays for strict 10DLC carrier compliance registration for your business the moment you join. We absorb those upfront telecom costs for you. To keep it completely risk-free, we back it with a 30-day money-back guarantee: if CaptoDesk doesn't save you at least two jobs in your first month, we will refund 100% of your software fee."
  }
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 mb-2">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>STRAIGHT TALK FOR CONTRACTORS</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          No corporate jargon. Here is how CaptoDesk actually works on the job site.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx
          return (
            <div
              key={faq.q}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-zinc-100 hover:text-white transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3">
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
