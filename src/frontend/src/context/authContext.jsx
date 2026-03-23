import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getStoredAuth, saveAuth, clearAuth } from './authStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    access_token: null,
    refresh_token: null,
    token_type: null,
  })

  useEffect(() => {
    const storedAuth = getStoredAuth()

    if (storedAuth) {
      setAuth({
        access_token: storedAuth.access_token,
        refresh_token: storedAuth.refresh_token,
        token_type: storedAuth.token_type,
      })
    }
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

  const isAuthenticated = Boolean(
    auth.access_token && auth.refresh_token && auth.token_type
  )

  const value = useMemo(() => ({
    auth,
    isAuthenticated,
    login,
    logout,
  }), [auth, isAuthenticated])

  console.log('Auth state:', auth)
  console.log('isAuthenticated:', isAuthenticated)
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context)
    throw new Error('useAuth must be used within an AuthProvider')

  return context
}