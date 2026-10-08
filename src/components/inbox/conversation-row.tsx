import { User } from 'lucide-react'
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
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 transition-colors flex items-start gap-3 border-b border-zinc-800/80 hover:bg-zinc-900/60 relative",
        active ? "bg-zinc-900 border-l-2 border-l-blue-500" : "bg-zinc-950"
      )}
    >
      <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center shrink-0 text-zinc-300 font-medium text-xs">
        {displayName ? displayName.slice(0, 2).toUpperCase() : <User className="h-3.5 w-3.5 text-zinc-400" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium text-xs text-zinc-100 truncate">
            {displayName || displayPhone}
          </span>
          {displayTime && (
            <span className="text-[11px] text-zinc-500 shrink-0">
              {new Date(displayTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-400 truncate mt-0.5">
          {displayMessage}
        </p>
      </div>

      {count > 0 && (
        <span className="h-4 min-w-4 rounded-full bg-blue-600 text-white font-semibold text-[10px] flex items-center justify-center px-1 shrink-0 self-center tabular-nums">
          {count}
        </span>
      )}
    </button>
  )
}
