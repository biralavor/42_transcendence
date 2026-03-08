import { Link } from 'react-router-dom'
import './Login.css'
import NavbarComponent from '../Components/Navbar'

export default function ForgotPassword() {
  return (
    <>
      <NavbarComponent />

      <main className="w-100 m-auto form-container">
        <form className="form-box">
          <div className="text-center mb-1">
            <img
              src="/logo_tight_square.png"
              className="logo"
              alt="ft_transcendence logo"
            />
          </div>

          <h1 className="h3 mb-2 fw-normal text-center">Recover your password</h1>

          <p className="text-body-secondary text-center mb-3">
            Enter your e-mail address and we will send you instructions to reset your password.
          </p>

          <div className="form-floating mb-3">
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

          <button className="btn btn-primary w-100 py-2 mb-3" type="submit">
            Send recovery link
          </button>

          <p className="text-center mb-0">
            <Link to="/login" className="small text-decoration-none">
              Back to sign in
            </Link>
          </p>

          <p className="text-body-secondary mt-4 mb-0 text-center">© 2026</p>
        </form>
      </main>
    </>
  )
}