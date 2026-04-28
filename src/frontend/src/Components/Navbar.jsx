import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useNotifications } from '../context/notificationContext'
import { useUnread } from '../context/unreadContext'
import { apiCall } from '../utils/apiClient'
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

const adminLink = {
  to: '/admin',
  label: 'Admin',
  isActive: (pathname) => pathname.startsWith('/admin'),
}

export default function NavbarComponent() {
  const location = useLocation()
  const { logout, isAuthenticated } = useAuth()
  const { unreadCount } = useNotifications()
  const { unreadCounts } = useUnread()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const dmUnreadTotal = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAdmin(false)
      return
    }
    let cancelled = false
    apiCall('/api/users/auth/me', { skipRefreshOn401: true })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setIsAdmin(Boolean(data?.is_admin)) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  // Build nav links: for authenticated users, interleave public and private links.
  const baseAuthedLinks = [
    publicLinks[0], // Home
    publicLinks[1], // Arena
    privateLinks[0], // Chat
    privateLinks[1], // Tournaments
    publicLinks[2], // Ranking
    publicLinks[3], // About
    privateLinks[2], // Profile
  ]
  const links = isAuthenticated
    ? (isAdmin ? [...baseAuthedLinks, adminLink] : baseAuthedLinks)
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