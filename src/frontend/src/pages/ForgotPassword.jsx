import { Link } from 'react-router-dom'
import './Login.css'
import NavbarComponent from '../Components/Navbar'

export default function ForgotPassword() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-auth-layout">
        <div className="w-100 m-auto form-container">
          <form className="form-box arcade-screen arcade-form-card">
            <div className="arcade-panel">
              <div className="text-center mb-2">
                <img
                  src="/logo_tight_square.png"
                  className="logo"
                  alt="ft_transcendence logo"
                />
              </div>

              <h1 className="arcade-title text-center mb-2" style={{ fontSize: '2rem' }}>Recover your password</h1>

              <p className="arcade-form-copy text-center mb-4">
                Enter your e-mail address and we will send you instructions to reset your password.
              </p>

              <div className="form-floating mb-3 arcade-form-control">
                <input
                  type="email"
                  className="form-control"
                  id="recoveryEmail"
                  name="email"
                  placeholder="your_email@example.com"
                  autoComplete="email"
                  required
                />
                <label htmlFor="recoveryEmail">E-mail address</label>
              </div>

              <button className="arcade-btn arcade-btn-primary w-100 mb-3" type="submit">
                Send recovery link
              </button>

              <p className="text-center mb-0">
                <Link to="/login" className="small text-decoration-none arcade-kicker">
                  Back to sign in
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
