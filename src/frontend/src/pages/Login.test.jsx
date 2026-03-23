import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login page', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders username and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('submit button is enabled by default and disabled while submitting', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderLogin()
    const btn = screen.getByRole('button', { name: /sign in/i })
    expect(btn).not.toBeDisabled()

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'user' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass' } })
    fireEvent.submit(btn.closest('form'))

    expect(btn).toBeDisabled()
    await waitFor(() => expect(btn).not.toBeDisabled())
  })

  it('sends username and password in request body', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderLogin()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce())
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/users/auth/login')
    expect(JSON.parse(options.body)).toEqual({ username: 'testuser', password: 'secret' })
  })

  it('stores tokens in localStorage on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: 'acc', refresh_token: 'ref', token_type: 'bearer' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    renderLogin()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'u' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'p' } })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/login successful/i))
    expect(localStorage.getItem('access_token')).toBe('acc')
    expect(localStorage.getItem('refresh_token')).toBe('ref')
  })

  it('shows error alert on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderLogin()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'bad' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i))
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('shows generic error alert on non-JSON error body (e.g. 502)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })
    )

    renderLogin()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'u' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'p' } })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/login failed/i))
  })

  it('shows connection error alert when fetch throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    renderLogin()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'u' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'p' } })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to connect/i)
    )
  })
})
