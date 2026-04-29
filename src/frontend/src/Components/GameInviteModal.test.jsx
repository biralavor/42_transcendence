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
