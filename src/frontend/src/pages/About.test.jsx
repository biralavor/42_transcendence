import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import About from './About'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function renderAbout() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>
  )
}

describe('About page', () => {
  it('renders the Navbar slot', () => {
    renderAbout()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('renders the intro heading', () => {
    renderAbout()
    expect(
      screen.getByRole('heading', { name: /the classic that started it all/i, level: 1 })
    ).toBeInTheDocument()
  })

  it('renders the three about cards', () => {
    renderAbout()
    expect(screen.getByRole('heading', { name: /why pong matters/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /visual direction/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /platform pillars/i })).toBeInTheDocument()
  })

  it('renders the Join CTA pointing to /register', () => {
    renderAbout()
    const join = screen.getByRole('link', { name: /^join$/i })
    expect(join).toHaveAttribute('href', '/register')
  })

  it('renders the Sign in CTA pointing to /login', () => {
    renderAbout()
    const signIn = screen.getByRole('link', { name: /sign in/i })
    expect(signIn).toHaveAttribute('href', '/login')
  })
})
