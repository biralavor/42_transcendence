import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './authContext'
import { useUnread } from './unreadContext'
import { apiCall } from '../utils/apiClient'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
    const { auth } = useAuth()
    const { unreadCounts, clearUnread, dmSenders } = useUnread()
    const [userId, setUserId] = useState(null)
    const [notifications, setNotifications] = useState([])
    const inviteVisibleRef = useRef(false)
    // Stable first-seen timestamp per DM room slug — set once, never updated, so sort order is stable
    const dmFirstSeenRef = useRef({})

    // Step 1: resolve integer user ID via /auth/me whenever token changes
    useEffect(() => {
        if (!auth.access_token) {
            setUserId(null)
            setNotifications([])
            dmFirstSeenRef.current = {}
            return
        }
        let cancelled = false
        apiCall('/api/users/auth/me')
            .then(r => r.json())
            .then(me => { if (!cancelled) setUserId(me.id) })
            .catch(() => {
                if (!cancelled) {
                    setUserId(null)
                    setNotifications([])
                }
            })
        return () => { cancelled = true }
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
                // Suppress badge for game_invite when FriendsSidebar is already showing the invite.
                // Mark as read so totalUnreadCount (derived from list) doesn't count it.
                const suppressed = notif.type === 'game_invite' && inviteVisibleRef.current
                const entry = { ...notif, read: notif.read || suppressed }
                setNotifications(prev =>
                    [entry, ...prev.filter(n => n.id !== notif.id)].slice(0, 20)
                )
            } catch {
                // ignore non-JSON frames
            }
        }

        return () => ws.close()
    }, [userId, auth.access_token])

    // Convert DM unreadCounts to pseudo-notifications and merge with real notifications
    const combinedNotifications = useMemo(() => {
        const dmNotifs = Object.entries(unreadCounts).map(([slug, count]) => {
            // Record first-seen time once per slug so sort order is stable across re-renders
            if (!dmFirstSeenRef.current[slug]) {
                dmFirstSeenRef.current[slug] = new Date().toISOString()
            }
            // slug format: "DM-{lower_id}-{higher_id}"
            const parts = slug.split('-')
            const otherId = parts.length === 3 ? (parseInt(parts[1]) === userId ? parseInt(parts[2]) : parseInt(parts[1])) : null
            const senderName = dmSenders[slug]
            const message = senderName
                ? `${count} unread message${count !== 1 ? 's' : ''} from ${senderName}`
                : `${count} unread message${count !== 1 ? 's' : ''}`
            return {
                id: `dm-${slug}`,
                type: 'unread_chat',
                message,
                read: false,
                created_at: dmFirstSeenRef.current[slug],
                room_slug: slug,
                other_user_id: otherId,
                unread_count: count,
            }
        })

        // Merge and sort by created_at (DMs are synthetic, so put them at the top)
        const merged = [...dmNotifs, ...notifications]
        return merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }, [notifications, unreadCounts, userId, dmSenders])

    // System notifications only — DM unreads are surfaced via useUnread() on the Chat link
    const totalUnreadCount = useMemo(
        () => notifications.filter(n => !n.read).length,
        [notifications]
    )

    const fetchNotifications = useCallback(async () => {
        const r = await apiCall('/api/users/notifications')
        const data = await r.json()
        setNotifications(data)
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
    }, [clearUnread])

    const markAllRead = useCallback(async () => {
        await apiCall('/api/users/notifications/read-all', { method: 'PUT' })
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))

        // Clear all DM unread counts
        Object.keys(unreadCounts).forEach(slug => {
            clearUnread(slug)
        })
    }, [unreadCounts, clearUnread])

    const removeNotification = useCallback(async (id) => {
        await apiCall(`/api/users/notifications/${id}`, { method: 'DELETE' })
        setNotifications(prev => prev.filter(n => n.id !== id))
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
