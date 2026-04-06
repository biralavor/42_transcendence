import { useAuth } from '../context/authContext'
import { Navigate } from 'react-router-dom'
import AuthLoading from './AuthLoading'

/**
 * PrivateRoute: Protects routes that require authentication
 * - Loading state: shows loading message
 * - Not authenticated: redirects to /login
 * - Authenticated: renders children
 */
export default function PrivateRoute({ children }) {
  const { isAuthenticated, isAuthReady } = useAuth()

  if (!isAuthReady)
    return <AuthLoading />

  if (!isAuthenticated)
    return <Navigate to="/login" replace />

  return children
}