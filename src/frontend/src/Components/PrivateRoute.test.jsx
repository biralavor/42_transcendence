import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../context/authContext'
import PrivateRoute from './PrivateRoute'

vi.mock('../context/unreadContext', () => ({
  useUnread: vi.fn(() => ({ unreadCounts: {}, clearUnread: vi.fn() })),
}))

vi.mock('../context/notificationContext', () => ({
  useNotifications: vi.fn(() => ({
    setInviteVisible: vi.fn(),
    notifications: [],
    unreadCount: 0,
  })),
}))

// Mock the useUser hook
const mockUseUser = vi.fn()
vi.mock('../context/userContext', () => ({
  useUser: () => mockUseUser(),
  UserProvider: ({ children }) => <>{children}</>,
}))

function renderWithAuth(authValue) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <PrivateRoute>
          <div>protected content</div>
        </PrivateRoute>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('PrivateRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockUseUser.mockReturnValue({
      user: { id: 1, username: 'admin' },
      token: null,
    })
  })

  it('shows loading state when auth is not ready', () => {
    renderWithAuth({ isAuthReady: false, isAuthenticated: false })
    expect(screen.getByText(/checking authentication status/i)).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('shows auth-required when ready but not authenticated', () => {
    renderWithAuth({ isAuthReady: true, isAuthenticated: false })
    // PrivateRoute uses Navigate to /login, so protected content should not be shown
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('renders children when ready and authenticated', () => {
    renderWithAuth({ isAuthReady: true, isAuthenticated: true })
    expect(screen.getByText('protected content')).toBeInTheDocument()
    expect(screen.queryByText(/you must be logged in/i)).not.toBeInTheDocument()
  })
})
