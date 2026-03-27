import { useAuth } from '../context/authContext'
import AuthRequired from './AuthRequired'
import NavbarComponent from './Navbar'
import './AuthRequired.css'

function AuthLoading() {
  return (
    <>
      <NavbarComponent />

      <main className="auth-required-page">
        <section
          className="auth-required-card"
          aria-busy="true"
          aria-live="polite"
        >
          <h1>Loading</h1>
          <p>Checking authentication status...</p>
        </section>
      </main>
    </>
  )
}

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isAuthReady } = useAuth()

  if (!isAuthReady)
    return <AuthLoading />

  if (!isAuthenticated)
    return <AuthRequired />

  return children
}