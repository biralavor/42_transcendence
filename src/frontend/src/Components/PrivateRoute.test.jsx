import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../context/authContext'
import PrivateRoute from './PrivateRoute'

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
  })

  it('shows loading state when auth is not ready', () => {
    renderWithAuth({ isAuthReady: false, isAuthenticated: false })
    expect(screen.getByText(/checking authentication status/i)).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('shows auth-required when ready but not authenticated', () => {
    renderWithAuth({ isAuthReady: true, isAuthenticated: false })
    expect(screen.getByText(/you must be logged in/i)).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('renders children when ready and authenticated', () => {
    renderWithAuth({ isAuthReady: true, isAuthenticated: true })
    expect(screen.getByText('protected content')).toBeInTheDocument()
    expect(screen.queryByText(/you must be logged in/i)).not.toBeInTheDocument()
  })
})
