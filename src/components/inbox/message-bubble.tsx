import { Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MessageBubbleProps {
  id?: string
  direction?: 'inbound' | 'outbound'
  sender_type?: 'system' | 'owner' | 'customer'
  body?: string
  created_at?: string
  message?: {
    id: string
    direction: 'inbound' | 'outbound'
    sender_type?: 'system' | 'owner' | 'customer'
    body: string
    delivery_status?: string
    created_at: string
  }
}

export function MessageBubble({
  direction: rawDir,
  sender_type: rawSender,
  body: rawBody,
  created_at: rawCreatedAt,
  message
}: MessageBubbleProps) {
  const dir = rawDir ?? message?.direction ?? 'inbound'
  const senderType = rawSender ?? message?.sender_type ?? 'customer'
  const text = rawBody ?? message?.body ?? ''
  const createdAt = rawCreatedAt ?? message?.created_at ?? new Date().toISOString()
  const deliveryStatus = message?.delivery_status

  const isInbound = dir === 'inbound'
  const isAutoReply = senderType === 'system'

  return (
    <div
      className={cn(
        "flex flex-col max-w-[85%] sm:max-w-[70%]",
        isInbound ? "mr-auto items-start" : "ml-auto items-end"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs",
          isInbound 
            ? "bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60" 
            : isAutoReply
              ? "bg-blue-50 text-blue-950 border border-blue-200/80 rounded-br-xs dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-900/60"
              : "bg-blue-600 text-white rounded-br-xs shadow-xs"
        )}
      >
        {text}
      </div>

      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
        {isAutoReply && (
          <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[9px] mr-0.5">
            Auto-Reply •
          </span>
        )}
        <span>
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!isInbound && (
          <span className="inline-flex items-center text-slate-400 dark:text-zinc-500" title={deliveryStatus || 'Sent'}>
            {deliveryStatus === 'delivered' ? (
              <CheckCheck className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
            ) : deliveryStatus === 'failed' ? (
              <span className="text-red-500 dark:text-red-400 text-[10px] font-bold">Failed</span>
            ) : (
              <Check className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
