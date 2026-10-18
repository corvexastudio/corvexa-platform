'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  PhoneCall,
  MessageSquare,
  Calendar,
  CreditCard,
  Star,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Settings,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface InAppNotification {
  id: string
  org_id: string
  user_id?: string | null
  title: string
  message: string
  link?: string | null
  event_type?: string | null
  priority?: 'critical' | 'important' | 'normal' | 'low' | null
  is_read: boolean
  created_at: string
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Recently'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Recently'
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHour / 24)

    if (diffSec < 45) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHour < 24) return `${diffHour}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

function getEventIcon(eventType?: string | null) {
  switch (eventType) {
    case 'missed_call_recovered':
      return {
        icon: PhoneCall,
        bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      }
    case 'customer_reply':
      return {
        icon: MessageSquare,
        bgColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      }
    case 'new_booking':
      return {
        icon: Calendar,
        bgColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }
    case 'booking_cancelled':
    case 'booking_rescheduled':
      return {
        icon: Calendar,
        bgColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      }
    case 'payment_received':
      return {
        icon: CreditCard,
        bgColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }
    case 'payment_failed':
      return {
        icon: AlertCircle,
        bgColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      }
    case 'review_received':
      return {
        icon: Star,
        bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      }
    default:
      return {
        icon: Bell,
        bgColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
      }
  }
}

export interface NotificationCenterProps {
  className?: string
  orgId?: string | null
}

export function NotificationCenter({ className, orgId: initialOrgId }: NotificationCenterProps) {
  const supabase = createClient()
  const router = useRouter()
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  }, [router])

  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [markingAll, setMarkingAll] = useState<boolean>(false)
  const [orgId, setOrgId] = useState<string | null>(initialOrgId || null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Track client hydration mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync prop changes
  useEffect(() => {
    if (initialOrgId && initialOrgId !== orgId) {
      setOrgId(initialOrgId)
    }
  }, [initialOrgId, orgId])

  // Stable notification fetcher
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/client/notifications?limit=30')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS_FETCH_ERROR]', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const fetchNotificationsRef = useRef(fetchNotifications)
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications
  }, [fetchNotifications])

  // Initial load & organization ID detection
  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        if (!initialOrgId) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user && isMounted) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('org_id')
              .eq('id', user.id)
              .maybeSingle()

            if (profile?.org_id && isMounted) {
              setOrgId(profile.org_id)
            }
          }
        }
      } catch {
        // non-blocking
      }
      if (isMounted) {
        fetchNotificationsRef.current()
      }
    }

    init()

    // Polling interval every 25 seconds
    const interval = setInterval(() => {
      fetchNotificationsRef.current(true)
    }, 25000)

    // Window focus refresh
    const onFocus = () => fetchNotificationsRef.current(true)
    window.addEventListener('focus', onFocus)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [supabase, initialOrgId])

  // Realtime subscription on notifications table with robust error handling
  useEffect(() => {
    if (!orgId) return

    let channel: any = null
    try {
      channel = supabase
        .channel(`inapp_notifications:${orgId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `org_id=eq.${orgId}`
          },
          (payload: any) => {
            try {
              if (payload.eventType === 'INSERT') {
                const newRow = payload.new as InAppNotification
                setNotifications(prev => [newRow, ...prev.filter(n => n.id !== newRow.id)])
                setUnreadCount(prev => prev + 1)
                toast.info(newRow.title || 'New Notification', {
                  description: newRow.message,
                  action: newRow.link ? {
                    label: 'View',
                    onClick: () => routerRef.current.push(newRow.link!)
                  } : undefined
                })
              } else {
                fetchNotificationsRef.current(true)
              }
            } catch (err) {
              console.warn('[NOTIF_REALTIME_EVENT_ERROR]', err)
            }
          }
        )
        .subscribe((status: string, err?: any) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[NOTIF_REALTIME_CHANNEL_ERROR]', err)
          }
        })
    } catch (err) {
      console.warn('[NOTIF_REALTIME_SETUP_ERROR]', err)
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {
          // non-blocking cleanup
        }
      }
    }
  }, [orgId, supabase])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)

    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)

    try {
      const res = await fetch('/api/client/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true })
      })

      if (!res.ok) {
        fetchNotifications(true)
      } else {
        toast.success('All notifications marked as read')
      }
    } catch {
      fetchNotifications(true)
    } finally {
      setMarkingAll(false)
    }
  }

  // Toggle single notification read / unread
  const handleToggleRead = async (e: React.MouseEvent, item: InAppNotification) => {
    e.stopPropagation()
    const targetState = !item.is_read

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === item.id ? { ...n, is_read: targetState } : n))
    )
    setUnreadCount(prev => Math.max(0, prev + (targetState ? -1 : 1)))

    try {
      await fetch(`/api/client/notifications/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: targetState })
      })
    } catch {
      fetchNotifications(true)
    }
  }

  // Delete notification
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const deletedItem = notifications.find(n => n.id === id)

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (deletedItem && !deletedItem.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    try {
      await fetch(`/api/client/notifications/${id}`, { method: 'DELETE' })
    } catch {
      fetchNotifications(true)
    }
  }

  // Clear all read notifications
  const handleClearRead = async () => {
    setNotifications(prev => prev.filter(n => !n.is_read))
    try {
      await fetch('/api/client/notifications?clear_all_read=true', { method: 'DELETE' })
      toast.success('Cleared read notifications')
    } catch {
      fetchNotifications(true)
    }
  }

  // Click on a notification item
  const handleItemClick = async (item: InAppNotification) => {
    if (!item.is_read) {
      // Mark as read in background
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      fetch(`/api/client/notifications/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      }).catch(() => null)
    }

    setIsOpen(false)

    if (item.link) {
      router.push(item.link)
    }
  }

  const filteredNotifications = notifications.filter(n =>
    activeTab === 'unread' ? !n.is_read : true
  )
  if (!mounted) {
    return (
      <div className={cn('relative inline-flex items-center', className)}>
        <button
          type="button"
          disabled
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-400 dark:text-zinc-500 opacity-60"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={cn('relative inline-flex items-center', className)} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer shadow-2xs',
          isOpen
            ? 'bg-slate-100 border-slate-300 text-slate-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
        )}
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-zinc-950 tabular-nums animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 px-4 py-3 bg-slate-50/90 dark:bg-zinc-900/90 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  {markingAll ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3 w-3 text-blue-400" />
                  )}
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-zinc-800/60 px-3 py-1.5 bg-slate-100/60 dark:bg-zinc-950/40 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                activeTab === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                activeTab === 'unread'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/40">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-zinc-500 text-xs gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-zinc-400" />
                <span>Loading notifications...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="p-3 rounded-full bg-slate-100 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 mb-2.5 border border-slate-200 dark:border-zinc-800">
                  <BellOff className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-zinc-300">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 max-w-[220px]">
                  {activeTab === 'unread'
                    ? "You're all caught up! Check back when new calls or bookings arrive."
                    : 'Missed-call alerts, customer replies, and bookings will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const iconMeta = getEventIcon(item.event_type)
                const IconComponent = iconMeta.icon

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'group relative flex items-start gap-3 p-3 transition-colors cursor-pointer',
                      item.is_read
                        ? 'bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/40 opacity-80 hover:opacity-100'
                        : 'bg-blue-50/50 hover:bg-blue-50/80 dark:bg-blue-950/20 dark:hover:bg-blue-950/30'
                    )}
                  >
                    {/* Unread indicator dot */}
                    {!item.is_read && (
                      <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-blue-600 shadow-sm shadow-blue-500/50" />
                    )}

                    {/* Event Icon */}
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border mt-0.5',
                        iconMeta.bgColor
                      )}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            'text-xs font-medium truncate',
                            item.is_read ? 'text-slate-600 dark:text-zinc-300' : 'text-slate-900 dark:text-zinc-100 font-semibold'
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0 font-mono">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>

                      {item.link && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1.5 font-medium">
                          <span>Open details</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>

                    {/* Quick actions on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={(e) => handleToggleRead(e, item)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                        title={item.is_read ? 'Mark as unread' : 'Mark as read'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-200 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-zinc-800 transition-colors"
                        title="Dismiss notification"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-zinc-800/80 px-3 py-2 bg-slate-50 dark:bg-zinc-950/60 text-[11px] text-slate-500 dark:text-zinc-400">
            <Link
              href="/client/settings"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors"
            >
              <Settings className="h-3 w-3" />
              <span>Notification settings</span>
            </Link>

            {notifications.some(n => n.is_read) && (
              <button
                type="button"
                onClick={handleClearRead}
                className="text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Clear read
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
