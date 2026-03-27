import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../context/authContext'
import RegisterForm from './RegisterForm'

function renderRegister(loginSpy = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthContext.Provider value={{ login: loginSpy, isAuthenticated: false, isAuthReady: true }}>
        <Routes>
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/profile" element={<div>profile page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

function fillForm({ username = 'newuser', password = 'pass123', confirm = 'pass123', terms = true, privacy = true } = {}) {
  fireEvent.change(screen.getByLabelText(/^username/i), { target: { value: username } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirm } })
  if (terms) fireEvent.click(screen.getByLabelText(/terms of use/i))
  if (privacy) fireEvent.click(screen.getByLabelText(/privacy policy/i))
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders username, password, confirmPassword fields and checkboxes', () => {
    renderRegister()
    expect(screen.getByLabelText(/^username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/terms of use/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/privacy policy/i)).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    renderRegister()
    fillForm({ confirm: 'different' })
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i)
    )
  })

  it('shows error when terms checkbox is not accepted', async () => {
    renderRegister()
    fillForm({ terms: false })
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/terms of service/i)
    )
  })

  it('shows error when privacy checkbox is not accepted', async () => {
    renderRegister()
    fillForm({ privacy: false })
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/privacy policy/i)
    )
  })

  it('submit button is disabled while submitting', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ username: 'newuser' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderRegister()
    fillForm()
    const btn = screen.getByRole('button', { name: /create account/i })
    fireEvent.submit(btn.closest('form'))

    expect(btn).toBeDisabled()
    await waitFor(() => expect(btn).not.toBeDisabled())
  })

  it('sends correct payload to /api/users/auth/register', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ username: 'newuser' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderRegister()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/users/auth/register')
    expect(JSON.parse(options.body)).toEqual({ username: 'newuser', password: 'pass123' })
  })

  it('shows success message on 201', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ username: 'newuser' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', token_type: 'bearer' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

    renderRegister()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/account created/i)
    )
  })

  it('calls login() and redirects to /profile after auto-login succeeds', async () => {
    const loginSpy = vi.fn()
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ username: 'newuser' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', token_type: 'bearer' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

    renderRegister(loginSpy)
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))

    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith(
      { access_token: 'a', refresh_token: 'r', token_type: 'bearer' }
    ))
    await waitFor(() => expect(screen.getByText('profile page')).toBeInTheDocument())
  })

  it('shows error on failed registration (e.g. 409 conflict)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Username already taken' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderRegister()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/username already taken/i)
    )
  })

  it('shows error on non-JSON error body (e.g. 502)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })
    )

    renderRegister()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to create account/i)
    )
  })

  it('shows connection error when fetch throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    renderRegister()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to connect/i)
    )
  })
})
