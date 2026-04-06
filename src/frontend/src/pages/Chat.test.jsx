import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/authContext'
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
  useUnread: vi.fn(() => ({ clearUnread: vi.fn(), setActiveRoom: vi.fn() })),
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

function renderChat(roomId = 'room1', locationState) {
  const initialEntries = locationState
    ? [{ pathname: `/chat/${roomId}`, state: locationState }]
    : [`/chat/${roomId}`]
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/chat/:roomId" element={<Chat />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('Chat page', () => {
  beforeEach(() => {
    mockWs = undefined
    vi.clearAllMocks()
  })

  it('shows chat view when joined via navigation state', () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
  })

  it('direct URL access without nav state waits for auth before showing room', () => {
    // No location.state → joined starts false; room renders only after identity resolves
    renderChat('room1')
    // auth/me is not mocked here so name stays empty → chat input not yet visible
    expect(screen.queryByPlaceholderText(/type a message/i)).not.toBeInTheDocument()
  })

  it('send button is disabled when not yet connected', () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    // onOpen not fired yet → disconnected
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('send button is enabled after connection opens', () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    act(() => { mockWs.simulateOpen() })
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('send() calls ws.send with content and sender name', () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    act(() => { mockWs.simulateOpen() })
    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Hello!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(mockWs.send).toHaveBeenCalledWith({ content: 'Hello!', sender: 'Alice' })
  })

  it('received messages appear in the list', () => {
    renderChat('room1', { username: 'Alice', userId: 1 })
    act(() => { mockWs.simulateMessage({ content: 'Hi there', sender: 'Bob' }) })
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })

  function renderChatJoined(roomId = 'DM-3-7', userId = 3) {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: `/chat/${roomId}`, state: { username: 'Alice', userId } }]}>
          <Routes>
            <Route path="/chat/:roomId" element={<Chat />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
  }

  it('renders FriendsSidebar alongside the chat panel', () => {
    renderChatJoined('DM-3-7', 3)
    const sidebar = screen.getByTestId('friends-sidebar')
    expect(sidebar).toBeInTheDocument()
    expect(sidebar).toHaveAttribute('data-userid', '3')
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
  })

  it('shows profile modal when sender name is clicked', async () => {
    renderChat('room1', { username: 'tester', userId: 1 })
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
    await act(async () => {
      mockWs.simulateOpen()
      mockWs.simulateMessage({ sender: 'alice', content: 'hello' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'alice' }))
    expect(screen.getByTestId('profile-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('profile-modal')).not.toBeInTheDocument()
  })

  function renderChatLobby(locationState = { username: 'Alice', userId: 1 }) {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/chat', state: locationState }]}>
          <Routes>
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:roomId" element={<Chat />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
  }

  it('shows full LobbyPanel when no roomId in URL', () => {
    renderChatLobby()
    expect(screen.getByTestId('lobby-panel')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/type a message/i)).not.toBeInTheDocument()
  })

  it('shows compact LobbySidebar alongside chat when in a room', () => {
    renderChatJoined('general', 1)
    expect(screen.getByTestId('lobby-sidebar')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
  })

  it('shows ← Lobby link when inside a room', () => {
    renderChatJoined('general', 1)
    expect(screen.getByRole('link', { name: /lobby/i })).toBeInTheDocument()
  })

  it('does not show ← Lobby link on the lobby view', () => {
    renderChatLobby()
    expect(screen.queryByRole('link', { name: /lobby/i })).not.toBeInTheDocument()
  })
})
