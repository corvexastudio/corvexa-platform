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
          "rounded-lg px-3.5 py-2 text-xs leading-relaxed",
          isInbound 
            ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60" 
            : isAutoReply
              ? "bg-blue-950/60 text-blue-100 border border-blue-800/60"
              : "bg-blue-600 text-white"
        )}
      >
        {text}
      </div>

      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-zinc-400">
        {isAutoReply && (
          <span className="font-semibold text-blue-400 uppercase tracking-wider text-[9px] mr-0.5">
            Auto-Reply •
          </span>
        )}
        <span>
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!isInbound && (
          <span className="inline-flex items-center text-zinc-400" title={deliveryStatus || 'Sent'}>
            {deliveryStatus === 'delivered' ? (
              <CheckCheck className="h-3 w-3 text-emerald-400" />
            ) : deliveryStatus === 'failed' ? (
              <span className="text-red-400 text-[10px]">Failed</span>
            ) : (
              <Check className="h-3 w-3 text-zinc-400" />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
