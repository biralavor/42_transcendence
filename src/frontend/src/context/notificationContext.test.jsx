import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { NotificationProvider, useNotifications } from './notificationContext'

vi.mock('./authContext', () => ({
    useAuth: vi.fn(),
}))
import { useAuth } from './authContext'

vi.mock('./unreadContext', () => ({
    useUnread: vi.fn(),
}))
import { useUnread } from './unreadContext'

vi.mock('../utils/apiClient', () => ({
    apiCall: vi.fn(),
}))
import { apiCall } from '../utils/apiClient'

let mockWsInstance

class MockWebSocket {
    constructor(url) {
        this.url = url
        this.close = vi.fn()
        this.onmessage = null
        this.onclose = null
        mockWsInstance = this
    }
}

beforeEach(() => {
    mockWsInstance = null
    vi.stubGlobal('WebSocket', MockWebSocket)
    // Default: /auth/me succeeds with id=7
    apiCall.mockResolvedValue(
        new Response(JSON.stringify({ id: 7, username: 'alice' }), { status: 200 })
    )
    // Default: useUnread returns empty unreadCounts
    useUnread.mockReturnValue({ unreadCounts: {}, clearUnread: vi.fn() })
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

function wrapper({ children }) {
    return <NotificationProvider>{children}</NotificationProvider>
}

describe('NotificationContext', () => {
    it('does not open WS when unauthenticated', () => {
        useAuth.mockReturnValue({ auth: { access_token: null } })
        renderHook(useNotifications, { wrapper })
        expect(mockWsInstance).toBeNull()
    })

    it('fetches userId from /api/users/auth/me when token is present', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(apiCall).toHaveBeenCalledWith('/api/users/auth/me'))
    })

    it('opens WS to correct URL containing user_id and token after /auth/me resolves', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        expect(mockWsInstance.url).toContain('/api/users/ws/notifications/7')
        expect(mockWsInstance.url).toContain('tok')
    })

    it('increments unreadCount on type=notification frame', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({
                    type: 'notification',
                    notification: { id: 1, type: 'friend_request', message: 'hi', read: false, created_at: new Date().toISOString() },
                }),
            })
        })
        expect(result.current.unreadCount).toBe(1)
        expect(result.current.notifications.some(n => n.id === 1)).toBe(true)
    })

    it('marks suppressed game_invite as read=true so totalUnreadCount is not incremented', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        act(() => { result.current.setInviteVisible(true) })
        // Assert before: no unread system notifications yet
        expect(result.current.unreadCount).toBe(0)
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({
                    type: 'notification',
                    notification: { id: 2, type: 'game_invite', message: 'invited', read: false, created_at: new Date().toISOString() },
                }),
            })
        })
        // Assert after: suppressed → inserted as read, badge unchanged
        const notif = result.current.notifications.find(n => n.id === 2)
        expect(notif).toBeDefined()
        expect(notif.read).toBe(true)
        expect(result.current.unreadCount).toBe(0)
    })

    it('inserts game_invite as read=false and increments badge when invite UI is NOT visible', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        act(() => { result.current.setInviteVisible(false) })
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({
                    type: 'notification',
                    notification: { id: 3, type: 'game_invite', message: 'invited', read: false, created_at: new Date().toISOString() },
                }),
            })
        })
        const notif = result.current.notifications.find(n => n.id === 3)
        expect(notif.read).toBe(false)      // not suppressed → inserted as unread
        expect(result.current.unreadCount).toBeGreaterThanOrEqual(1)
    })

    it('caps notification list at 20 entries on WS insert', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        act(() => {
            for (let i = 1; i <= 25; i++) {
                mockWsInstance.onmessage({
                    data: JSON.stringify({
                        type: 'notification',
                        notification: { id: i, type: 'friend_request', message: `msg ${i}`, read: false, created_at: new Date().toISOString() },
                    }),
                })
            }
        })
        const realNotifs = result.current.notifications.filter(n => n.type !== 'unread_chat')
        expect(realNotifs.length).toBeLessThanOrEqual(20)
    })

    it('dedupes by id: re-inserting the same id does not create duplicates', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        const frame = {
            data: JSON.stringify({
                type: 'notification',
                notification: { id: 99, type: 'friend_request', message: 'hi', read: false, created_at: new Date().toISOString() },
            }),
        }
        act(() => { mockWsInstance.onmessage(frame) })
        act(() => { mockWsInstance.onmessage(frame) })
        const matches = result.current.notifications.filter(n => n.id === 99)
        expect(matches.length).toBe(1)
    })

    it('ignores frames with type !== notification', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        const initialNotifCount = result.current.notifications.length
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({ type: 'game_invite', to_user_id: 7, room_id: 'x' }),
            })
        })
        expect(result.current.notifications.length).toBe(initialNotifCount)
    })

    it('clears notifications when access_token becomes null (logout)', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result, rerender } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        // Simulate a notification arriving
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({
                    type: 'notification',
                    notification: { id: 5, type: 'friend_request', message: 'hi', read: false, created_at: new Date().toISOString() },
                }),
            })
        })
        expect(result.current.notifications.some(n => n.id === 5)).toBe(true)
        // Simulate logout
        useAuth.mockReturnValue({ auth: { access_token: null } })
        rerender()
        expect(result.current.notifications.filter(n => n.id === 5)).toHaveLength(0)
    })

    it('closes WS on unmount', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { unmount } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        unmount()
        expect(mockWsInstance.close).toHaveBeenCalled()
    })

    it('includes DM pseudo-notifications from unreadCounts', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const mockClearUnread = vi.fn()
        useUnread.mockReturnValue({
            unreadCounts: { 'DM-1-7': 2 },
            clearUnread: mockClearUnread
        })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => {
            const dmNotifs = result.current.notifications.filter(n => n.type === 'unread_chat')
            expect(dmNotifs.length).toBeGreaterThan(0)
        })
    })

    it('DM pseudo-notification created_at is stable across recomputes', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        useUnread.mockReturnValue({
            unreadCounts: { 'DM-1-7': 1 },
            clearUnread: vi.fn(),
        })
        const { result, rerender } = renderHook(useNotifications, { wrapper })
        await waitFor(() => {
            const dm = result.current.notifications.find(n => n.type === 'unread_chat')
            expect(dm).toBeDefined()
        })
        const firstTs = result.current.notifications.find(n => n.type === 'unread_chat').created_at
        // Trigger a recompute by changing count
        useUnread.mockReturnValue({
            unreadCounts: { 'DM-1-7': 2 },
            clearUnread: vi.fn(),
        })
        rerender()
        const secondTs = result.current.notifications.find(n => n.type === 'unread_chat').created_at
        expect(secondTs).toBe(firstTs)   // timestamp must not change on recompute
    })

    it('clears DM unread counts when markAllRead is called', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const mockClearUnread = vi.fn()
        useUnread.mockReturnValue({
            unreadCounts: { 'DM-1-7': 2 },
            clearUnread: mockClearUnread
        })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(apiCall).toHaveBeenCalled())

        act(() => {
            result.current.markAllRead()
        })

        await waitFor(() => {
            expect(mockClearUnread).toHaveBeenCalled()
        })
    })
})
