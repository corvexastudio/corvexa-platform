'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { MessageSquare, Send, PhoneCall, Search, User, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConversationRow } from '@/components/inbox/conversation-row'
import { MessageBubble } from '@/components/inbox/message-bubble'
import { CannedSnippetsBar } from '@/components/inbox/canned-snippets'

interface ConversationItem {
  id: string
  org_id: string
  contact_id: string
  last_message_at: string
  last_message_preview?: string | null
  unread_count: number
  status: string
  contact: {
    id: string
    name?: string | null
    phone: string
    address?: string | null
  }
}

interface MessageItem {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'system' | 'owner' | 'customer'
  body: string
  delivery_status: string
  created_at: string
}

export default function InboxPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [replyText, setReplyText] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mobileViewThread, setMobileViewThread] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find(c => c.id === activeConvId)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return

    const { data } = await supabase
      .from('conversations')
      .select('id, org_id, contact_id, last_message_at, last_message_preview, unread_count, status, contact:contacts(id, name, phone, address)')
      .eq('org_id', profile.org_id)
      .order('last_message_at', { ascending: false })

    if (data) {
      const enriched: ConversationItem[] = data.map((c: any) => ({
        ...c,
        contact: Array.isArray(c.contact) ? c.contact[0] : c.contact
      }))
      setConversations(enriched)
      if (enriched.length > 0 && !activeConvId) setActiveConvId(enriched[0].id)
    }
    setLoading(false)
  }, [supabase, activeConvId])

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
      setTimeout(scrollToBottom, 100)
      await supabase.from('conversations').update({ unread_count: 0 }).eq('id', convId)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
    }
  }, [supabase])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { if (activeConvId) loadMessages(activeConvId) }, [activeConvId, loadMessages])

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !activeConv || !activeConv.contact?.phone) return

    setSending(true)
    const textToSend = replyText.trim()
    setReplyText('')

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activeConv.id, to: activeConv.contact.phone, message: textToSend })
      })

      if (res.ok) {
        const { message } = await res.json()
        if (message) {
          setMessages(prev => [...prev, message])
          setTimeout(scrollToBottom, 100)
        }
      } else {
        toast.error('Failed to send text.')
        setReplyText(textToSend)
      }
    } catch {
      toast.error('Network error.')
      setReplyText(textToSend)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: 'new' | 'contacted' | 'booked' | 'lost') => {
    if (!activeConv) return
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('contact_id', activeConv.contact_id)
    if (!error) toast.success(`Lead marked as ${newStatus}`)
  }

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return c.contact?.name?.toLowerCase().includes(q) || c.contact?.phone?.includes(q) || c.last_message_preview?.toLowerCase().includes(q)
  })

  return (
    <div className="h-[calc(100vh-8.5rem)] flex rounded-2xl border border-zinc-800/80 bg-[#0B101B] overflow-hidden shadow-2xl">
      {/* Directory Column */}
      <div className={cn("w-full md:w-80 lg:w-96 border-r border-zinc-800/80 flex flex-col bg-[#0B101B]", mobileViewThread ? "hidden md:flex" : "flex")}>
        <div className="p-4 border-b border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              2-Way Inbox
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {conversations.length} Active
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-zinc-900/90 border-zinc-800 text-xs rounded-xl text-zinc-100 placeholder:text-zinc-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-300">
                {loading ? 'Loading conversations...' : 'No conversations yet'}
              </p>
              {!loading && (
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  When a caller reaches your line and misses you, CaptoDesk sends an immediate text. Customer replies will appear here.
                </p>
              )}
            </div>
          ) : (
            filtered.map(conv => (
              <ConversationRow
                key={conv.id}
                id={conv.id}
                name={conv.contact?.name}
                phone={conv.contact?.phone}
                lastMessage={conv.last_message_preview}
                lastMessageAt={conv.last_message_at}
                unreadCount={conv.unread_count}
                isSelected={conv.id === activeConvId}
                onClick={() => { setActiveConvId(conv.id); setMobileViewThread(true) }}
              />
            ))
          )}
        </div>
      </div>

      {/* Message Thread Column */}
      <div className={cn("flex-1 flex flex-col bg-[#080C14]", !mobileViewThread ? "hidden md:flex" : "flex")}>
        {activeConv ? (
          <>
            <div className="h-16 border-b border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between bg-[#0B101B]/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileViewThread(false)} className="md:hidden p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                  {activeConv.contact?.name ? activeConv.contact.name.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <div>
                  <h2 className="font-bold text-sm text-white">{activeConv.contact?.name || 'Customer'}</h2>
                  <p className="text-xs text-zinc-400">{activeConv.contact?.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a href={`tel:${activeConv.contact?.phone}`} className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 border border-zinc-700/60 transition-colors">
                  <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Call Cell</span>
                </a>
                <select onChange={(e) => handleStatusChange(e.target.value as any)} defaultValue="contacted" className="h-8 rounded-xl bg-zinc-800/90 border border-zinc-700/60 text-xs font-semibold text-zinc-200 px-2.5 focus:outline-none">
                  <option value="new">Status: New</option>
                  <option value="contacted">Status: Contacted</option>
                  <option value="booked">Status: Booked</option>
                  <option value="lost">Status: Lost</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map(msg => (
                <MessageBubble key={msg.id} {...msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <CannedSnippetsBar onSelect={snip => setReplyText(snip)} />

            <form onSubmit={handleSendReply} className="p-3 sm:p-4 border-t border-zinc-800/80 bg-[#0B101B]/95 flex items-center gap-3">
              <Input
                placeholder="Type your SMS reply to customer..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="flex-1 h-11 bg-zinc-900 border-zinc-800 text-xs sm:text-sm text-white rounded-xl focus:border-blue-500 placeholder:text-zinc-400"
              />
              <Button type="submit" disabled={sending || !replyText.trim()} className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send SMS</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-400 shadow-inner">
              <MessageSquare className="h-7 w-7 text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-white">Select a Conversation</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
              When a caller misses you on your business line, CaptoDesk auto-replies within seconds. Homeowner replies and active SMS chats will open here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
