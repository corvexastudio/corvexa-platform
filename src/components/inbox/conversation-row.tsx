import { User, PhoneCall } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConversationRowProps {
  id?: string
  name?: string | null
  phone?: string
  lastMessage?: string | null
  lastMessageAt?: string
  unreadCount?: number
  isSelected?: boolean
  isActive?: boolean
  conversation?: {
    id: string
    contact?: {
      name?: string | null
      phone: string
      address?: string | null
    }
    last_message_preview?: string | null
    last_message_at: string
    unread_count: number
    lead?: {
      id: string
      status: string
      urgency?: string
      source?: string
      service_needed?: string | null
    } | null
  }
  onClick: () => void
}

export function ConversationRow({
  id,
  name,
  phone,
  lastMessage,
  lastMessageAt,
  unreadCount,
  isSelected,
  isActive,
  conversation,
  onClick
}: ConversationRowProps) {
  const active = isSelected ?? isActive ?? false
  const displayName = name ?? conversation?.contact?.name ?? null
  const displayPhone = phone ?? conversation?.contact?.phone ?? ''
  const displayMessage = lastMessage ?? conversation?.last_message_preview ?? 'No messages'
  const displayTime = lastMessageAt ?? conversation?.last_message_at ?? ''
  const count = unreadCount ?? conversation?.unread_count ?? 0
  const lead = conversation?.lead

  return (
    <button
      data-slot="conversation-row"
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-3.5 transition-all flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800/60 relative cursor-pointer",
        active 
          ? "bg-blue-50/70 dark:bg-zinc-900 border-l-3 border-l-blue-600 dark:border-l-blue-500" 
          : "bg-white dark:bg-zinc-950 hover:bg-slate-50/90 dark:hover:bg-zinc-900/40"
      )}
    >
      <div className={cn(
        "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 font-bold text-xs transition-colors shadow-2xs",
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
      )}>
        {displayName ? displayName.slice(0, 2).toUpperCase() : <User className="h-4 w-4 text-slate-400 dark:text-zinc-500" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className={cn(
              "text-xs truncate font-semibold transition-colors",
              active 
                ? "text-blue-950 dark:text-blue-100 font-bold" 
                : "text-slate-900 dark:text-zinc-100"
            )}>
              {displayName || displayPhone}
            </span>
            {lead?.status === 'new' && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                New
              </span>
            )}
            {lead?.source === 'missed_call' && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                Missed Call
              </span>
            )}
          </div>
          {displayTime && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0 font-mono">
              {new Date(displayTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <p className={cn(
          "text-xs truncate mt-0.5",
          count > 0 
            ? "font-semibold text-slate-900 dark:text-zinc-100" 
            : "text-slate-500 dark:text-zinc-400"
        )}>
          {displayMessage}
        </p>

        {lead?.service_needed && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate bg-slate-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded font-medium">
              {lead.service_needed}
            </span>
          </div>
        )}
      </div>

      {count > 0 && (
        <span className="h-4.5 min-w-4.5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center px-1 shrink-0 self-center tabular-nums shadow-xs">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
