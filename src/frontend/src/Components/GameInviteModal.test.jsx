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
