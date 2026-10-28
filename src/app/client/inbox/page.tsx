'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { 
  MessageSquare, 
  Send, 
  PhoneCall, 
  Search, 
  User, 
  ChevronLeft, 
  Loader2, 
  RefreshCw, 
  Calendar,
  FileText,
  CreditCard,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Inbox as InboxIcon,
  Sparkles,
  Plus,
  Filter,
  Clock,
  Target,
  DollarSign,
  Wrench,
  ChevronDown,
  Check,
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  X,
  Tag,
  PhoneForwarded,
  ShieldAlert,
  Zap,
  Flame,
  CheckCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConversationRow } from '@/components/inbox/conversation-row'
import { MessageBubble } from '@/components/inbox/message-bubble'
import { CannedSnippetsBar } from '@/components/inbox/canned-snippets'
import { useWorkspace } from '@/lib/context/workspace-context'
import { INDUSTRY_LIST, getIndustryPreset } from '@/lib/constants/industries'

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
    email?: string | null
    address?: string | null
    notes?: string | null
    lifetime_value?: number | null
  }
  lead?: {
    id: string
    contact_id: string
    source: string
    status: 'new' | 'contacted' | 'booked' | 'lost'
    urgency: 'low' | 'normal' | 'high' | 'emergency'
    service_needed?: string | null
    estimated_value?: number | null
    notes?: string | null
    created_at: string
  } | null
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

function playMessageChime() {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // Non-blocking audio
  }
}

const LEAD_STAGES = [
  { key: 'new', label: 'New Lead', color: 'bg-blue-600 text-white' },
  { key: 'contacted', label: 'Contacted', color: 'bg-amber-500 text-white' },
  { key: 'booked', label: 'Booked', color: 'bg-emerald-600 text-white' },
  { key: 'lost', label: 'Archived', color: 'bg-slate-500 text-white' }
] as const

export default function InboxPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()

  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const activeConvIdRef = useRef<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [replyText, setReplyText] = useState('')
  const { orgIndustry } = useWorkspace()
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'unread' | 'leads' | 'missed'>('all')
  const [selectedTrade, setSelectedTrade] = useState<string>('all')
  const [showTradeFilter, setShowTradeFilter] = useState(false)
  const [dossierOpen, setDossierOpen] = useState(true)
  const [mobileDossierOpen, setMobileDossierOpen] = useState(false)

  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [oldestCursor, setOldestCursor] = useState<string | null>(null)
  const [mobileViewThread, setMobileViewThread] = useState(false)
  const [updatingStage, setUpdatingStage] = useState(false)

  // Compose New Message State
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [composeContactId, setComposeContactId] = useState('')
  const [composeCustomPhone, setComposeCustomPhone] = useState('')
  const [composeCustomName, setComposeCustomName] = useState('')
  const [composeTrade, setComposeTrade] = useState('')
  const [composeUrgency, setComposeUrgency] = useState<'normal' | 'high' | 'emergency'>('normal')

  // Sync compose default trade with workspace onboarding trade
  useEffect(() => {
    if (orgIndustry && orgIndustry !== 'general' && !composeTrade) {
      setComposeTrade(getIndustryPreset(orgIndustry).name)
    }
  }, [orgIndustry, composeTrade])
  const [composeMessage, setComposeMessage] = useState('')
  const [composing, setComposing] = useState(false)
  const [customersList, setCustomersList] = useState<any[]>([])

  // Load customer directory for composer picker
  useEffect(() => {
    fetch('/api/client/customers?limit=100')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.customers) setCustomersList(data.customers)
      })
      .catch(() => {})
  }, [])

  // Auto-open compose modal if triggered via URL params
  useEffect(() => {
    if (searchParams.get('compose') === 'true' || searchParams.get('new') === 'true') {
      setShowComposeModal(true)
    }
  }, [searchParams])

  useEffect(() => {
    activeConvIdRef.current = activeConvId
  }, [activeConvId])

  // React Query with resilient background polling
  const { data: convData, isLoading: loadingConvs, isError: isConvError, error: convQueryError, refetch: refetchConvs } = useQuery({
    queryKey: ['inbox-conversations'],
    queryFn: async () => {
      const res = await fetch('/api/client/inbox')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 403 && (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization'))) {
          window.location.href = '/client/onboarding'
          return { conversations: [] }
        }
        throw new Error(err.error || 'Failed to load conversations.')
      }
      return res.json()
    },
    staleTime: 3000,
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  })

  const conversations: ConversationItem[] = convData?.conversations || []

  // Auto-select conversation matching contact_id from URL if present
  useEffect(() => {
    const contactIdParam = searchParams.get('contact_id')
    if (contactIdParam && conversations.length > 0) {
      const match = conversations.find(c => c.contact_id === contactIdParam)
      if (match) {
        setActiveConvId(match.id)
        setMobileViewThread(true)
        return
      }
    }
    // Default selection
    if (conversations.length > 0 && !activeConvId) {
      setActiveConvId(conversations[0].id)
    }
  }, [conversations, activeConvId, searchParams])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find(c => c.id === activeConvId)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/client/inbox/messages?conversation_id=${convId}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setHasMoreOlder(Boolean(data.hasMore))
        setOldestCursor(data.oldestCursor || null)
        setTimeout(() => scrollToBottom('auto'), 50)

        // Mark as read in background
        supabase.from('conversations').update({ unread_count: 0 }).eq('id', convId).then(() => {
          queryClient.setQueryData<{ conversations?: ConversationItem[] }>(['inbox-conversations'], (old) => {
            if (!old?.conversations) return old
            return {
              ...old,
              conversations: old.conversations.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
            }
          })
        })
      } else {
        toast.error('Failed to load message history.')
      }
    } catch {
      toast.error('Network error loading messages.')
    } finally {
      setLoadingMessages(false)
    }
  }, [supabase, queryClient])

  const handleLoadOlderMessages = useCallback(async () => {
    if (!activeConvId || !oldestCursor || loadingOlder) return

    setLoadingOlder(true)
    const prevScrollHeight = scrollContainerRef.current?.scrollHeight || 0

    try {
      const res = await fetch(
        `/api/client/inbox/messages?conversation_id=${activeConvId}&limit=50&before=${encodeURIComponent(oldestCursor)}`
      )
      if (res.ok) {
        const data = await res.json()
        const older = data.messages || []
        setMessages(prev => [...older, ...prev])
        setHasMoreOlder(Boolean(data.hasMore))
        setOldestCursor(data.oldestCursor || null)

        setTimeout(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight
            scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight
          }
        }, 30)
      } else {
        toast.error('Could not load older messages.')
      }
    } catch {
      toast.error('Network error loading older messages.')
    } finally {
      setLoadingOlder(false)
    }
  }, [activeConvId, oldestCursor, loadingOlder])

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
    }
  }, [activeConvId, loadMessages])

  // Realtime subscription for incoming messages
  useEffect(() => {
    const channel = supabase
      .channel('inbox_realtime_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const newMsg = payload.new as MessageItem
          if (!newMsg) return

          if (newMsg.conversation_id === activeConvIdRef.current) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            if (newMsg.direction === 'inbound') {
              playMessageChime()
              supabase.from('conversations').update({ unread_count: 0 }).eq('id', newMsg.conversation_id)
            }
            setTimeout(() => scrollToBottom('smooth'), 100)
          } else if (newMsg.direction === 'inbound') {
            playMessageChime()
          }

          refetchConvs()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          refetchConvs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refetchConvs])

  // Resilient background auto-sync for active thread
  useEffect(() => {
    if (!activeConvId) return

    const syncTimer = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return

      try {
        const res = await fetch(`/api/client/inbox/messages?conversation_id=${activeConvId}&limit=50`)
        if (!res.ok) return
        const data = await res.json()
        const incomingMessages: MessageItem[] = data.messages || []
        if (incomingMessages.length === 0) return

        setMessages(prev => {
          if (prev.length === 0) return incomingMessages
          const prevIds = new Set(prev.map(m => m.id))
          const newItems = incomingMessages.filter(m => !prevIds.has(m.id))
          if (newItems.length === 0) return prev

          const hasInbound = newItems.some(m => m.direction === 'inbound')
          if (hasInbound) {
            playMessageChime()
            supabase.from('conversations').update({ unread_count: 0 }).eq('id', activeConvId)
          }

          setTimeout(() => scrollToBottom('smooth'), 100)
          return incomingMessages
        })
      } catch {
        // Silent background sync
      }
    }, 3500)

    return () => clearInterval(syncTimer)
  }, [activeConvId, supabase])

  // Reply submission handler
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !activeConv || !activeConv.contact?.phone || sending) return

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
          setTimeout(() => scrollToBottom('smooth'), 100)

          queryClient.setQueryData<{ conversations?: ConversationItem[] }>(['inbox-conversations'], (old) => {
            if (!old?.conversations) return old
            return {
              ...old,
              conversations: old.conversations.map(c => c.id === activeConv.id ? {
                ...c,
                last_message_preview: textToSend,
                last_message_at: new Date().toISOString()
              } : c)
            }
          })
        }
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to send text.')
        setReplyText(textToSend)
      }
    } catch {
      toast.error('Network error sending message.')
      setReplyText(textToSend)
    } finally {
      setSending(false)
    }
  }

  // Update lead stage in real time
  const handleUpdateLeadStatus = async (newStatus: 'new' | 'contacted' | 'booked' | 'lost') => {
    if (!activeConv) return
    setUpdatingStage(true)

    try {
      if (activeConv.lead?.id) {
        const res = await fetch(`/api/client/leads/${activeConv.lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        })
        if (res.ok) {
          toast.success(`Lead marked as ${newStatus}`)
          refetchConvs()
        } else {
          toast.error('Failed to update lead status.')
        }
      } else {
        const res = await fetch('/api/client/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: activeConv.contact_id,
            status: newStatus,
            source: 'manual',
            urgency: 'normal'
          })
        })
        if (res.ok) {
          toast.success(`Lead initialized as ${newStatus}`)
          refetchConvs()
        } else {
          toast.error('Failed to initialize lead.')
        }
      }
    } catch {
      toast.error('Network error updating lead status.')
    } finally {
      setUpdatingStage(false)
    }
  }

  // Compose new message dispatch
  const handleComposeSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!composeMessage.trim() || composing) return

    setComposing(true)
    try {
      let resolvedContactId = composeContactId
      let recipientPhone = ''

      if (resolvedContactId) {
        const found = customersList.find(c => c.id === resolvedContactId)
        recipientPhone = found?.phone || ''
      } else if (composeCustomPhone.trim()) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).maybeSingle()
        if (!profile?.org_id) throw new Error('Organization not found')

        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, phone')
          .eq('org_id', profile.org_id)
          .eq('phone', composeCustomPhone.trim())
          .maybeSingle()

        if (existingContact) {
          resolvedContactId = existingContact.id
          recipientPhone = existingContact.phone
        } else {
          const { data: newContact, error: insertErr } = await supabase
            .from('contacts')
            .insert({
              org_id: profile.org_id,
              name: composeCustomName.trim() || 'New Customer',
              phone: composeCustomPhone.trim()
            })
            .select('id, phone')
            .single()

          if (insertErr || !newContact) throw new Error('Failed to create customer record')
          resolvedContactId = newContact.id
          recipientPhone = newContact.phone
        }
      }

      if (!resolvedContactId || !recipientPhone) {
        toast.error('Please select an existing customer or enter a valid phone number.')
        setComposing(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).maybeSingle()

      let targetConvId: string | null = null
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('org_id', profile?.org_id)
        .eq('contact_id', resolvedContactId)
        .maybeSingle()

      if (existingConv) {
        targetConvId = existingConv.id
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            org_id: profile?.org_id,
            contact_id: resolvedContactId,
            last_message_preview: composeMessage.trim(),
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single()

        if (convErr || !newConv) throw new Error('Failed to initialize conversation')
        targetConvId = newConv.id
      }

      // If trade or urgency specified, ensure lead is logged
      if (composeTrade || composeUrgency !== 'normal') {
        await fetch('/api/client/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: resolvedContactId,
            source: 'manual',
            status: 'new',
            urgency: composeUrgency,
            serviceNeeded: composeTrade || undefined
          })
        }).catch(() => {})
      }

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: targetConvId,
          to: recipientPhone,
          message: composeMessage.trim()
        })
      })

      if (res.ok) {
        toast.success('Message sent!')
        setShowComposeModal(false)
        setComposeContactId('')
        setComposeCustomPhone('')
        setComposeCustomName('')
        setComposeTrade('')
        setComposeUrgency('normal')
        setComposeMessage('')
        setActiveConvId(targetConvId)
        refetchConvs()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to dispatch message.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating conversation')
    } finally {
      setComposing(false)
    }
  }

  // Triage filter metrics
  const totalUnread = useMemo(() => conversations.filter(c => c.unread_count > 0).length, [conversations])
  const totalLeads = useMemo(() => conversations.filter(c => c.lead != null).length, [conversations])
  const totalMissed = useMemo(() => conversations.filter(c => c.lead?.source === 'missed_call' || c.last_message_preview?.toLowerCase().includes('missed')).length, [conversations])

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      // Channel filters
      if (channelFilter === 'unread' && c.unread_count === 0) return false
      if (channelFilter === 'leads' && !c.lead) return false
      if (channelFilter === 'missed' && c.lead?.source !== 'missed_call' && !c.last_message_preview?.toLowerCase().includes('missed')) return false

      // Trade filter across all 21 trades
      if (selectedTrade !== 'all') {
        const tradeMatch = c.lead?.service_needed?.toLowerCase().includes(selectedTrade.toLowerCase())
        if (!tradeMatch) return false
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchName = c.contact?.name?.toLowerCase().includes(q)
        const matchPhone = c.contact?.phone?.includes(q)
        const matchAddress = c.contact?.address?.toLowerCase().includes(q)
        const matchMsg = c.last_message_preview?.toLowerCase().includes(q)
        const matchService = c.lead?.service_needed?.toLowerCase().includes(q)
        return matchName || matchPhone || matchAddress || matchMsg || matchService
      }

      return true
    })
  }, [conversations, channelFilter, selectedTrade, search])

  return (
    <div className="h-[calc(100dvh-3.5rem-3.5rem)] md:h-[calc(100vh-8.5rem)] flex md:rounded-2xl md:border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
      
      {/* ========================================================================= */}
      {/* 1. LEFT PANE: CHANNELS & CONVERSATION DIRECTORY                           */}
      {/* ========================================================================= */}
      <div className={cn(
        "w-full md:w-84 lg:w-92 border-r border-slate-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 shrink-0",
        mobileViewThread ? "hidden md:flex" : "flex"
      )}>
        {/* Header & Controls */}
        <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800 space-y-3 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                Inbound Communications
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowComposeModal(true)}
                className="h-7 px-2 rounded-lg flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-2xs transition-colors cursor-pointer"
                title="Compose new SMS"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => refetchConvs()}
                disabled={loadingConvs}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Refresh conversations"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loadingConvs && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Quick Channels / Triage Filter Pills */}
          <div className="grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setChannelFilter('all')}
              className={cn(
                "py-1.5 rounded-lg text-center transition-colors cursor-pointer",
                channelFilter === 'all'
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              All <span className="tabular-nums opacity-70">({conversations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setChannelFilter('unread')}
              className={cn(
                "py-1.5 rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center gap-1",
                channelFilter === 'unread'
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Unread
              {totalUnread > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {totalUnread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setChannelFilter('leads')}
              className={cn(
                "py-1.5 rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center gap-1",
                channelFilter === 'leads'
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Leads
              {totalLeads > 0 && (
                <span className="tabular-nums opacity-70">({totalLeads})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setChannelFilter('missed')}
              className={cn(
                "py-1.5 rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center gap-1",
                channelFilter === 'missed'
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Missed
              {totalMissed > 0 && (
                <span className="tabular-nums opacity-70">({totalMissed})</span>
              )}
            </button>
          </div>

          {/* Search & Universal Trade Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
              <Input
                placeholder="Search name, phone, address, text..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8.5 h-9 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Trade Filter (Clean Workspace Badge & Expandable Filter) */}
            {showTradeFilter ? (
              <div className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <select
                  value={selectedTrade}
                  onChange={e => setSelectedTrade(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-1.5 px-2 text-slate-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  <option value="all">All Trades (21)</option>
                  {orgIndustry && orgIndustry !== 'general' && (
                    <option value={orgIndustry}>★ {getIndustryPreset(orgIndustry).name} (My Trade)</option>
                  )}
                  {INDUSTRY_LIST.filter(ind => ind.id !== orgIndustry).map(ind => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShowTradeFilter(false)
                    setSelectedTrade('all')
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 cursor-pointer"
                  title="Close filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 px-0.5">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-slate-600 dark:text-zinc-400">{getIndustryPreset(orgIndustry).name.split('&')[0].trim()} Workspace</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowTradeFilter(true)}
                  className="text-[11px] text-blue-600 hover:underline dark:text-blue-400 shrink-0 cursor-pointer"
                >
                  Filter Trade
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
          {loadingConvs ? (
            <div className="p-3.5 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-1.5 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-28 bg-slate-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-10 bg-slate-100 dark:bg-zinc-800/60 rounded" />
                  </div>
                  <div className="h-3 w-44 bg-slate-100/70 dark:bg-zinc-800/40 rounded" />
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
              <InboxIcon className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-zinc-300">No conversations found</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                {channelFilter === 'unread'
                  ? "You're caught up with all messages."
                  : channelFilter === 'leads'
                    ? "No incoming leads found under this filter."
                    : "Incoming customer messages will show up here."}
              </p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConvId}
                onClick={() => {
                  setActiveConvId(conv.id)
                  setMobileViewThread(true)
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CENTER PANE: ACTIVE THREAD & TOP ACTION RAIL                           */}
      {/* ========================================================================= */}
      <div className={cn(
        "flex-1 flex flex-col bg-slate-50/50 dark:bg-zinc-950 min-w-0",
        !mobileViewThread ? "hidden md:flex" : "flex"
      )}>
        {activeConv ? (
          <>
            {/* Top Operational Action Rail */}
            <div className="min-h-14 border-b border-slate-200 dark:border-zinc-800 px-3.5 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 bg-white dark:bg-zinc-950 shadow-2xs">
              
              {/* Left: Contact Identity */}
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileViewThread(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-900 md:hidden shrink-0 cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                      {activeConv.contact?.name || activeConv.contact?.phone}
                    </span>
                    {activeConv.contact?.name && (
                      <a
                        href={`tel:${activeConv.contact.phone}`}
                        className="text-[11px] text-slate-500 hover:text-blue-600 dark:text-zinc-400 font-mono truncate"
                      >
                        {activeConv.contact.phone}
                      </a>
                    )}
                  </div>

                  {activeConv.contact?.address ? (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      <span>{activeConv.contact.address}</span>
                    </p>
                  ) : activeConv.lead?.service_needed ? (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1 font-medium">
                      <Wrench className="h-3 w-3 shrink-0 text-slate-400" />
                      <span>{activeConv.lead.service_needed}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Right: 1-Tap Truck Actions & Lead Stage */}
              <div className="flex items-center flex-wrap gap-1.5 shrink-0">
                
                {/* 1. Phone Call CTA */}
                <a
                  href={`tel:${activeConv.contact?.phone}`}
                  aria-label="Call customer directly"
                  className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] sm:min-w-0 sm:min-h-[38px] h-8 sm:h-8.5 px-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                  title="Call customer directly"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Call</span>
                </a>

                {/* 2. Fast Estimate CTA */}
                <Link
                  href={`/client/quotes?contact_id=${activeConv.contact_id}&customer_name=${encodeURIComponent(activeConv.contact?.name || '')}&from_inbox=true`}
                  className="inline-flex items-center justify-center gap-1 h-8 sm:h-8.5 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-blue-300 dark:hover:border-zinc-700 hover:text-blue-600 transition-colors shadow-2xs"
                  title="Create Quote for customer"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>+ Quote</span>
                </Link>

                {/* 3. Fast Appointment CTA */}
                <Link
                  href={`/client/calendar?contact_id=${activeConv.contact_id}&customer_name=${encodeURIComponent(activeConv.contact?.name || '')}&from_inbox=true`}
                  className="inline-flex items-center justify-center gap-1 h-8 sm:h-8.5 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-emerald-300 dark:hover:border-zinc-700 hover:text-emerald-600 transition-colors shadow-2xs"
                  title="Schedule Job on Dispatch Calendar"
                >
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>+ Job</span>
                </Link>

                {/* 4. Lead Stage Dropdown Segment */}
                <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-0.5 text-[11px] font-semibold">
                  <span className="px-1.5 text-[10px] text-slate-400 uppercase font-bold tracking-wider hidden lg:inline">
                    Stage:
                  </span>
                  <select
                    disabled={updatingStage}
                    value={activeConv.lead?.status || 'new'}
                    onChange={e => handleUpdateLeadStatus(e.target.value as any)}
                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer py-1 pr-1.5"
                  >
                    <option value="new">● New</option>
                    <option value="contacted">● Contacted</option>
                    <option value="booked">● Booked</option>
                    <option value="lost">● Archived</option>
                  </select>
                </div>

                {/* 5. Dossier Toggle (Desktop) */}
                <button
                  type="button"
                  onClick={() => setDossierOpen(!dossierOpen)}
                  className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-zinc-900 transition-colors"
                  title={dossierOpen ? "Collapse Dossier" : "Expand Dossier"}
                >
                  {dossierOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>

                {/* Mobile Dossier Drawer Trigger */}
                <button
                  type="button"
                  onClick={() => setMobileDossierOpen(true)}
                  className="lg:hidden h-8 px-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 text-xs font-semibold bg-white dark:bg-zinc-900"
                >
                  Dossier
                </button>
              </div>
            </div>

            {/* Message History Feed */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/40 dark:bg-zinc-950"
            >
              {hasMoreOlder && (
                <div className="text-center py-1">
                  <button
                    type="button"
                    onClick={handleLoadOlderMessages}
                    disabled={loadingOlder}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors disabled:opacity-50"
                  >
                    {loadingOlder ? 'Loading older messages...' : 'Load older messages'}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className="h-10 w-48 rounded-xl bg-slate-200 dark:bg-zinc-900 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500 dark:text-zinc-400 space-y-2">
                  <MessageSquare className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto" />
                  <p className="font-semibold text-slate-700 dark:text-zinc-300">No messages in this conversation yet</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">Send an SMS below to start the conversation.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Canned Templates & SMS Composer */}
            <div className="border-t border-slate-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-950 space-y-2.5 shrink-0 shadow-xs">
              <CannedSnippetsBar onSelect={text => setReplyText(text)} />

              <form onSubmit={handleSendReply} className="flex gap-2 items-center">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type an SMS reply (or select template)..."
                  aria-label="Type an SMS reply"
                  className="flex-1 min-h-[44px] h-11 text-xs sm:text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 px-3.5"
                  disabled={sending}
                />
                <Button 
                  type="submit" 
                  disabled={!replyText.trim() || sending}
                  size="touch"
                  aria-label="Send SMS message"
                  className="min-h-[44px] h-11 px-4 gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0 shadow-xs transition-colors cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-zinc-400 space-y-2">
            <InboxIcon className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Select a conversation</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs">
              Choose a customer on the left to review incoming missed calls, SMS history, or dispatch a quick reply.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT PANE: CUSTOMER DOSSIER & LEAD INTELLIGENCE                       */}
      {/* ========================================================================= */}
      {activeConv && dossierOpen && (
        <div className="hidden lg:flex w-80 border-l border-slate-200 dark:border-zinc-800 flex-col bg-white dark:bg-zinc-950 p-4 space-y-4 shrink-0 overflow-y-auto">
          
          {/* Customer Overview */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Customer Dossier
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-1 truncate">
              {activeConv.contact?.name || 'Unsaved Caller'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">{activeConv.contact?.phone}</p>
            {activeConv.contact?.email && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{activeConv.contact.email}</p>
            )}
          </div>

          {/* Lead Intelligence Card */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                <Target className="h-3 w-3 text-blue-600" /> Lead Pipeline
              </span>
              {activeConv.lead?.status ? (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  activeConv.lead.status === 'new' ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" :
                  activeConv.lead.status === 'contacted' ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                  activeConv.lead.status === 'booked' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                  "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                )}>
                  {activeConv.lead.status}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Unregistered Lead</span>
              )}
            </div>

            {/* Urgency & Source */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] text-slate-400 block font-medium">Source</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 capitalize">
                  {activeConv.lead?.source === 'missed_call' ? 'Missed Call' : (activeConv.lead?.source || 'Inbound SMS')}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] text-slate-400 block font-medium">Urgency</span>
                <span className={cn(
                  "font-semibold capitalize",
                  activeConv.lead?.urgency === 'emergency' ? "text-rose-600 dark:text-rose-400 font-bold" :
                  activeConv.lead?.urgency === 'high' ? "text-amber-600 dark:text-amber-400 font-bold" :
                  "text-slate-800 dark:text-zinc-200"
                )}>
                  {activeConv.lead?.urgency || 'Normal'}
                </span>
              </div>
            </div>

            {/* Trade / Service Requested */}
            {activeConv.lead?.service_needed && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Requested Service</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 block">
                  {activeConv.lead.service_needed}
                </span>
              </div>
            )}

            {/* Estimated Value */}
            {activeConv.lead?.estimated_value != null && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-500">Estimated Deal Value</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                  ${Number(activeConv.lead.estimated_value).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Service Address & Notes */}
          {activeConv.contact?.address && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-500" /> Service Location
              </div>
              <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                {activeConv.contact.address}
              </p>
            </div>
          )}

          {activeConv.contact?.notes && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Customer Notes
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                {activeConv.contact.notes}
              </p>
            </div>
          )}

          {/* CRM Profile Deep Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 mt-auto space-y-2">
            <Link
              href={`/client/customers/${activeConv.contact_id}`}
              aria-label="View customer profile"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <span>Full Customer Dossier & CRM</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS & DRAWERS                                                       */}
      {/* ========================================================================= */}

      {/* Compose New Message Modal */}
      <Modal
        open={showComposeModal}
        onOpenChange={setShowComposeModal}
        title="Compose Inbound SMS & Lead"
        description="Dispatch a text to an existing customer or initialize a new inbound lead."
      >
        <form onSubmit={handleComposeSend} className="space-y-3.5 pt-1">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Select Customer
            </label>
            <select
              value={composeContactId}
              onChange={e => {
                setComposeContactId(e.target.value)
                if (e.target.value) {
                  setComposeCustomPhone('')
                  setComposeCustomName('')
                }
              }}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-slate-900 dark:text-zinc-100"
            >
              <option value="">-- Choose existing customer, or enter below --</option>
              {customersList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Unnamed'} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {!composeContactId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Customer Phone *
                </label>
                <Input
                  placeholder="(555) 000-0000"
                  value={composeCustomPhone}
                  onChange={e => setComposeCustomPhone(e.target.value)}
                  className="h-8.5 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Customer Name
                </label>
                <Input
                  placeholder="e.g. John Smith"
                  value={composeCustomName}
                  onChange={e => setComposeCustomName(e.target.value)}
                  className="h-8.5 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
              </div>
            </div>
          )}

          {/* Trade & Urgency Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                Trade Service
              </label>
              <select
                value={composeTrade}
                onChange={e => setComposeTrade(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-slate-900 dark:text-zinc-100"
              >
                {orgIndustry && orgIndustry !== 'general' && (
                  <option value={getIndustryPreset(orgIndustry).name}>
                    ★ {getIndustryPreset(orgIndustry).name} (My Primary Trade)
                  </option>
                )}
                <option value="">General Service</option>
                {INDUSTRY_LIST.filter(ind => ind.id !== orgIndustry).map(ind => (
                  <option key={ind.id} value={ind.name}>
                    {ind.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                Urgency Level
              </label>
              <select
                value={composeUrgency}
                onChange={e => setComposeUrgency(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-slate-900 dark:text-zinc-100"
              >
                <option value="normal">Normal</option>
                <option value="high">High Priority</option>
                <option value="emergency">Emergency / Same Day</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Message Text *
            </label>
            <textarea
              required
              rows={3}
              value={composeMessage}
              onChange={e => setComposeMessage(e.target.value)}
              placeholder="Type your SMS message to the customer..."
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2.5 text-slate-900 dark:text-zinc-100 resize-none focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowComposeModal(false)}
              disabled={composing}
              className="h-8 text-xs border-slate-200 dark:border-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={composing || !composeMessage.trim() || (!composeContactId && !composeCustomPhone.trim())}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
            >
              {composing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              <span>Send SMS</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mobile Dossier Drawer Modal */}
      {mobileDossierOpen && activeConv && (
        <Modal
          open={mobileDossierOpen}
          onOpenChange={setMobileDossierOpen}
          title="Customer Dossier & Lead Info"
        >
          <div className="space-y-4 py-1 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer</span>
              <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">{activeConv.contact?.name || 'Unsaved Caller'}</p>
              <p className="font-mono text-xs text-slate-500">{activeConv.contact?.phone}</p>
            </div>

            {activeConv.contact?.address && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Service Address</span>
                <p className="text-slate-800 dark:text-zinc-200">{activeConv.contact.address}</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-zinc-300">Lead Stage</span>
                <select
                  value={activeConv.lead?.status || 'new'}
                  onChange={e => handleUpdateLeadStatus(e.target.value as any)}
                  className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold p-1"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="booked">Booked</option>
                  <option value="lost">Archived</option>
                </select>
              </div>

              {activeConv.lead?.service_needed && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                  <span className="text-[10px] text-slate-400 block">Requested Service</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">{activeConv.lead.service_needed}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href={`/client/customers/${activeConv.contact_id}`}
                className="w-full text-center py-2.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-semibold text-xs border border-slate-200 dark:border-zinc-700"
              >
                Open Full Customer Record
              </Link>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
