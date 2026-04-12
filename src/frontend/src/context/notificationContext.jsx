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
    // Track WS connection state for smart polling
    const wsConnectedRef = useRef(false)
    const wsRef = useRef(null)

    // Define all useCallback hooks before useEffect hooks to avoid temporal dead zone
    const fetchNotifications = useCallback(async () => {
        try {
            const r = await apiCall('/api/users/notifications')
            if (!r.ok) {
                console.error('[notificationContext] Failed to fetch notifications:', r.status)
                setNotifications([])
                return
            }
            const data = await r.json()
            if (Array.isArray(data)) {
                setNotifications(data)
            } else {
                console.warn('[notificationContext] Invalid notifications response format, got:', typeof data, Object.keys(data))
                setNotifications([])
            }
        } catch (err) {
            console.error('[notificationContext] Error fetching notifications:', err.message)
            setNotifications([])
        }
    }, [])

    const markRead = useCallback(async (id) => {
        // Handle DM pseudo-notifications differently
        if (typeof id === 'string' && id.startsWith('dm-')) {
            const slug = id.replace('dm-', '')
            clearUnread(slug)
            return
        }

        try {
            const r = await apiCall(`/api/users/notifications/${id}/read`, { method: 'PUT' })
            if (!r.ok) {
                console.error(`[notificationContext] Failed to mark notification ${id} as read:`, r.status)
                // If 404, the notification doesn't exist in the backend, remove it from state
                if (r.status === 404) {
                    console.debug(`[notificationContext] Removing non-existent notification ${id} from state`)
                    setNotifications(prev => prev.filter(n => n.id !== id))
                }
                return
            }
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        } catch (err) {
            console.error(`[notificationContext] Error marking notification ${id} as read:`, err.message)
        }
    }, [clearUnread])

    const markAllRead = useCallback(async () => {
        try {
            const r = await apiCall('/api/users/notifications/read-all', { method: 'PUT' })
            if (!r.ok) {
                console.error('[notificationContext] Failed to mark all notifications as read:', r.status)
                return
            }
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))

            // Clear all DM unread counts
            Object.keys(unreadCounts).forEach(slug => {
                clearUnread(slug)
            })
        } catch (err) {
            console.error('[notificationContext] Error marking all notifications as read:', err.message)
        }
    }, [unreadCounts, clearUnread])

    const removeNotification = useCallback(async (id) => {
        try {
            const r = await apiCall(`/api/users/notifications/${id}`, { method: 'DELETE' })
            if (!r.ok) {
                console.error(`[notificationContext] Failed to remove notification ${id}:`, r.status)
                return
            }
            setNotifications(prev => prev.filter(n => n.id !== id))
        } catch (err) {
            console.error(`[notificationContext] Error removing notification ${id}:`, err.message)
        }
    }, [])

    const setInviteVisible = useCallback((visible) => {
        inviteVisibleRef.current = !!visible
    }, [])

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
            .then(r => {
                if (!r.ok) throw new Error(`Failed to fetch /auth/me: ${r.status}`)
                return r.json()
            })
            .then(me => {
                if (!cancelled && me?.id) setUserId(me.id)
            })
            .catch(err => {
                if (!cancelled) {
                    console.error('[notificationContext] Failed to get user ID:', err.message)
                    setUserId(null)
                    setNotifications([])
                    dmFirstSeenRef.current = {}
                }
            })
        return () => { cancelled = true }
    }, [auth.access_token])

    // Step 2: fetch initial notifications once userId is known
    useEffect(() => {
        if (!userId) return
        void fetchNotifications().catch(err => {
            console.error('[notificationContext] Failed to fetch initial notifications:', err.message)
        })
    }, [userId, fetchNotifications])

    // Step 3: open WS once userId is known
    useEffect(() => {
        if (!userId || !auth.access_token) return
        const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const url = `${scheme}//${window.location.host}/api/users/ws/notifications/${userId}?token=${auth.access_token}`
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            wsConnectedRef.current = true
        }

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

        ws.onclose = () => {
            wsConnectedRef.current = false
        }

        ws.onerror = () => {
            wsConnectedRef.current = false
        }

        return () => {
            wsConnectedRef.current = false
            ws.close()
            wsRef.current = null
        }
    }, [userId, auth.access_token])

    // Step 4: Smart polling - only when WS is disconnected or document is hidden
    // This reduces backend load significantly by avoiding redundant polling when WS is healthy
    useEffect(() => {
        if (!userId) return

        let pollInterval = null
        let pollTimeoutId = null
        let failureCount = 0

        const shouldPoll = () => {
            // Don't poll if WS is connected and document is visible
            return !wsConnectedRef.current || document.hidden
        }

        const poll = async () => {
            try {
                await fetchNotifications()
                failureCount = 0
            } catch (err) {
                failureCount++
                console.debug('[notificationContext] Smart polling error:', err.message)
            }

            if (shouldPoll()) {
                // Apply exponential backoff on repeated failures (cap at 15s), otherwise use 5s
                const backoffMultiplier = Math.min(failureCount * 2, 3) // Max 3x multiplier = 15s
                const nextInterval = 5000 * backoffMultiplier
                pollTimeoutId = setTimeout(poll, nextInterval)
            }
        }

        // Listen to visibility changes
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Pause polling when hidden
                if (pollTimeoutId) clearTimeout(pollTimeoutId)
                if (pollInterval) clearInterval(pollInterval)
                pollInterval = null
                pollTimeoutId = null
            } else if (shouldPoll()) {
                // Resume polling when visible and WS is disconnected
                poll()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Start polling if needed
        if (shouldPoll()) {
            poll()
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if (pollInterval) clearInterval(pollInterval)
            if (pollTimeoutId) clearTimeout(pollTimeoutId)
        }
    }, [userId, fetchNotifications])

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
        const sorted = merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        return sorted
    }, [notifications, unreadCounts, userId, dmSenders])

    // System notifications only — DM unreads are surfaced via useUnread() on the Chat link
    const totalUnreadCount = useMemo(
        () => notifications.filter(n => !n.read).length,
        [notifications]
    )

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
