import { Link } from 'react-router-dom'
import NavbarComponent from './Navbar'

export default function AuthRequired() {
  return (
    <>
      <NavbarComponent />

      <main className="auth-required-page">
        <section className="auth-required-card">
          <h1>Private Area</h1>
          <p>You must be logged in to access this page.</p>

          <div className="auth-required-actions">
            <Link to="/login" className="auth-required-button">
              Go to Login
            </Link>

            <Link to="/" className="auth-required-link">
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}