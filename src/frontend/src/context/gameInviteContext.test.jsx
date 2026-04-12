import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { GameInviteProvider, useGameInvite } from './gameInviteContext'
import * as notificationContext from './notificationContext'
import { apiCall } from '../utils/apiClient'

// Mock notificationContext
vi.mock('./notificationContext')

// Mock apiClient module
vi.mock('../utils/apiClient', () => ({
    apiCall: vi.fn(),
}))

const mockMarkRead = vi.fn()

describe('gameInviteContext', () => {
    const mockActiveInvite = {
        notificationId: 1,
        fromUserId: 123,
        fromUsername: 'TestPlayer',
        fromAvatarUrl: '/avatar.jpg',
        roomId: 'room-123',
    }

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock apiCall for successful response by default
        apiCall.mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok', notification_id: 1 }),
            text: async () => '',
        })

        notificationContext.useNotifications.mockReturnValue({
            markRead: mockMarkRead,
            notifications: [],
        })
    })

    describe('Context Provider', () => {
        it('should provide useGameInvite hook', () => {
            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            expect(result.current).toHaveProperty('activeInvite')
            expect(result.current).toHaveProperty('setGameInvite')
            expect(result.current).toHaveProperty('clearGameInvite')
            expect(result.current).toHaveProperty('respondToInvite')
        })

        it('should initialize with null activeInvite', () => {
            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            expect(result.current.activeInvite).toBeNull()
        })
    })

    describe('setGameInvite', () => {
        it('should set the active invite', () => {
            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            expect(result.current.activeInvite).toEqual(mockActiveInvite)
        })
    })

    describe('clearGameInvite', () => {
        it('should set activeInvite to null', () => {
            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            expect(result.current.activeInvite).not.toBeNull()

            act(() => {
                result.current.clearGameInvite()
            })

            expect(result.current.activeInvite).toBeNull()
        })
    })

    describe('respondToInvite', () => {
        it('should send POST request to /api/users/game-invite/response with accepted status', async () => {
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('accepted')
            })

            expect(apiCall).toHaveBeenCalledWith(
                '/api/users/game-invite/response',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to_user_id: 123,
                        status: 'accepted',
                        room_id: 'room-123',
                    }),
                })
            )
        })

        it('should send POST request with declined status', async () => {
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('declined')
            })

            expect(apiCall).toHaveBeenCalledWith(
                '/api/users/game-invite/response',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        to_user_id: 123,
                        status: 'declined',
                    }),
                })
            )
        })

        it('should call onNavigate callback when accepting', async () => {
            const mockOnNavigate = vi.fn()
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('accepted', mockOnNavigate)
            })

            await waitFor(() => {
                expect(mockOnNavigate).toHaveBeenCalledWith(mockActiveInvite)
            })
        })

        it('should not call onNavigate when declining', async () => {
            const mockOnNavigate = vi.fn()
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('declined', mockOnNavigate)
            })

            expect(mockOnNavigate).not.toHaveBeenCalled()
        })

        it('should mark notification as read if notificationId is present', async () => {
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('accepted')
            })

            await waitFor(() => {
                expect(mockMarkRead).toHaveBeenCalledWith(mockActiveInvite.notificationId)
            })
        })

        it('should clear activeInvite after responding', async () => {
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            expect(result.current.activeInvite).not.toBeNull()

            await act(async () => {
                await result.current.respondToInvite('declined')
            })

            await waitFor(() => {
                expect(result.current.activeInvite).toBeNull()
            })
        })

        it('should do nothing if activeInvite is null', async () => {
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
                text: async () => '',
            })
            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            // activeInvite is null by default

            await act(async () => {
                await result.current.respondToInvite('accepted')
            })

            expect(apiCall).not.toHaveBeenCalled()
        })

        it('should log error and not call onNavigate on failed response', async () => {
            const mockOnNavigate = vi.fn()
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            apiCall.mockResolvedValue({
                ok: false,
                status: 403,
                text: async () => 'Forbidden',
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('accepted', mockOnNavigate)
            })

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to respond to invite'),
                'Forbidden'
            )
            expect(mockOnNavigate).not.toHaveBeenCalled()

            consoleErrorSpy.mockRestore()
        })

        it('should handle network errors gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            apiCall.mockRejectedValue(new Error('Network error'))

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('accepted')
            })

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error responding to invite:',
                expect.any(Error)
            )

            consoleErrorSpy.mockRestore()
        })
    })

    describe('Authentication', () => {
        it('should use apiCall which includes authentication headers', async () => {
            apiCall.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok', notification_id: 1 }),
            })

            const wrapper = ({ children }) => <GameInviteProvider>{children}</GameInviteProvider>
            const { result } = renderHook(() => useGameInvite(), { wrapper })

            act(() => {
                result.current.setGameInvite(mockActiveInvite)
            })

            await act(async () => {
                await result.current.respondToInvite('accepted')
            })

            // Verify apiCall is used (which automatically adds Authorization header)
            expect(apiCall).toHaveBeenCalledWith(
                '/api/users/game-invite/response',
                expect.any(Object)
            )
        })
    })
})
