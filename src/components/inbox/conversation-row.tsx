import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConversationRowProps {
  id: string
  name?: string | null
  phone: string
  lastMessage?: string | null
  lastMessageAt: string
  unreadCount: number
  isSelected: boolean
  onClick: () => void
}

export function ConversationRow({
  name,
  phone,
  lastMessage,
  lastMessageAt,
  unreadCount,
  isSelected,
  onClick
}: ConversationRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3.5 transition-all flex items-start gap-3 hover:bg-zinc-900/60 relative",
        isSelected && "bg-zinc-900/90 border-l-4 border-blue-500"
      )}
    >
      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-inner">
        {name ? name.slice(0, 2).toUpperCase() : <User className="h-4 w-4 text-zinc-400" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm text-zinc-100 truncate">
            {name || phone}
          </span>
          <span className="text-[10px] text-zinc-400">
            {new Date(lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <p className="text-xs text-zinc-400 truncate mt-1">
          {lastMessage || 'No messages'}
        </p>
      </div>

      {unreadCount > 0 && (
        <span className="h-5 min-w-5 rounded-full bg-blue-500 text-white font-black text-[10px] flex items-center justify-center px-1 shrink-0 self-center">
          {unreadCount}
        </span>
      )}
    </button>
  )
}
