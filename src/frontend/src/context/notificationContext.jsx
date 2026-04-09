import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './authContext'
import { useUnread } from './unreadContext'
import { apiCall } from '../utils/apiClient'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
    const { auth } = useAuth()
    const { unreadCounts, clearUnread } = useUnread()
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

    // Convert DM unreadCounts to pseudo-notifications and merge with real notifications
    const combinedNotifications = useMemo(() => {
        const dmNotifs = Object.entries(unreadCounts).map(([slug, count]) => {
            // slug format: "DM-{lower_id}-{higher_id}"
            const parts = slug.split('-')
            const otherId = parts.length === 3 ? (parseInt(parts[1]) === userId ? parseInt(parts[2]) : parseInt(parts[1])) : null
            return {
                id: `dm-${slug}`, // Pseudo ID for DM notifications
                type: 'unread_chat',
                message: `${count} unread message${count !== 1 ? 's' : ''}`,
                read: false,
                created_at: new Date().toISOString(),
                room_slug: slug,
                other_user_id: otherId,
                unread_count: count,
            }
        })

        // Merge and sort by created_at (DMs are synthetic, so put them at the top)
        const merged = [...dmNotifs, ...notifications]
        return merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }, [notifications, unreadCounts, userId])

    // Calculate unread count including both real notifications and DM pseudo-notifications
    const totalUnreadCount = useMemo(() => {
        const realNotifUnread = notifications.filter(n => !n.read).length
        const dmUnreadTotal = Object.values(unreadCounts).reduce((a, b) => a + b, 0)
        return realNotifUnread + dmUnreadTotal
    }, [notifications, unreadCounts])

    const fetchNotifications = useCallback(async () => {
        const r = await apiCall('/api/users/notifications')
        const data = await r.json()
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.read).length)
    }, [])

    const markRead = useCallback(async (id) => {
        // Handle DM pseudo-notifications differently
        if (typeof id === 'string' && id.startsWith('dm-')) {
            const slug = id.replace('dm-', '')
            clearUnread(slug)
            return
        }

        await apiCall(`/api/users/notifications/${id}/read`, { method: 'PUT' })
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
    }, [clearUnread])

    const markAllRead = useCallback(async () => {
        await apiCall('/api/users/notifications/read-all', { method: 'PUT' })
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)

        // Clear all DM unread counts
        Object.keys(unreadCounts).forEach(slug => {
            clearUnread(slug)
        })
    }, [unreadCounts, clearUnread])

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
        notifications: combinedNotifications,
        unreadCount: totalUnreadCount,
        fetchNotifications,
        markRead,
        markAllRead,
        removeNotification,
        setInviteVisible,
    }), [combinedNotifications, totalUnreadCount, fetchNotifications, markRead, markAllRead, removeNotification, setInviteVisible])

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
