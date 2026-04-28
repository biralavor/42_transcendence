import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Admin from './Admin'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div data-testid="home">HOME</div>} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Admin page', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('renders the three aggregate stats for admin users', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: 'admin', is_admin: true }))
      .mockResolvedValueOnce(jsonResponse({
        active_users_last_7d: 12,
        games_today: 5,
        messages_today: 34,
      }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Active users (last 7 days)')).toBeInTheDocument()
    })
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('34')).toBeInTheDocument()
  })

  it('redirects non-admin users to /', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 2, username: 'bob', is_admin: false }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Active users/i)).not.toBeInTheDocument()
  })

  it('shows the loading state before /auth/me resolves', () => {
    let resolveMe
    vi.spyOn(global, 'fetch').mockImplementationOnce(
      () => new Promise(resolve => { resolveMe = resolve })
    )
    renderAdmin()
    expect(screen.getByText(/Loading admin stats/i)).toBeInTheDocument()
    // Resolve so the test cleans up cleanly.
    resolveMe(jsonResponse({ id: 1, username: 'admin', is_admin: false }))
  })
})
