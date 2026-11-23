'use client'

import React, { useState } from 'react'
import { ChevronDown, HelpCircle, ShieldCheck } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: 'What exactly does CaptoDesk do?',
    answer:
      'CaptoDesk is a dedicated booking and dispatch system for home-service contractors. It provides a clean public booking link for your Google Business Profile and Instagram bio, gives customers a real-time technician arrival tracking map, enables on-site driveway payments via Apple Pay or card, and automatically sends Google review requests once the job is finished.'
  },
  {
    question: 'Will adding this booking link risk or affect my Google Business Profile ranking?',
    answer:
      'No. You never grant CaptoDesk access, passwords, or API permissions to your Google account. Google officially provides an Online Booking URL field for all local service businesses. You simply copy and paste your custom CaptoDesk link into that field in your Google dashboard. It is 100% compliant with Google policies and keeps your account verification and local rankings completely safe.'
  },
  {
    question: 'How do I add my booking link to my Google Business Profile?',
    answer:
      'After creating your CaptoDesk account, copy your custom link (book.captodesk.com/[your-business]). Open your Google Business Profile dashboard, select Edit profile, click Booking link, and paste your CaptoDesk URL. Google will then display the Book online button on your Google Search knowledge panel and Google Maps listing in about 60 seconds.'
  },
  {
    question: 'Do my customers need to install an application or make an account?',
    answer:
      'No. Homeowners do not want to download separate mobile applications for local home repairs. CaptoDesk operates entirely through secure, lightweight mobile web links delivered via SMS. Customers can book an appointment, view live technician arrival tracking, and pay their invoice from any iPhone or Android web browser without passwords.'
  },
  {
    question: 'Do I have to switch phone carriers or change my business number?',
    answer:
      'No. On the free Starter Pass, you keep your current phone setup completely untouched because customers schedule directly through your web booking link. On the Solo Pro tier, you receive a dedicated 10DLC-verified carrier number to power automated 2-way missed-call text-back alongside your existing number.'
  },
  {
    question: 'How does live technician arrival tracking work in practice?',
    answer:
      'When your technician departs for a job, they open their CaptoDesk mobile portal and tap On My Way. CaptoDesk immediately texts the customer a secure link displaying the technician name, photo, vehicle description, and a real-time moving arrival map with an accurate ETA, stopping arrival check-in calls while driving.'
  },
  {
    question: 'How do driveway payments and checkout work on site?',
    answer:
      'When the work is done, your technician taps Complete Job on their smartphone. An itemized invoice immediately updates on the customer live link. Homeowners can tap Apple Pay, Google Pay, or enter a credit/debit card right from their driveway. Funds deposit directly into your connected Stripe or PayPal account with zero platform percentage fee.'
  },
  {
    question: 'Can I manage multiple technicians and service trucks?',
    answer:
      'Yes. The Multi-Crew Fleet plan supports up to 5 crew members and technicians. Each technician receives their own mobile login with a restricted field view that hides business financials and customer contact books while showing their daily assigned job schedule and map navigation.'
  },
  {
    question: 'What happens after my first 3 free completed jobs?',
    answer:
      'Your first 3 completed jobs are 100% free with zero platform fees or credit card requirements. Once you reach 3 completed customer jobs, you can upgrade to Solo Pro ($99/month) to unlock unlimited jobs and dedicated carrier text-back, or keep your booking calendar active.'
  },
  {
    question: 'Can I cancel or modify my subscription at any time?',
    answer:
      'Yes. All paid CaptoDesk plans are billed month-to-month with zero long-term contracts. You can upgrade, downgrade, or cancel your account at any time directly from your billing settings.'
  }
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx)
  }

  return (
    <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-200 scroll-mt-20">
      <div className="text-center space-y-3 mb-12">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          COMMON QUESTIONS
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Straightforward answers about setting up and running CaptoDesk in the field.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx
          return (
            <div
              key={faq.question}
              className={`rounded-2xl border transition-all ${
                isOpen
                  ? 'bg-white border-blue-600 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <span className="text-sm sm:text-base font-bold text-slate-900">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 mt-2">
                  <p className="pt-3">{faq.answer}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
