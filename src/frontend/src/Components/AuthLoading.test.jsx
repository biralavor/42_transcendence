import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthLoading from './AuthLoading'

vi.mock('./Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function renderAuthLoading() {
  return render(
    <MemoryRouter>
      <AuthLoading />
    </MemoryRouter>
  )
}

describe('AuthLoading', () => {
  it('renders the Navbar', () => {
    renderAuthLoading()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('renders a "Loading" heading', () => {
    renderAuthLoading()
    expect(screen.getByRole('heading', { name: /loading/i })).toBeInTheDocument()
  })

  it('exposes aria-busy and aria-live for assistive tech', () => {
    const { container } = renderAuthLoading()
    const card = container.querySelector('section.auth-required-card')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(card).toHaveAttribute('aria-live', 'polite')
  })
})
