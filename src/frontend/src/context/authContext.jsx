import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getStoredAuth, saveAuth, clearAuth } from './authStorage'
import { getTimeUntilExpiry } from '../utils/jwtUtils'
import { manualRefreshToken } from '../utils/apiClient'
import { startInactivityTracker, stopInactivityTracker, resetInactivityTimer } from '../utils/inactivityTracker'
import InactivityWarning from '../Components/InactivityWarning'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    access_token: null,
    refresh_token: null,
    token_type: null,
  })
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [showInactivityWarning, setShowInactivityWarning] = useState(false)

  useEffect(() => {
    const storedAuth = getStoredAuth()

    if (storedAuth) {
      setAuth({
        access_token: storedAuth.access_token,
        refresh_token: storedAuth.refresh_token,
        token_type: storedAuth.token_type,
      })
    }

    setIsAuthReady(true)
  }, [])

  const login = (authData, rememberMe = false) => {
    setAuth({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      token_type: authData.token_type,
    })

    saveAuth(authData, rememberMe)
  }

  const logout = () => {
    setAuth({
      access_token: null,
      refresh_token: null,
      token_type: null,
    })

    clearAuth()
  }

  // Proactive token refresh: set up a timer to refresh before expiry
  useEffect(() => {
    if (!auth.access_token) {
      // No token, no timer needed
      return
    }

    const timeUntilExpiry = getTimeUntilExpiry(auth.access_token)
    if (!timeUntilExpiry || timeUntilExpiry <= 0) {
      // Token already expired
      console.warn('[authContext] Access token has expired, logging out')
      logout()
      return
    }

    // Refresh 30 seconds before expiry (safety buffer for clock skew/network delay)
    const REFRESH_BUFFER_MS = 30 * 1000
    const delayMs = Math.max(timeUntilExpiry - REFRESH_BUFFER_MS, 1000)

    console.debug(
      `[authContext] Token expires in ${Math.ceil(timeUntilExpiry / 1000)}s, refresh scheduled in ${Math.ceil(delayMs / 1000)}s`
    )

    const timerId = setTimeout(async () => {
      console.debug('[authContext] Token expiry timer fired, attempting refresh')
      try {
        const newAuth = await manualRefreshToken()
        if (newAuth) {
          // Refresh succeeded, update the token
          // This will trigger this useEffect again with the new token
          login(newAuth)
          console.debug('[authContext] Proactive token refresh succeeded')
        } else {
          // Refresh failed, user needs to log in again
          console.warn('[authContext] Proactive token refresh failed, logging out')
          logout()
        }
      } catch (err) {
        console.error('[authContext] Error during proactive token refresh:', err)
        logout()
      }
    }, delayMs)

    // Cleanup: clear timer if component unmounts or token changes
    return () => {
      clearTimeout(timerId)
    }
  }, [auth.access_token]) // Re-run only when access_token changes

  const handleInactivityLogout = () => {
    logout()
    window.location.href = '/login?reason=inactivity_logout'
  }

  const handleStayLoggedIn = () => {
    setShowInactivityWarning(false)
    resetInactivityTimer(true)
  }

  const isAuthenticated = Boolean(
    auth.access_token && auth.refresh_token && auth.token_type
  )

  useEffect(() => {
    if (!isAuthenticated) return

    startInactivityTracker({
      onWarning: () => setShowInactivityWarning(true),
      onLogout: handleInactivityLogout
    })

    return () => {
      stopInactivityTracker()
      setShowInactivityWarning(false)
    }
  }, [isAuthenticated])

  const value = useMemo(() => ({
    auth,
    isAuthenticated,
    isAuthReady,
    login,
    logout,
  }), [auth, isAuthenticated, isAuthReady])

  console.log('Auth state:', auth)
  console.log('isAuthenticated:', isAuthenticated)

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showInactivityWarning && (
        <InactivityWarning
          onStayLoggedIn={handleStayLoggedIn}
          onLogoutNow={handleInactivityLogout}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context)
    throw new Error('useAuth must be used within an AuthProvider')

  return context
}