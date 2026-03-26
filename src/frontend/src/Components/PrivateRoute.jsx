import { useAuth } from '../context/authContext'
import AuthRequired from './AuthRequired'

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isAuthReady } = useAuth()

  if (!isAuthReady)
    return null

  if (!isAuthenticated)
    return <AuthRequired />

  return children
}