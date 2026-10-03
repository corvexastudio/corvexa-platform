import { PhoneMissed, CheckCircle2, Clock, PhoneCall, MessageSquare, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface CallItem {
  id: string
  caller_number: string
  created_at: string
  contacts?: {
    name?: string | null
    phone?: string
  }
}

interface RecentCallsProps {
  calls: CallItem[]
}

export function RecentCallsFeed({ calls }: RecentCallsProps) {
  if (calls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center bg-zinc-900/30">
        <ShieldCheck className="h-10 w-10 text-emerald-500/80 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-white">Your Safety Net is Active</h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
          When you are on a job and miss a call, CaptoDesk catches the caller, logs it here, and fires the instant text-back in 15 seconds.
        </p>
        <div className="mt-4">
          <Link 
            href="/client/settings" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors"
          >
            View Carrier *71 Guide &rarr;
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {calls.map(call => (
        <div 
          key={call.id}
          className="rounded-2xl border border-zinc-800/80 bg-[#0D1322]/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-all shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <PhoneMissed className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {call.contacts?.name || call.caller_number}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Texted back
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                <span>{call.caller_number}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
            <a
              href={`tel:${call.caller_number}`}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors"
            >
              <PhoneCall className="h-3.5 w-3.5 text-zinc-400" />
              <span>Call</span>
            </a>
            <Link
              href="/client/inbox"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
