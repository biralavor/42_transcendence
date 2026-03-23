import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContext'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/play', label: 'Arena' },
  { to: '/chat/general', label: 'Chat' },
  { to: '/leaderboard', label: 'Ranking' },
  { to: '/about', label: 'About' },
  { to: '/profile', label: 'Profile' },
]

const NavbarComponent = () => {
  const location = useLocation()
  const { logout, isAuthenticated } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="arcade-nav">
      <div className="arcade-content">
        <nav className="arcade-screen">
          <div className="arcade-navbar">
            <Link to="/" className="navbar-brand-link">
              <span className="navbar-wordmark">PONG</span>
              <span className="navbar-tagline">Retro Arcade&nbsp;70s</span>
            </Link>

            <div className="arcade-nav-links">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`arcade-nav-link ${isActive ? 'active' : ''}`}
                  >
                    {link.label}
                  </Link>
                )
              })}

              {isAuthenticated && (
                <button
                  type="button"
                  className="arcade-nav-link"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              )}
            </div>

            <div className="arcade-nav-actions">
              <Link className="arcade-btn arcade-btn-secondary" to="/register">
                Join
              </Link>
              <Link className="arcade-btn arcade-btn-primary" to="/login">
                Sign&nbsp;in
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}

export default NavbarComponent