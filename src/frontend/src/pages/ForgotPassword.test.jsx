import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from './ForgotPassword'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  )
}

describe('ForgotPassword page', () => {
  it('renders the "Recover your password" heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /recover your password/i })).toBeInTheDocument()
  })

  it('renders the explanation copy', () => {
    renderPage()
    expect(
      screen.getByText(/enter your e-mail address.*reset your password/i)
    ).toBeInTheDocument()
  })

  it('renders an email input with required attribute and email autocomplete', () => {
    renderPage()
    const input = screen.getByLabelText(/e-mail address/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('required')
    expect(input).toHaveAttribute('autoComplete', 'email')
  })

  it('renders the "Send recovery link" submit button', () => {
    renderPage()
    const btn = screen.getByRole('button', { name: /send recovery link/i })
    expect(btn).toHaveAttribute('type', 'submit')
  })

  it('renders a "Back to sign in" link pointing to /login', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /back to sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders the Navbar', () => {
    renderPage()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })
})
