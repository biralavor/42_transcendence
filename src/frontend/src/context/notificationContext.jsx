import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './authContext'
import { apiCall } from '../utils/apiClient'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { auth } = useAuth()
  const [userId, setUserId] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const inviteVisibleRef = useRef(false)

  // Step 1: resolve integer user ID via /auth/me whenever token changes
  useEffect(() => {
    if (!auth.access_token) {
      setUserId(null)
      return
    }
    apiCall('/api/users/auth/me')
      .then(r => r.json())
      .then(me => setUserId(me.id))
      .catch(() => setUserId(null))
  }, [auth.access_token])

  // Step 2: open WS once userId is known
  useEffect(() => {
    if (!userId || !auth.access_token) return
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/users/ws/notifications/${userId}?token=${auth.access_token}`
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data)
        if (frame.type !== 'notification') return
        const notif = frame.notification
        setNotifications(prev => [notif, ...prev])
        if (!notif.read) {
          // Suppress badge increment for game_invite when FriendsSidebar is showing the invite UI
          if (notif.type === 'game_invite' && inviteVisibleRef.current) return
          setUnreadCount(prev => prev + 1)
        }
      } catch {
        // ignore non-JSON frames
      }
    }

    return () => ws.close()
  }, [userId, auth.access_token])

  const fetchNotifications = useCallback(async () => {
    const r = await apiCall('/api/users/notifications')
    const data = await r.json()
    setNotifications(data)
    setUnreadCount(data.filter(n => !n.read).length)
  }, [])

  const markRead = useCallback(async (id) => {
    await apiCall(`/api/users/notifications/${id}/read`, { method: 'PUT' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await apiCall('/api/users/notifications/read-all', { method: 'PUT' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const removeNotification = useCallback(async (id) => {
    await apiCall(`/api/users/notifications/${id}`, { method: 'DELETE' })
    setNotifications(prev => {
      const wasUnread = prev.some(n => n.id === id && !n.read)
      if (wasUnread) setUnreadCount(c => Math.max(0, c - 1))
      return prev.filter(n => n.id !== id)
    })
  }, [])

  const setInviteVisible = useCallback((visible) => {
    inviteVisibleRef.current = !!visible
  }, [])

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    removeNotification,
    setInviteVisible,
  }), [notifications, unreadCount, fetchNotifications, markRead, markAllRead, removeNotification, setInviteVisible])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (ctx === null) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
