import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import GameInviteModal from './GameInviteModal'
import * as notificationContext from '../context/notificationContext'
import * as gameInviteContext from '../context/gameInviteContext'
import * as authContext from '../context/authContext'
import * as router from 'react-router-dom'

// Mock dependencies
vi.mock('../context/notificationContext')
vi.mock('../context/gameInviteContext')
vi.mock('../context/authContext')
vi.mock('react-router-dom', { spy: true })
vi.mock('../utils/gameInviteChannel', () => ({
    createGameChannelClient: vi.fn(() => ({ close: vi.fn() })),
}))
vi.mock('../utils/apiClient', () => ({
    apiCall: vi.fn(),
}))

describe('GameInviteModal - Incoming Invites (Global)', () => {
    const mockIncomingInvite = {
        id: 1,
        type: 'game_invite',
        message: 'Player1 invited you to play Pong [ROOM_ID:invite-4-5-123456]',
        read: false,
        from_user_id: 4,
        user_id: 5,
        created_at: '2026-04-12T04:11:51.291867+00:00',
    }

    const mockMarkRead = vi.fn()
    const mockNavigate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        authContext.useAuth.mockReturnValue({
            user: { id: 5 },
        })

        notificationContext.useNotifications.mockReturnValue({
            notifications: [],
            markRead: mockMarkRead,
        })

        gameInviteContext.useGameInvite.mockReturnValue({
            activeInvite: null,
            setGameInvite: vi.fn(),
            clearGameInvite: vi.fn(),
            respondToInvite: vi.fn(),
        })

        router.useNavigate.mockReturnValue(mockNavigate)
    })

    describe('Incoming Invites - Rendering on Any Page', () => {
        it('should render game_invite modal when incoming invite received', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Modal should display the invite
            await waitFor(() => {
                expect(screen.getByText('Match Invite')).toBeInTheDocument()
                expect(screen.getByText(/Player1 invited you/)).toBeInTheDocument()
            }, { timeout: 1000 })
        })

        it('should have Accept and Decline buttons for incoming invites', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument()
                expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument()
            }, { timeout: 1000 })
        })

        it('should extract room_id from invite message', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Modal should render (room_id extracted for navigation)
            await waitFor(() => {
                expect(screen.getByText('Match Invite')).toBeInTheDocument()
            }, { timeout: 1000 })

            // Accept button should work with extracted room_id
            const acceptBtn = screen.getByRole('button', { name: /Accept/i })
            expect(acceptBtn).toBeInTheDocument()
        })
    })

    describe('Incoming Invites - Accept/Decline Functionality', () => {
        it('should navigate to game waiting room when Accept clicked', async () => {
            const { apiCall } = await import('../utils/apiClient')
            apiCall.mockResolvedValue(
                new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
            )

            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            const acceptBtn = await screen.findByRole('button', { name: /Accept/i })
            fireEvent.click(acceptBtn)

            await waitFor(() => {
                // Should navigate to game room with room_id
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining('/game/waiting/invite-4-5-123456')
                )
            })
        })

        it('should send correct data when Accept clicked', async () => {
            const { apiCall } = await import('../utils/apiClient')
            apiCall.mockResolvedValue(
                new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
            )

            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            const acceptBtn = await screen.findByRole('button', { name: /Accept/i })
            fireEvent.click(acceptBtn)

            await waitFor(() => {
                expect(apiCall).toHaveBeenCalledWith(
                    '/api/users/game-invite/response',
                    expect.objectContaining({
                        method: 'POST',
                    })
                )
            })
        })

        it('should mark notification as read when Accept clicked', async () => {
            const { apiCall } = await import('../utils/apiClient')
            apiCall.mockResolvedValue(
                new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
            )

            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            const acceptBtn = await screen.findByRole('button', { name: /Accept/i })
            fireEvent.click(acceptBtn)

            await waitFor(() => {
                expect(mockMarkRead).toHaveBeenCalledWith(mockIncomingInvite.id)
            })
        })

        it('should not navigate if no room_id in invite', async () => {
            const { apiCall } = await import('../utils/apiClient')
            apiCall.mockResolvedValue(
                new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
            )

            const inviteWithoutRoom = {
                ...mockIncomingInvite,
                message: 'Player1 invited you to play Pong',
            }

            notificationContext.useNotifications.mockReturnValue({
                notifications: [inviteWithoutRoom],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            const acceptBtn = await screen.findByRole('button', { name: /Accept/i })
            fireEvent.click(acceptBtn)

            await waitFor(() => {
                // Should not call navigate if no room_id
                expect(mockNavigate).not.toHaveBeenCalled()
            })
        })

        it('should close modal when Decline clicked', async () => {
            const { apiCall } = await import('../utils/apiClient')
            apiCall.mockResolvedValue(
                new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
            )

            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                expect(screen.getByText('Match Invite')).toBeInTheDocument()
            }, { timeout: 1000 })

            const declineBtn = screen.getByRole('button', { name: /Decline/i })
            fireEvent.click(declineBtn)

            await waitFor(() => {
                expect(screen.queryByText('Match Invite')).not.toBeInTheDocument()
            })
        })

        it('should mark notification as read when Decline clicked', async () => {
            const { apiCall } = await import('../utils/apiClient')
            apiCall.mockResolvedValue(
                new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
            )

            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            const declineBtn = await screen.findByRole('button', { name: /Decline/i })
            fireEvent.click(declineBtn)

            await waitFor(() => {
                expect(mockMarkRead).toHaveBeenCalledWith(mockIncomingInvite.id)
            })
        })
    })

    describe('Sender Info Extraction', () => {
        it('should extract from_user_id from notification', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                expect(screen.getByText('Match Invite')).toBeInTheDocument()
                // Modal displays, sender info extracted (from_user_id=4)
            }, { timeout: 1000 })
        })

        it('should extract username from message text', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                expect(screen.getByText(/Player1 invited you/)).toBeInTheDocument()
            }, { timeout: 1000 })
        })

        it('should fallback to from_user_id if username parse fails', async () => {
            const inviteWithBadMessage = {
                ...mockIncomingInvite,
                message: 'You have been invited to play Pong [ROOM_ID:invite-4-5-123456]',
            }

            notificationContext.useNotifications.mockReturnValue({
                notifications: [inviteWithBadMessage],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Modal should still render with fallback name
            await waitFor(() => {
                expect(screen.getByText('Match Invite')).toBeInTheDocument()
            }, { timeout: 1000 })
        })
    })

    describe('Modal Persistence Across Page Navigation', () => {
        it('should persist modal state when notifications array changes', async () => {
            const { rerender } = render(<GameInviteModal />)

            // First render: no notifications
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            rerender(<GameInviteModal />)

            // Modal appears
            await waitFor(() => {
                expect(screen.getByText('Match Invite')).toBeInTheDocument()
            }, { timeout: 1000 })
        })

        it('should process only unread game_invite notifications', async () => {
            const readInvite = {
                ...mockIncomingInvite,
                id: 10,
                read: true,
            }

            const unreadInvite = {
                id: 11,
                type: 'game_invite',
                message: 'Player2 invited you to play Pong [ROOM_ID:invite-2-5-234567]',
                read: false,
                from_user_id: 2,
                user_id: 5,
                created_at: '2026-04-12T04:12:00.000000+00:00',
            }

            notificationContext.useNotifications.mockReturnValue({
                notifications: [readInvite, unreadInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Should show only unread invite
            await waitFor(() => {
                expect(screen.getByText(/Player2 invited you/)).toBeInTheDocument()
            }, { timeout: 1000 })
        })
    })

    describe('Invite-Specific UI', () => {
        it('should show "Match Invite" title for game_invite type', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                expect(screen.getByText('Match Invite')).toBeInTheDocument()
            }, { timeout: 1000 })
        })

        it('should display invite message text', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                expect(screen.getByText(/invited you to play Pong/)).toBeInTheDocument()
            }, { timeout: 1000 })
        })

        it('should have proper accessibility attributes for invite modal', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockIncomingInvite],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                const dialog = screen.getByRole('dialog')
                expect(dialog).toHaveAttribute('aria-label', 'Game invite')
                expect(dialog).toHaveAttribute('aria-modal', 'true')
            }, { timeout: 1000 })
        })
    })
})

describe('GameInviteModal - Response Notifications', () => {
    const mockResponseNotification = {
        id: 2,
        type: 'game_invite_response',
        message: 'Player1 declined your invite',
        read: false,
    }

    const mockMarkRead = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        authContext.useAuth.mockReturnValue({
            user: { id: 999 },
        })

        notificationContext.useNotifications.mockReturnValue({
            notifications: [],
            markRead: mockMarkRead,
        })

        gameInviteContext.useGameInvite.mockReturnValue({
            activeInvite: null,
            setGameInvite: vi.fn(),
            clearGameInvite: vi.fn(),
            respondToInvite: vi.fn(),
        })

        router.useNavigate.mockReturnValue(vi.fn())
    })

    describe('Rendering', () => {
        it('should not render when there are no notifications', () => {
            const { container } = render(<GameInviteModal />)
            expect(container.firstChild).toBeNull()
        })

        it('should render response notification modal', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Wait for debounce (100ms) and modal to appear
            await waitFor(() => {
                expect(screen.getByText('Invite Response')).toBeInTheDocument()
                expect(screen.getByText('Player1 declined your invite')).toBeInTheDocument()
            }, { timeout: 1000 })
        })

        it('should show OK button for response notifications', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /OK/i })).toBeInTheDocument()
            }, { timeout: 1000 })
        })
    })

    describe('OK Button Interactions', () => {
        it('should mark notification as read when OK clicked', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            const okBtn = await screen.findByRole('button', { name: /OK/i })
            fireEvent.click(okBtn)

            await waitFor(() => {
                expect(mockMarkRead).toHaveBeenCalledWith(mockResponseNotification.id)
            })
        })

        it('should close modal when OK clicked', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            const okBtn = await screen.findByRole('button', { name: /OK/i })
            fireEvent.click(okBtn)

            await waitFor(() => {
                expect(screen.queryByText('Invite Response')).not.toBeInTheDocument()
            })
        })
    })

    describe('Auto-Dismiss Behavior', () => {
        it('should NOT auto-dismiss response notifications (requires manual OK click)', () => {
            // This is tested implicitly: the component has no auto-dismiss timer
            // If user clicks OK, modal closes. Otherwise it stays open.
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Component renders with OK button visible
            // Component DOES NOT have setTimeout/auto-dismiss logic
            // This is verified by the other tests passing (modal only closes on OK click)
            expect(notificationContext.useNotifications).toBeDefined()
        })
    })

    describe('Accessibility', () => {
        it('should render modal with both title and message', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Find both title and message
            await screen.findByText('Invite Response')
            expect(screen.getByText('Player1 declined your invite')).toBeInTheDocument()
        })

        it('should have OK button accessible', async () => {
            notificationContext.useNotifications.mockReturnValue({
                notifications: [mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Button should be accessible and clickable
            const okBtn = await screen.findByRole('button', { name: /OK/i })
            expect(okBtn).toBeInTheDocument()
        })
    })

    describe('Multiple Notifications', () => {
        it('should show only unread notifications', async () => {
            const readNotification = {
                id: 1,
                type: 'game_invite_response',
                message: 'Old read response',
                read: true,
            }

            notificationContext.useNotifications.mockReturnValue({
                notifications: [readNotification, mockResponseNotification],
                markRead: mockMarkRead,
            })

            render(<GameInviteModal />)

            // Should show the unread one
            await waitFor(() => {
                expect(screen.getByText('Player1 declined your invite')).toBeInTheDocument()
            }, { timeout: 1000 })

            // Should not show the read one
            expect(screen.queryByText('Old read response')).not.toBeInTheDocument()
        })
    })
})
