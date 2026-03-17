import { Link, useLocation } from 'react-router-dom'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/play', label: 'Arena' },
  { to: '/leaderboard', label: 'Ranking' },
  { to: '/about', label: 'About' },
]

const NavbarComponent = () => {
  const location = useLocation()

  return (
    <header className="arcade-nav">
      <div className="arcade-content">
        <nav className="arcade-screen">
          <div className="arcade-navbar arcade-panel">
            <Link to="/" className="navbar-brand-link">
              <span className="navbar-wordmark">PONG</span>
              <span className="navbar-tagline">ft_transcendence arena</span>
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
              <Link className="arcade-btn arcade-btn-secondary" to="/about">
                About
              </Link>
              <Link className="arcade-btn arcade-btn-primary" to="/login">
                Enter arena
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}

export default NavbarComponent