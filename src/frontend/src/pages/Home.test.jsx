import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe('Home page', () => {
  it('renders the Navbar slot', () => {
    renderHome()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('renders the hero title', () => {
    renderHome()
    expect(
      screen.getByRole('heading', { name: /play pong/i, level: 1 })
    ).toBeInTheDocument()
  })

  it('renders primary "Play now" CTA pointing to /play', () => {
    renderHome()
    const playLink = screen.getByRole('link', { name: /play now/i })
    expect(playLink).toHaveAttribute('href', '/play')
  })

  it('renders "View leaderboard" CTA pointing to /leaderboard', () => {
    renderHome()
    const lbLink = screen.getByRole('link', { name: /view leaderboard/i })
    expect(lbLink).toHaveAttribute('href', '/leaderboard')
  })

  it('renders the Sign in CTA pointing to /login', () => {
    renderHome()
    const signInLink = screen.getByRole('link', { name: /sign in/i })
    expect(signInLink).toHaveAttribute('href', '/login')
  })

  it('renders the Learn more CTA pointing to /about', () => {
    renderHome()
    const aboutLink = screen.getByRole('link', { name: /learn more/i })
    expect(aboutLink).toHaveAttribute('href', '/about')
  })

  it('renders the three feature cards', () => {
    renderHome()
    expect(screen.getByRole('heading', { name: /arcade energy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /instant competition/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /leaderboard mindset/i })).toBeInTheDocument()
  })
})
