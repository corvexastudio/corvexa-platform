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
    }
    last_message_preview?: string | null
    last_message_at: string
    unread_count: number
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
          <span className={cn(
            "text-xs truncate font-semibold transition-colors",
            active 
              ? "text-blue-950 dark:text-blue-100 font-bold" 
              : "text-slate-900 dark:text-zinc-100"
          )}>
            {displayName || displayPhone}
          </span>
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
      </div>

      {count > 0 && (
        <span className="h-4.5 min-w-4.5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center px-1 shrink-0 self-center tabular-nums shadow-xs">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
