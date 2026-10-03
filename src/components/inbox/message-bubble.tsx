import { CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'system' | 'owner' | 'customer'
  body: string
  created_at: string
}

export function MessageBubble({ direction, sender_type, body, created_at }: MessageBubbleProps) {
  const isInbound = direction === 'inbound'
  const isAutoReply = sender_type === 'system'

  return (
    <div
      className={cn(
        "flex flex-col max-w-[85%] sm:max-w-[70%]",
        isInbound ? "mr-auto items-start" : "ml-auto items-end"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md",
          isInbound 
            ? "bg-zinc-800/90 text-zinc-100 rounded-tl-sm border border-zinc-700/50" 
            : isAutoReply
              ? "bg-blue-600/25 text-blue-100 border border-blue-500/40 rounded-tr-sm"
              : "bg-blue-600 text-white rounded-tr-sm shadow-blue-500/20"
        )}
      >
        {body}
      </div>

      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-zinc-400">
        {isAutoReply && (
          <span className="font-semibold text-blue-400 uppercase tracking-wider text-[9px] mr-1">
            Missed Call Auto-Text •
          </span>
        )}
        <span>
          {new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!isInbound && (
          <CheckCheck className="h-3 w-3 text-blue-400" />
        )}
      </div>
    </div>
  )
}
