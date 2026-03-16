import { Link } from 'react-router-dom'
import { useState } from 'react'
import './RegisterForm.css'

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!formData.termsAccepted || !formData.privacyAccepted) {
      setError('You must accept the Terms of Use and Privacy Policy.')
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
          email: formData.email,
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
        email: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
        privacyAccepted: false,
      })
    } catch (err) {
      setError('Unable to connect to the server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  let buttonText = 'Create account'
  if (isSubmitting)
    buttonText = 'Creating account...'

  return (
    <div className="register-page arcade-auth-layout">
      <div className="w-100 m-auto form-container">
        <form className="form-box arcade-screen arcade-form-card" id="registerForm" onSubmit={handleSubmit}>
          <div className="arcade-panel">
            <div className="text-center mb-2">
              <img
                src="/logo_tight_square.png"
                className="logo"
                alt="ft_transcendence logo"
              />
            </div>

            <h1 className="arcade-title text-center mb-2" style={{ fontSize: '2.1rem' }}>Create your account</h1>
            <p className="arcade-form-copy text-center mb-4">
              Build your player identity, unlock the arena, and start climbing the scoreboard.
            </p>

            {error && (
              <div className="alert alert-danger py-2" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success py-2" role="alert">
                {success}
              </div>
            )}

            <div className="form-floating mb-3 arcade-form-control">
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

            <div className="form-floating mb-3 arcade-form-control">
              <input
                type="email"
                className="form-control"
                id="floatingEmail"
                name="email"
                placeholder="your_email@example.com"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
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
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <label htmlFor="floatingPassword">Password</label>
            </div>

            <div className="form-floating mb-3 arcade-form-control">
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

            <div className="form-check text-start mb-2 arcade-form-check">
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

            <div className="form-check text-start mb-4 arcade-form-check">
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

            <button
              className="arcade-btn arcade-btn-primary w-100 mb-3"
              type="submit"
              disabled={isSubmitting}
            >
              {buttonText}
            </button>

            <p className="text-center arcade-form-copy mb-0">
              Already have an account? <Link className="arcade-kicker text-decoration-none" to="/login">Sign in</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterForm
