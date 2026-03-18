import { Link } from 'react-router-dom'
import { useState } from 'react'
import './RegisterForm.css'

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    // capture only the fields needed for account creation. Email is no
    // longer collected in this simplified registration flow.
    username: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    privacyAccepted: false,
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    let newValue = value

    if (type === 'checkbox')
      newValue = checked

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.termsAccepted || !formData.privacyAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to create an account.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch('/api/users/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          // email is intentionally omitted from the payload; the backend no longer
          // requires it for registration.
          password: formData.password,
        }),
      })

      let data = {}

      try {
        data = await response.json()
      } catch {
        data = {}
      }

      if (!response.ok) {
        if (data.message)
          setError(data.message)
        else
          setError('Failed to create account.')
        return
      }

      if (data.message)
        setSuccess(data.message)
      else
        setSuccess('Account created successfully!!')

      setFormData({
        username: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
        privacyAccepted: false,
      })
    } catch {
      setError('Unable to connect to the server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  let buttonText = 'Create account'
  if (isSubmitting)
    buttonText = 'Creating account...'

  return (
    <div className="w-100 m-auto form-container auth-container register-auth-container">
      <form className="form-box arcade-screen arcade-form-card auth-card" id="registerForm" onSubmit={handleSubmit}>
        <div className="arcade-panel auth-panel register-panel">
          <div className="auth-header text-center">
            <span className="auth-eyebrow">New player</span>
            <img
              src="/logo_tight_square.png"
              className="logo auth-logo"
              alt="ft_transcendence logo"
            />
            <h1 className="arcade-title auth-title text-center">Create your account</h1>
            <p className="arcade-form-copy auth-subtitle text-center mb-0">
              Build your player identity, unlock the arena, and start climbing the scoreboard.
            </p>
          </div>

          <div className="auth-meta-grid register-meta-grid">
            <div className="auth-meta-item">
              <span className="auth-meta-value">Profile</span>
              <span className="auth-meta-label">Custom identity</span>
            </div>
            <div className="auth-meta-item">
              <span className="auth-meta-value">Stats</span>
              <span className="auth-meta-label">Track progress</span>
            </div>
            <div className="auth-meta-item">
              <span className="auth-meta-value">Arena</span>
              <span className="auth-meta-label">Ready to play</span>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger py-2 auth-alert" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success py-2 auth-alert auth-alert-success" role="alert">
              {success}
            </div>
          )}

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

          {/* Email collection has been removed to streamline registration. If email
              support is added back in the future, reintroduce an email field here. */}

          <div className="register-password-grid">
            <div className="form-floating mb-3 arcade-form-control auth-form-control">
              <input
                type="password"
                className="form-control"
                id="floatingPassword"
                name="password"
                placeholder="Password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <label htmlFor="floatingPassword">Password</label>
            </div>

            <div className="form-floating mb-3 arcade-form-control auth-form-control">
              <input
                type="password"
                className="form-control"
                id="floatingConfirmPassword"
                name="confirmPassword"
                placeholder="Confirm Password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <label htmlFor="floatingConfirmPassword">Confirm password</label>
            </div>
          </div>

          <div className="register-checks">
            <div className="form-check text-start arcade-form-check register-check-item">
              <input
                className="form-check-input"
                type="checkbox"
                id="termsCheck"
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="termsCheck">
                I agree to the Terms of Use
              </label>
            </div>

            <div className="form-check text-start arcade-form-check register-check-item">
              <input
                className="form-check-input"
                type="checkbox"
                id="privacyCheck"
                name="privacyAccepted"
                checked={formData.privacyAccepted}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="privacyCheck">
                I agree to the Privacy Policy
              </label>
            </div>
          </div>

          <button
            className="arcade-btn arcade-btn-primary w-100 auth-submit mb-3"
            type="submit"
            disabled={isSubmitting}
          >
            {buttonText}
          </button>

          <p className="text-center arcade-form-copy auth-footer-copy mb-0">
            Already have an account? <Link className="auth-link text-decoration-none" to="/login">Sign in</Link>
          </p>
        </div>
      </form>
    </div>
  )
}

export default RegisterForm
