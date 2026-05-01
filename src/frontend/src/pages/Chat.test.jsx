import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/authContext'
import { UserProvider } from '../context/userContext'
import Chat from './Chat'

// ── Mock createWsClient ────────────────────────────────────────────────────
// Captures handlers so tests can simulate WS events without a real socket.
let mockWs
vi.mock('../utils/wsClient', () => ({
  createWsClient: vi.fn((_url, { onOpen, onMessage, onClose } = {}) => {
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      simulateOpen: () => onOpen?.(),
      simulateMessage: (data) => onMessage?.(data),
      simulateClose: () => onClose?.(),
    }
    return mockWs
  }),
}))

vi.mock('../context/presenceContext', () => ({
  usePresence: vi.fn(() => ({})),
}))

vi.mock('../context/unreadContext', () => ({
  useUnread: vi.fn(() => ({ unreadCounts: {}, clearUnread: vi.fn(), setActiveRoom: vi.fn() })),
}))

vi.mock('../context/notificationContext', () => ({
  useNotifications: vi.fn(() => ({
    setInviteVisible: vi.fn(),
    notifications: [],
    unreadCount: 0,
  })),
}))

vi.mock('../Components/FriendsSidebar', () => ({
  default: ({ userId }) => <div data-testid="friends-sidebar" data-userid={String(userId)} />,
}))

vi.mock('../Components/LobbyPanel', () => ({
  default: ({ compact, onEnter }) => (
    <div data-testid={compact ? 'lobby-sidebar' : 'lobby-panel'}>
      <button type="button" onClick={() => onEnter('test-room')}>
        Enter test-room
      </button>
    </div>
  ),
}))

vi.mock('../Components/UserProfileModal', () => ({
  default: ({ username, onClose }) => (
    <div data-testid="profile-modal" data-username={username}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

// Mock the useUser hook
const mockUseUser = vi.fn()
vi.mock('../context/userContext', () => ({
  useUser: () => mockUseUser(),
  UserProvider: ({ children }) => <>{children}</>,
}))

// Mock the useAuth hook
const mockUseAuth = vi.fn()
vi.mock('../context/authContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }) => <>{children}</>,
}))

function renderChat(roomId = 'room1', locationState) {
  const initialEntries = locationState
    ? [{ pathname: `/chat/${roomId}`, state: locationState }]
    : [`/chat/${roomId}`]

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/chat/:roomId" element={<Chat />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Chat page', () => {
  beforeEach(() => {
    mockWs = undefined
    vi.clearAllMocks()

    // Default mock implementations
    mockUseAuth.mockReturnValue({
      auth: { access_token: 'fake-token' },
      isAuthReady: true,
    })

    mockUseUser.mockReturnValue({
      user: { id: 1, username: 'Alice' },
      token: 'fake-token',
    })
  })

  it('shows chat view when joined via navigation state', async () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    })
  })

  it('send button is disabled when not yet connected', async () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    })
  })

  it('send button is enabled after connection opens', async () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    })
    act(() => { mockWs.simulateOpen() })
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('send() calls ws.send with content and sender name', async () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    })
    act(() => { mockWs.simulateOpen() })

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Hello!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(mockWs.send).toHaveBeenCalledWith({ content: 'Hello!', sender: 'Alice' })
  })

  it('received messages appear in the list', async () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    })
    act(() => { mockWs.simulateMessage({ content: 'Hi there', sender: 'Bob' }) })
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })

  it('renders FriendsSidebar alongside the chat panel', async () => {
    mockUseUser.mockReturnValue({
      user: { id: 3, username: 'Alice' },
      token: 'fake-token',
    })

    renderChat('DM-3-7', { username: 'Alice', userId: 3 })

    await waitFor(() => {
      const sidebar = screen.getByTestId('friends-sidebar')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveAttribute('data-userid', '3')
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    })
  })

  it('shows profile modal when sender name is clicked', async () => {
    renderChat('room1', { username: 'tester', userId: 1 })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    })
    await act(async () => {
      mockWs.simulateOpen()
      mockWs.simulateMessage({ sender: 'alice', content: 'hello' })
    })

    const senderBtn = screen.getByRole('button', { name: 'alice' })
    fireEvent.click(senderBtn)

    expect(screen.getByTestId('profile-modal')).toBeInTheDocument()
    expect(screen.getByTestId('profile-modal')).toHaveAttribute('data-username', 'alice')
  })

  it('closes profile modal when onClose is called', async () => {
    renderChat('room1', { username: 'tester', userId: 1 })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    })
    await act(async () => {
      mockWs.simulateOpen()
      mockWs.simulateMessage({ sender: 'alice', content: 'hello' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'alice' }))
    expect(screen.getByTestId('profile-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('profile-modal')).not.toBeInTheDocument()
  })
})
