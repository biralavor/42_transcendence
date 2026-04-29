import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useNotifications } from '../context/notificationContext'
import { useUnread } from '../context/unreadContext'
import NotificationPanel from './NotificationPanel'
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
  {
    to: '/games/live',
    label: 'Live games',
    isActive: (pathname) => pathname.startsWith('/games/live'),
  },
]

// Links visible only to authenticated users.  Ordering matters for the layout.
const privateLinks = [
  {
    to: '/chat',
    label: 'Chat',
    isActive: (pathname) => pathname.startsWith('/chat'),
  },
  {
    to: '/tournaments',
    label: 'Tournaments',
    isActive: (pathname) => pathname.startsWith('/tournaments'),
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
  const { unreadCount } = useNotifications()
  const { unreadCounts } = useUnread()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const dmUnreadTotal = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  // Build nav links: for authenticated users, interleave public and private links.
  const links = isAuthenticated
    ? [
      publicLinks[0], // Home
      publicLinks[1], // Arena
      publicLinks[4], // Live games
      privateLinks[0], // Chat
      privateLinks[1], // Tournaments
      publicLinks[2], // Ranking
      publicLinks[3], // About
      privateLinks[2], // Profile
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
                  className={`pong-nav__link ${link.isActive(location.pathname) ? 'is-active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {isAuthenticated ? (
              <div className="pong-nav__actions">
                <div className="pong-nav__bell-wrap">
                  <button
                    type="button"
                    className="pong-nav__bell"
                    aria-label="Notifications"
                    onClick={() => setIsPanelOpen((prev) => !prev)}
                  >
                    🔔
                    {(unreadCount + dmUnreadTotal) > 0 && (
                      <span className="pong-nav__bell-badge" data-testid="bell-badge">
                        {unreadCount + dmUnreadTotal}
                      </span>
                    )}
                  </button>
                  {isPanelOpen && (
                    <NotificationPanel onClose={() => setIsPanelOpen(false)} />
                  )}
                </div>
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