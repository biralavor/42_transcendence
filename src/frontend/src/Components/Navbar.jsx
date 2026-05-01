import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useUser } from '../context/userContext'
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

const adminLink = {
  to: '/admin',
  label: 'Admin',
  isActive: (pathname) => pathname.startsWith('/admin'),
}

const NAVBAR_SEARCH_LIMIT = 5

export default function NavbarComponent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, isAuthenticated } = useAuth()
  const { user, token } = useUser()
  const { unreadCount } = useNotifications()
  const { unreadCounts } = useUnread()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const isAdmin = user?.username == 'admin'
  
  const searchInputRef = useRef(null)

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus()
    }
  }, [isSearchOpen])

  const dmUnreadTotal = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  // Build nav links: for authenticated users, interleave public and private links.
  const baseAuthedLinks = [
    publicLinks[0], // Home
    publicLinks[1], // Arena
    publicLinks[4], // Live games
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
    setIsSearchOpen(false)
    setIsSearchFocused(false)
    setSearchTerm('')
  }, [location.pathname])

  useEffect(() => {
    const query = searchTerm.trim()
    if (!isAuthenticated || !query) {
      setSearchResults([])
      setSearchTotal(0)
      setSearchError('')
      setSearchLoading(false)
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      setSearchLoading(true)
      setSearchError('')
      apiCall(`/api/users/search?q=${encodeURIComponent(query)}&page=1&per_page=${NAVBAR_SEARCH_LIMIT}&sort=username`, {
        signal: controller.signal,
        skipRefreshOn401: true,
      })
        .then(r => {
          if (!r.ok) throw new Error(`Search failed: ${r.status}`)
          return r.json()
        })
        .then(data => {
          if (controller.signal.aborted) return
          setSearchResults(
            Array.isArray(data.results)
              ? data.results.slice(0, NAVBAR_SEARCH_LIMIT)
              : []
          )
          setSearchTotal(Number.isFinite(data.total) ? data.total : 0)
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            setSearchResults([])
            setSearchTotal(0)
            setSearchError('Search unavailable')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false)
        })
    }, 300)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [searchTerm, isAuthenticated])

  const handleToggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  const handleLogout = () => {
    logout()
    setIsMenuOpen(false)
  }

  const closeSearch = () => {
    setSearchTerm('')
    setSearchResults([])
    setSearchTotal(0)
    setSearchError('')
    setIsSearchFocused(false)
    setIsSearchOpen(false)
  }

  const handleToggleSearch = () => {
    if (isSearchOpen) {
      closeSearch()
      return
    }

    setIsSearchOpen(true)
  }

  const goToUserProfile = (userId) => {
    navigate(`/profile/${userId}`)
    closeSearch()
    setIsMenuOpen(false)
  }

  const goToFullSearch = (event) => {
    event.preventDefault()
    const query = searchTerm.trim()
    if (!query) return
    navigate(`/search?q=${encodeURIComponent(query)}`)
    closeSearch()
    setIsMenuOpen(false)
  }

  const shouldShowSearchDropdown = isSearchFocused && searchTerm.trim().length > 0

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
                <div className={`pong-nav__search ${isSearchOpen ? 'is-open' : ''}`}>
                  {!isSearchOpen ? (
                    <button
                      type="button"
                      className="pong-nav__search-toggle"
                      aria-label="Open user search"
                      onClick={handleToggleSearch}
                    >
                      🔍
                    </button>
                  ) : (
                    <form className="pong-nav__search-form" role="search" onSubmit={goToFullSearch}>
                      <input
                        ref={searchInputRef}
                        type="search"
                        className="pong-nav__search-input"
                        aria-label="Search users"
                        placeholder="Search users"
                        value={searchTerm}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={(event) => {
                          const nextFocusedElement = event.relatedTarget
                          const searchContainer = event.currentTarget.closest('.pong-nav__search')

                          if (searchContainer?.contains(nextFocusedElement)) {
                            return
                          }

                          closeSearch()
                        }}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            closeSearch()
                          }
                        }}
                      />
                    </form>
                  )}
                  {shouldShowSearchDropdown && (
                    <div className="pong-nav__search-dropdown" aria-label="User search results">
                      {searchLoading && (
                        <div className="pong-nav__search-status">Searching...</div>
                      )}
                      {!searchLoading && searchError && (
                        <div className="pong-nav__search-status">{searchError}</div>
                      )}
                      {!searchLoading && !searchError && searchResults.length === 0 && (
                        <div className="pong-nav__search-status">No users found</div>
                      )}
                      {!searchLoading && !searchError && searchResults.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          className="pong-nav__search-result"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => goToUserProfile(user.id)}
                        >
                          <img
                            src={user.avatar_url || '/avatar_placeholder.jpg'}
                            alt=""
                            className="pong-nav__search-avatar"
                          />
                          <span>{user.username}</span>
                        </button>
                      ))}
                      {!searchLoading && !searchError && searchTotal > 0 && (
                        <Link
                          to={`/search?q=${encodeURIComponent(searchTerm.trim())}`}
                          className="pong-nav__search-all"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={goToFullSearch}
                        >
                          See all results
                        </Link>
                      )}
                    </div>
                  )}
                </div>
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
