import { Link } from 'react-router-dom'
import './Login.css'
import NavbarComponent from '../Components/Navbar'

export default function Login() {
  return (
    <>
     <NavbarComponent></NavbarComponent>
    
      <main className="w-100 m-auto form-container">
        <form id="loginForm" className="form-box">
          <div className="text-center mb-1">
            <img src="/logo_tight_square.png" className="logo" alt="ft_transcendence logo" />
          </div>

          <h1 className="h3 mb-2 fw-normal text-center">Please sign in</h1>

          <div className="form-floating mb-2">
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

          <div className="form-floating mb-2">
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

          <div className="form-check text-start my-3">
            <input className="form-check-input" type="checkbox" id="flexCheckDefault" />
            <label className="form-check-label" htmlFor="flexCheckDefault">Remember me</label>
          </div>
          <div>
            <Link to="/forgot-password" className='small text-decoration-none'>
            Forgot Password?
            </Link>
          </div>
          <button className="btn btn-primary w-100 py-2" type="submit">Sign in</button>
          <p className="text-center mt-3 mb-0">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-decoration-none">
              Create one
            </Link>
          </p>
          <p className="text-body-secondary mt-5 mb-3 text-center">© 2026</p>
        </form>
        
      </main>
  </>
  )
}
