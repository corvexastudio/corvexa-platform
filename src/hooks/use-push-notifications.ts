'use client'

import { useState, useEffect, useCallback } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export interface UsePushNotificationsResult {
  isSupported: boolean
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  loading: boolean
  error: string | null
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setIsSupported(false)
      setPermission('unsupported')
      setLoading(false)
      return
    }

    setIsSupported(true)
    setPermission(Notification.permission)

    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        setIsSubscribed(!!sub)
      } else {
        setIsSubscribed(false)
      }
    } catch (err: any) {
      console.warn('[PUSH HOOK] Failed to check status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications are not supported on this browser.')
      return false
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Request user permission explicitly
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        setError(
          perm === 'denied'
            ? 'Notification permission was denied. Please allow notifications in site settings.'
            : 'Notification permission was dismissed.'
        )
        setLoading(false)
        return false
      }

      // 2. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // 3. Obtain VAPID Public Key
      let vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        const res = await fetch('/api/client/notifications/subscribe')
        if (res.ok) {
          const data = await res.json()
          vapidKey = data.vapidPublicKey
        }
      }

      if (!vapidKey) {
        setError('Server VAPID public key is not configured.')
        setLoading(false)
        return false
      }

      // 4. Subscribe with PushManager
      const convertedKey = urlBase64ToUint8Array(vapidKey)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource
      })

      const rawKey = sub.getKey('p256dh')
      const rawAuth = sub.getKey('auth')
      const p256dh = rawKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey)))) : ''
      const auth = rawAuth ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth)))) : ''

      // 5. Send subscription to server
      const saveRes = await fetch('/api/client/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh, auth },
          userAgent: navigator.userAgent,
          deviceLabel: 'Browser'
        })
      })

      if (!saveRes.ok) {
        const errJson = await saveRes.json().catch(() => ({}))
        throw new Error(errJson.error || 'Failed to save subscription on server')
      }

      setIsSubscribed(true)
      setLoading(false)
      return true
    } catch (err: any) {
      console.error('[PUSH SUBSCRIBE ERROR]', err)
      setError(err?.message || 'Failed to activate push notifications')
      setLoading(false)
      return false
    }
  }, [isSupported])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/client/notifications/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint })
          })
          await sub.unsubscribe()
        }
      }
      setIsSubscribed(false)
      setLoading(false)
      return true
    } catch (err: any) {
      console.error('[PUSH UNSUBSCRIBE ERROR]', err)
      setError(err?.message || 'Failed to unsubscribe')
      setLoading(false)
      return false
    }
  }, [])

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe
  }
}
