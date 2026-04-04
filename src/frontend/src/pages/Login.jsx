import { Link, useNavigate } from 'react-router-dom'
import './Login.css'
import NavbarComponent from '../Components/Navbar'
import { useState } from 'react'
import { useAuth } from '../context/authContext'
import { apiJson } from '../utils/apiClient'

export default function Login() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    let newValue = value

    if (type === 'checkbox')
      newValue = checked

    setError('')
    setSuccess('')
    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      const data = await apiJson('/api/users/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      })

      if (!data) {
        setError('Login failed: invalid server response.')
        return
      }

      login(data, formData.rememberMe)
      navigate('/profile')
    } catch (err) {
      console.error('[Login] Error:', err.message)
      setError(err.message || 'Unable to connect to the server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-auth-layout auth-page">
        <div className="form-container auth-container">
          <form
            id="loginForm"
            className="form-box arcade-screen arcade-form-card auth-card"
            onSubmit={handleSubmit}
          >
            <div className="arcade-panel auth-panel">
              <div className="auth-header text-center">
                <span className="auth-eyebrow">Player access</span>
                <img
                  src="/logo_tight_square.png"
                  className="logo auth-logo"
                  alt="ft_transcendence logo"
                />
                <h1 className="arcade-title auth-title text-center">
                  Welcome back
                </h1>
                <p className="arcade-form-copy auth-subtitle text-center mb-0">
                  Sign in to continue your run, track your stats, and jump back
                  into the arena.
                </p>
              </div>

              <div className="auth-meta-grid">
                <div className="auth-meta-item">
                  <span className="auth-meta-value">Ranked</span>
                  <span className="auth-meta-label">Competitive queue</span>
                </div>
                <div className="auth-meta-item">
                  <span className="auth-meta-value">Profile</span>
                  <span className="auth-meta-label">Progress saved</span>
                </div>
                <div className="auth-meta-item">
                  <span className="auth-meta-value">Fast</span>
                  <span className="auth-meta-label">Quick access</span>
                </div>
              </div>

              <div className="form-floating mb-3 arcade-form-control auth-form-control">
                <input
                  type="text"
                  className="form-control"
                  id="floatingUsername"
                  name="username"
                  placeholder="Username"
                  autoComplete="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
                <label htmlFor="floatingUsername">Username</label>
              </div>

              <div className="form-floating mb-2 arcade-form-control auth-form-control">
                <input
                  type="password"
                  className="form-control"
                  id="floatingPassword"
                  name="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <label htmlFor="floatingPassword">Password</label>
              </div>

              <div className="auth-options">
                <div className="form-check arcade-form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="flexCheckDefault"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="flexCheckDefault"
                  >
                    Remember me
                  </label>
                </div>
              </div>

              {error && (
                <div className="alert alert-danger text-center mb-2" role="alert">
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success text-center mb-2" role="alert">
                  {success}
                </div>
              )}

              <button
                className="arcade-btn arcade-btn-primary w-100 auth-submit mb-3"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>

              <p className="text-center arcade-form-copy auth-footer-copy mb-0">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="auth-link text-decoration-none">
                  Create one
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}