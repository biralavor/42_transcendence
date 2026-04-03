import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import './Navbar.css'

const publicLinks = [
  {
    to: '/',
    label: 'Home',
    isActive: (pathname) => pathname === '/',
  },
  {
    to: '/play',
    label: 'Arena',
    isActive: (pathname) =>
      pathname.startsWith('/play') || pathname.startsWith('/game/waiting'),
  },
  {
    to: '/leaderboard',
    label: 'Ranking',
    isActive: (pathname) => pathname.startsWith('/leaderboard'),
  },
  {
    to: '/about',
    label: 'About',
    isActive: (pathname) => pathname.startsWith('/about'),
  },
]

const privateLinks = [
  {
    to: '/chat',
    label: 'Chat',
    isActive: (pathname) => pathname.startsWith('/chat'),
  },
  {
    to: '/profile',
    label: 'Profile',
    isActive: (pathname) => pathname.startsWith('/profile'),
  },
]

export default function NavbarComponent() {
  const location = useLocation()
  const { logout, isAuthenticated } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const links = isAuthenticated
    ? [
      publicLinks[0],
      publicLinks[1],
      privateLinks[0],
      publicLinks[2],
      publicLinks[3],
      privateLinks[1],
    ]
    : publicLinks

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  const handleToggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  const handleLogout = () => {
    logout()
    setIsMenuOpen(false)
  }

  return (
    <header className="pong-nav">
      <div className="pong-nav__outer">
        <nav className="pong-nav__shell" aria-label="Main navigation">
          <Link to="/" className="pong-nav__brand">
            <span className="pong-nav__title">PONG</span>
            <span className="pong-nav__subtitle">Retro Arcade 70s</span>
          </Link>

          <button
            type="button"
            className={`pong-nav__toggle ${isMenuOpen ? 'is-open' : ''}`}
            aria-expanded={isMenuOpen}
            aria-controls="pong-nav-panel"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={handleToggleMenu}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div
            id="pong-nav-panel"
            className={`pong-nav__panel ${isMenuOpen ? 'is-open' : ''}`}
          >
            <div className="pong-nav__links">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`pong-nav__link ${link.isActive(location.pathname) ? 'is-active' : ''
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {isAuthenticated ? (
              <div className="pong-nav__actions">
                <button
                  type="button"
                  className="pong-nav__button pong-nav__button--primary"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="pong-nav__actions">
                <Link
                  to="/register"
                  className="pong-nav__button pong-nav__button--secondary"
                >
                  Join
                </Link>
                <Link
                  to="/login"
                  className="pong-nav__button pong-nav__button--primary"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}