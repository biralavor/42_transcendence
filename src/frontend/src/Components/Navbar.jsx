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
            <Link to="/" className="d-inline-flex align-items-center gap-3 text-decoration-none">
              <img
                src="/logo_tight_square.png"
                alt="ft_transcendence logo"
                className="navbar-logo"
              />
              <div className="text-start">
                <strong className="arcade-kicker d-block">Arcade cabinet</strong>
                <span className="arcade-muted">Retro Pong platform</span>
              </div>
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
              <Link className="arcade-btn arcade-btn-secondary" to="/register">
                Register
              </Link>
              <Link className="arcade-btn arcade-btn-primary" to="/login">
                Login
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}

export default NavbarComponent