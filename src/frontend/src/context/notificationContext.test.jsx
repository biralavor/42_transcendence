import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { NotificationProvider, useNotifications } from './notificationContext'

vi.mock('./authContext', () => ({
    useAuth: vi.fn(),
}))
import { useAuth } from './authContext'

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
                    notification: { id: 1, type: 'friend_request', message: 'hi', read: false },
                }),
            })
        })
        expect(result.current.unreadCount).toBe(1)
        expect(result.current.notifications).toHaveLength(1)
    })

    it('does NOT increment unreadCount for game_invite when invite UI is visible', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        act(() => { result.current.setInviteVisible(true) })
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({
                    type: 'notification',
                    notification: { id: 2, type: 'game_invite', message: 'invited', read: false },
                }),
            })
        })
        expect(result.current.unreadCount).toBe(0)
        // But the item IS added to the list
        expect(result.current.notifications).toHaveLength(1)
    })

    it('increments unreadCount for game_invite when invite UI is NOT visible', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        act(() => { result.current.setInviteVisible(false) })
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({
                    type: 'notification',
                    notification: { id: 3, type: 'game_invite', message: 'invited', read: false },
                }),
            })
        })
        expect(result.current.unreadCount).toBe(1)
    })

    it('ignores frames with type !== notification', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { result } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        act(() => {
            mockWsInstance.onmessage({
                data: JSON.stringify({ type: 'game_invite', to_user_id: 7, room_id: 'x' }),
            })
        })
        expect(result.current.unreadCount).toBe(0)
        expect(result.current.notifications).toHaveLength(0)
    })

    it('closes WS on unmount', async () => {
        useAuth.mockReturnValue({ auth: { access_token: 'tok' } })
        const { unmount } = renderHook(useNotifications, { wrapper })
        await waitFor(() => expect(mockWsInstance).not.toBeNull())
        unmount()
        expect(mockWsInstance.close).toHaveBeenCalled()
    })
})
