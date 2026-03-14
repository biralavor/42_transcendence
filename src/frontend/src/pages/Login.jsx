import { Link } from 'react-router-dom'
import './Login.css'
import NavbarComponent from '../Components/Navbar'

export default function Login() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-auth-layout">
        <div className="w-100 m-auto form-container">
          <form id="loginForm" className="form-box arcade-screen arcade-form-card">
            <div className="arcade-panel">
              <div className="text-center mb-2">
                <img src="/logo_tight_square.png" className="logo" alt="ft_transcendence logo" />
              </div>

              <h1 className="arcade-title text-center mb-2" style={{ fontSize: '2.15rem' }}>Please sign in</h1>
              <p className="arcade-form-copy text-center mb-4">
                Return to the cabinet, enter your credentials, and jump straight back into the arena.
              </p>

              <div className="form-floating mb-3 arcade-form-control">
                <input
                  type="email"
                  className="form-control"
                  id="floatingEmail"
                  name="email"
                  placeholder="your_email@example.com"
                  autoComplete="username"
                  required
                />
                <label htmlFor="floatingEmail">E-mail address</label>
              </div>

              <div className="form-floating mb-3 arcade-form-control">
                <input
                  type="password"
                  className="form-control"
                  id="floatingPassword"
                  name="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
                <label htmlFor="floatingPassword">Password</label>
              </div>

              <div className="form-check text-start my-3 arcade-form-check">
                <input className="form-check-input" type="checkbox" id="flexCheckDefault" />
                <label className="form-check-label" htmlFor="flexCheckDefault">Remember me</label>
              </div>
              <div className="mb-4">
                <Link to="/forgot-password" className="small text-decoration-none arcade-kicker">
                  Forgot password?
                </Link>
              </div>
              <button className="arcade-btn arcade-btn-primary w-100 mb-3" type="submit">Sign in</button>
              <p className="text-center mt-3 mb-0 arcade-form-copy">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="text-decoration-none arcade-kicker">
                  Create one
                </Link>
              </p>
              <p className="arcade-footer-note mt-4 mb-0 text-center">© 2026</p>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
