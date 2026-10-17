import test from 'node:test'
import assert from 'node:assert/strict'
import { GET as getNotifications, PATCH as patchNotifications, DELETE as deleteNotifications } from '../src/app/api/client/notifications/route.ts'
import { PATCH as patchSingleNotification, DELETE as deleteSingleNotification } from '../src/app/api/client/notifications/[id]/route.ts'

function createMockSupabase(initialNotifications = []) {
  const store = {
    profiles: [
      { id: 'usr-123', org_id: 'org-test-123', role: 'owner', full_name: 'Test Owner', email: 'owner@test.com' }
    ],
    organizations: [
      { id: 'org-test-123', name: 'Acme Test Services' }
    ],
    notifications: [...initialNotifications]
  }

  return {
    _store: store,
    auth: {
      getUser: async () => ({
        data: { user: { id: 'usr-123', email: 'owner@test.com' } },
        error: null
      })
    },
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: store.profiles[0],
                error: null
              }),
              single: async () => ({
                data: store.profiles[0],
                error: null
              })
            })
          })
        }
      }

      if (table === 'notifications') {
        return {
          select: (cols, opts) => {
            if (opts?.head) {
              return {
                eq: (c1, v1) => ({
                  eq: (c2, v2) => ({
                    count: store.notifications.filter(n => n.org_id === v1 && n.is_read === v2).length,
                    error: null
                  })
                })
              }
            }

            return {
              eq: (c1, v1) => ({
                order: () => ({
                  limit: (lim) => ({
                    data: store.notifications.filter(n => n.org_id === v1).slice(0, lim),
                    error: null
                  }),
                  eq: (c2, v2) => ({
                    limit: (lim) => ({
                      data: store.notifications.filter(n => n.org_id === v1 && n.is_read === v2).slice(0, lim),
                      error: null
                    })
                  })
                })
              })
            }
          },
          update: (payload) => ({
            eq: (c1, v1) => ({
              eq: (c2, v2) => {
                store.notifications.forEach(n => {
                  if (n[c1] === v1 && n[c2] === v2) {
                    Object.assign(n, payload)
                  }
                })
                return {
                  error: null,
                  select: () => ({
                    maybeSingle: async () => {
                      const item = store.notifications.find(n => n[c1] === v1)
                      return { data: item, error: null }
                    }
                  })
                }
              },
              select: () => ({
                maybeSingle: async () => {
                  const item = store.notifications.find(n => n[c1] === v1)
                  if (item) Object.assign(item, payload)
                  return { data: item, error: null }
                }
              })
            })
          }),
          delete: () => ({
            eq: (c1, v1) => ({
              eq: (c2, v2) => {
                const idx = store.notifications.findIndex(n => n[c1] === v1 && n[c2] === v2)
                if (idx !== -1) store.notifications.splice(idx, 1)
                return { error: null }
              }
            })
          })
        }
      }

      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) })
      }
    }
  }
}

test('1. In-App Notifications API: GET returns tenant-scoped notifications and unread count', async () => {
  const initial = [
    {
      id: 'notif-1',
      org_id: 'org-test-123',
      title: 'Missed Call Recovered',
      message: 'Automatic recovery text sent to caller',
      event_type: 'missed_call_recovered',
      is_read: false,
      created_at: new Date().toISOString()
    },
    {
      id: 'notif-2',
      org_id: 'org-test-123',
      title: 'New Appointment Booked',
      message: 'John Doe booked AC Diagnostic',
      event_type: 'new_booking',
      is_read: true,
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ]

  const mockSupabase = createMockSupabase(initial)
  const req = new Request('http://localhost/api/client/notifications?limit=25')
  const res = await getNotifications(req, { customSupabase: mockSupabase })
  assert.strictEqual(res.status, 200)

  const body = await res.json()
  assert.strictEqual(body.unread_count, 1)
  assert.strictEqual(body.notifications.length, 2)
  assert.strictEqual(body.notifications[0].title, 'Missed Call Recovered')
})

test('2. In-App Notifications API: PATCH marks all notifications as read', async () => {
  const initial = [
    { id: 'notif-1', org_id: 'org-test-123', is_read: false },
    { id: 'notif-2', org_id: 'org-test-123', is_read: false }
  ]
  const mockSupabase = createMockSupabase(initial)

  const req = new Request('http://localhost/api/client/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mark_all_read: true })
  })

  const res = await patchNotifications(req, { customSupabase: mockSupabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.marked_all_read, true)
  assert.strictEqual(mockSupabase._store.notifications.every(n => n.is_read), true)
})

test('3. In-App Notifications API: PATCH updates single notification read state', async () => {
  const initial = [
    { id: 'notif-1', org_id: 'org-test-123', is_read: false }
  ]
  const mockSupabase = createMockSupabase(initial)

  const req = new Request('http://localhost/api/client/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'notif-1', is_read: true })
  })

  const res = await patchNotifications(req, { customSupabase: mockSupabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.notification.is_read, true)
})

test('4. In-App Notifications API: DELETE removes notification by ID', async () => {
  const initial = [
    { id: 'notif-to-delete', org_id: 'org-test-123', is_read: true }
  ]
  const mockSupabase = createMockSupabase(initial)

  const req = new Request('http://localhost/api/client/notifications?id=notif-to-delete', {
    method: 'DELETE'
  })

  const res = await deleteNotifications(req, { customSupabase: mockSupabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.deleted_id, 'notif-to-delete')
  assert.strictEqual(mockSupabase._store.notifications.length, 0)
})

test('5. Single Notification Route: [id] handles PATCH and DELETE', async () => {
  const initial = [
    { id: 'notif-uuid-456', org_id: 'org-test-123', is_read: false }
  ]
  const mockSupabase = createMockSupabase(initial)

  const patchReq = new Request('http://localhost/api/client/notifications/notif-uuid-456', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: true })
  })

  const patchRes = await patchSingleNotification(patchReq, {
    params: Promise.resolve({ id: 'notif-uuid-456' }),
    customSupabase: mockSupabase
  })
  assert.strictEqual(patchRes.status, 200)

  const delReq = new Request('http://localhost/api/client/notifications/notif-uuid-456', {
    method: 'DELETE'
  })
  const delRes = await deleteSingleNotification(delReq, {
    params: Promise.resolve({ id: 'notif-uuid-456' }),
    customSupabase: mockSupabase
  })
  assert.strictEqual(delRes.status, 200)
  assert.strictEqual(mockSupabase._store.notifications.length, 0)
})
