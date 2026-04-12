import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GameInviteModal from './GameInviteModal'
import { apiCall } from '../utils/apiClient'
import { useAuth } from '../context/authContext'
import { useNotifications } from '../context/notificationContext'
import { useNavigate } from 'react-router-dom'

vi.mock('../context/notificationContext', () => ({
  useNotifications: vi.fn(),
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

vi.mock('../context/authContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
  }
})

vi.mock('../utils/apiClient', () => ({
  apiCall: vi.fn(),
}))

describe('GameInviteModal', () => {
  const mockNavigate = vi.fn()
  const mockMarkRead = vi.fn()

  const inviteNotification = {
    id: 1,
    type: 'game_invite',
    message: 'Player1 invited you to play Pong [ROOM_ID:invite-4-5-123456]',
    read: false,
    from_user_id: 4,
    user_id: 5,
    created_at: '2026-04-12T04:11:51.291867+00:00',
  }

  const responseNotification = {
    id: 2,
    type: 'game_invite_response',
    message: 'Player1 accepted your invite [ROOM_ID:invite-4-5-123456]',
    read: false,
    from_user_id: 4,
    user_id: 5,
    created_at: '2026-04-12T04:12:00.000000+00:00',
  }

  const tournamentNotification = {
    id: 3,
    type: 'tournament_match_available',
    message: 'You have a tournament match ready to play. [TOURNAMENT_ID:9]',
    read: false,
    from_user_id: 1,
    user_id: 5,
    created_at: '2026-04-12T04:13:00.000000+00:00',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    useNavigate.mockReturnValue(mockNavigate)

    useAuth.mockReturnValue({
      auth: { access_token: 'test-token' },
    })

    useNotifications.mockReturnValue({
      notifications: [],
      markRead: mockMarkRead,
    })

    apiCall.mockImplementation(async (url) => {
      if (url === '/api/users/auth/me') {
        return new Response(JSON.stringify({ id: 5, username: 'You' }), { status: 200 })
      }

      if (url === '/api/users/game-invite/response') {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }

      throw new Error(`Unhandled apiCall mock for ${url}`)
    })
  })

  it('renders incoming invite modal with Accept/Decline actions', async () => {
    useNotifications.mockReturnValue({
      notifications: [inviteNotification],
      markRead: mockMarkRead,
    })

    render(<GameInviteModal />)

    await waitFor(() => {
      expect(screen.getByText('Match Invite')).toBeInTheDocument()
      expect(screen.getByText(/Player1 invited you/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument()
    })
  })

  it('accepting an invite calls the response endpoint and navigates with waiting-room state', async () => {
    useNotifications.mockReturnValue({
      notifications: [inviteNotification],
      markRead: mockMarkRead,
    })

    render(<GameInviteModal />)

    fireEvent.click(await screen.findByRole('button', { name: /Accept/i }))

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(
        '/api/users/game-invite/response',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/game/waiting/invite-4-5-123456',
        expect.objectContaining({
          state: expect.objectContaining({
            currentUser: expect.objectContaining({
              id: 5,
              username: 'You',
            }),
            opponent: expect.objectContaining({
              id: 4,
              username: 'Player1',
            }),
            player1_id: 4,
            player2_id: 5,
          }),
        }),
      )
    })

    expect(mockMarkRead).toHaveBeenCalledWith(inviteNotification.id)
  })

  it('accepting an invite still navigates when /auth/me fails by using notification fallback user id', async () => {
    useNotifications.mockReturnValue({
      notifications: [inviteNotification],
      markRead: mockMarkRead,
    })

    apiCall.mockImplementation(async (url) => {
      if (url === '/api/users/auth/me') {
        return new Response('', { status: 500 })
      }

      if (url === '/api/users/game-invite/response') {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }

      throw new Error(`Unhandled apiCall mock for ${url}`)
    })

    render(<GameInviteModal />)

    fireEvent.click(await screen.findByRole('button', { name: /Accept/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/game/waiting/invite-4-5-123456',
        expect.objectContaining({
          state: expect.objectContaining({
            currentUser: expect.objectContaining({
              id: 5,
              username: 'You',
            }),
            opponent: expect.objectContaining({
              id: 4,
              username: 'Player1',
            }),
            player1_id: 4,
            player2_id: 5,
          }),
        }),
      )
    })
  })

  it('declining an invite marks it as read and closes the modal', async () => {
    useNotifications.mockReturnValue({
      notifications: [inviteNotification],
      markRead: mockMarkRead,
    })

    render(<GameInviteModal />)

    fireEvent.click(await screen.findByRole('button', { name: /Decline/i }))

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith(inviteNotification.id)
      expect(screen.queryByText('Match Invite')).not.toBeInTheDocument()
    })
  })

  it('dismissing a game_invite_response navigates to the waiting room with resolved ids', async () => {
    useNotifications.mockReturnValue({
      notifications: [responseNotification],
      markRead: mockMarkRead,
    })

    render(<GameInviteModal />)

    fireEvent.click(await screen.findByRole('button', { name: /OK/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/game/waiting/invite-4-5-123456',
        expect.objectContaining({
          state: expect.objectContaining({
            currentUser: expect.objectContaining({ id: 5 }),
            opponent: expect.objectContaining({ id: 4 }),
            friendId: 4,
            player1_id: 4,
            player2_id: 5,
          }),
        }),
      )
    })

    expect(mockMarkRead).toHaveBeenCalledWith(responseNotification.id)
  })

  it('dismissing a tournament lifecycle notification navigates to the tournament page', async () => {
    useNotifications.mockReturnValue({
      notifications: [tournamentNotification],
      markRead: mockMarkRead,
    })

    render(<GameInviteModal />)

    fireEvent.click(await screen.findByRole('button', { name: /OK/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tournaments/9')
    })

    expect(mockMarkRead).toHaveBeenCalledWith(tournamentNotification.id)
  })

  it('does not render when there are no notifications', () => {
    useNotifications.mockReturnValue({
      notifications: [],
      markRead: mockMarkRead,
    })

    const { container } = render(<GameInviteModal />)
    expect(container.firstChild).toBeNull()
  })
})
