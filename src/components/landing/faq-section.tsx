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
    a: "No. You keep your exact phone number on your trucks, business cards, website, and Google Business profile. You simply enable carrier call forwarding (takes 30 seconds by dialing *62 or *72 on your phone). Your phone rings normally; CaptoDesk only steps in when you are busy on a job, in an attic, or driving and cannot pick up."
  },
  {
    q: 'What happens if a robocaller, spammer, or wrong number calls?',
    a: 'CaptoDesk verifies incoming telephony carrier metadata in real time. Confirmed robocalls, toll-free lines, and known spam registries are filtered out so automated text credits are never wasted on junk callers.'
  },
  {
    q: 'How does the customer pay their invoice on the job site?',
    a: "When you tap 'Finish Job', an invoice card immediately appears on the homeowner's live tracking link. They can tap Apple Pay, Google Pay, or enter a card right from their phone with zero logins or app downloads. Funds deposit directly into your linked bank account via Stripe on a rolling 48-hour schedule."
  },
  {
    q: 'Why do you charge 0.5% for invoicing when other CRMs charge 1% to 2%?',
    a: 'Legacy software platforms inflate their take-rates with high markups on your hard-earned revenue. We believe trade contractors working with their hands should keep their money. A 0.5% flat platform fee covers our Stripe Connect bank rails and infrastructure—nothing more.'
  },
  {
    q: 'Do my customers need to download an app or create an account?',
    a: 'Zero downloads, zero passwords. Homeowners dislike installing apps for a contractor they only call once or twice a year. CaptoDesk runs entirely through a fast, lightweight mobile web link sent via SMS. It opens instantly on any iPhone or Android device.'
  },
  {
    q: 'Can my crew or technicians use this on their phones?',
    a: "Yes. Every technician gets their own clean mobile login. When they leave for a job, they tap 'On My Way'. The homeowner instantly gets their live tracking link with the technician's name and ETA, eliminating 'Where are you?' phone calls to your main office line."
  },
  {
    q: 'How does the 30-day money-back guarantee work?',
    a: "CaptoDesk provisions a dedicated carrier phone number and registers your business for strict 10DLC carrier compliance the moment you join. To keep it completely risk-free, we back it with a 30-day money-back guarantee: if CaptoDesk doesn't save you at least two jobs in your first month, we will refund 100% of your software fee with no hassle."
  }
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>STRAIGHT TALK FOR TRADE CONTRACTORS</span>
        </div>
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
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-emerald-600' : ''
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
