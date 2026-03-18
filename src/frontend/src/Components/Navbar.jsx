import { Link, useLocation } from 'react-router-dom'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/play', label: 'Arena' },
  { to: '/leaderboard', label: 'Ranking' },
  { to: '/about', label: 'About' },
  // Provide easy access to the user's profile.  In a real application you
  // would likely hide this link until the user is authenticated and show it
  // alongside the avatar or username, but for the purposes of mock data it
  // is always visible.
  { to: '/profile', label: 'Profile' },
]

const NavbarComponent = () => {
  const location = useLocation()

  return (
    <header className="arcade-nav">
      <div className="arcade-content">
        <nav className="arcade-screen">
          <div className="arcade-navbar">
            <Link to="/" className="navbar-brand-link">
              {/* Wordmark emphasises the retro nature of the project */}
              <span className="navbar-wordmark">PONG</span>
              {/* Updated tagline to clearly communicate the visual identity */}
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
            </div>

            <div className="arcade-nav-actions">
              {/* Secondary action encourages new players to join */}
              <Link className="arcade-btn arcade-btn-secondary" to="/register">
                Join
              </Link>
              {/* Primary action drives returning users to sign in */}
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