import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthRequired from './AuthRequired'

vi.mock('./Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <AuthRequired />
    </MemoryRouter>
  )
}

describe('AuthRequired', () => {
  it('renders the "Private Area" heading', () => {
    renderWithRouter()
    expect(screen.getByRole('heading', { name: /private area/i })).toBeInTheDocument()
  })

  it('renders the explanation text', () => {
    renderWithRouter()
    expect(screen.getByText(/you must be logged in to access this page/i)).toBeInTheDocument()
  })

  it('renders a "Go to Login" link pointing to /login', () => {
    renderWithRouter()
    const loginLink = screen.getByRole('link', { name: /go to login/i })
    expect(loginLink).toHaveAttribute('href', '/login')
  })

  it('renders a "Back to Home" link pointing to /', () => {
    renderWithRouter()
    const homeLink = screen.getByRole('link', { name: /back to home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('renders the Navbar', () => {
    renderWithRouter()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })
})
