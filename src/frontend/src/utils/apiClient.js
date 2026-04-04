/**
 * Centralized HTTP Client with Automatic Token Refresh
 *
 * Features:
 * - Adds Authorization header automatically
 * - On 401: attempts token refresh + retries request
 * - On refresh failure: logs out user + redirects to /login
 * - Prevents concurrent refresh requests with a queue
 * - Handles network errors gracefully
 *
 * Usage:
 *   import { apiCall } from './apiClient'
 *   const response = await apiCall('/api/endpoint', { method: 'POST', body: {...} })
 */

import { getStoredAuth, saveAuth, clearAuth } from '../context/authStorage'
import { getTimeUntilExpiry } from './jwtUtils'

// Singleton state for refresh queue
let isRefreshing = false
let refreshPromise = null

/**
 * Attempt to refresh the access token using the refresh token.
 * Returns new auth data on success, null on failure.
 * @returns {Promise<object|null>}
 */
async function attemptTokenRefresh() {
  const storedAuth = getStoredAuth()
  if (!storedAuth?.refresh_token) {
    console.warn('[apiClient] No refresh token available')
    return null
  }

  try {
    const response = await fetch('/api/users/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: storedAuth.refresh_token }),
    })

    if (!response.ok) {
      console.warn('[apiClient] Token refresh failed with status', response.status)
      return null
    }

    const newAuth = await response.json()

    // Validate new auth data
    if (!newAuth.access_token || !newAuth.refresh_token) {
      console.warn('[apiClient] Invalid refresh response - missing tokens')
      return null
    }

    // Save new tokens
    saveAuth(newAuth, storedAuth.rememberMe ?? false)
    console.debug('[apiClient] Token refreshed successfully')
    return newAuth
  } catch (err) {
    console.error('[apiClient] Token refresh error:', err.message)
    return null
  }
}

/**
 * Queue-based token refresh to prevent concurrent refresh attempts.
 * Only one refresh can be in flight at a time.
 * @returns {Promise<object|null>}
 */
async function queuedTokenRefresh() {
  if (isRefreshing) {
    // Already refreshing, return the existing promise
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = attemptTokenRefresh().finally(() => {
    isRefreshing = false
    refreshPromise = null
  })

  return refreshPromise
}

/**
 * Handle logout: clear auth state and redirect to login.
 * This should trigger via navigation in the app root.
 * @param {object} options - { dispatch?, navigate? }
 */
function handleLogout() {
  clearAuth()

  // Try to redirect using global navigation if available
  if (typeof window !== 'undefined') {
    // Can't use useNavigate() hook here, so we dispatch an event
    // Components listening for 'auth:logout' can handle navigation
    window.dispatchEvent(
      new CustomEvent('auth:logout', { detail: { redirectTo: '/login' } })
    )

    // Fallback: direct navigation if possible
    try {
      window.location.href = '/login'
    } catch (err) {
      console.error('[apiClient] Failed to redirect to /login:', err.message)
    }
  }
}

/**
 * Make an authenticated API call with automatic 401 handling.
 *
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} On network error, after 401 retry fails, or on other HTTP errors
 *
 * @example
 * // GET request
 * const response = await apiCall('/api/users/profile')
 * const data = await response.json()
 *
 * @example
 * // POST request with body
 * const response = await apiCall('/api/chat/message', {
 *   method: 'POST',
 *   body: JSON.stringify({ text: 'Hello' })
 * })
 *
 * @example
 * // Handle errors
 * try {
 *   const response = await apiCall('/api/protected-endpoint')
 *   if (!response.ok) throw new Error(`HTTP ${response.status}`)
 *   return await response.json()
 * } catch (err) {
 *   console.error('API call failed:', err)
 * }
 */
export async function apiCall(url, options = {}) {
  // Merge options
  const headers = { ...options.headers }

  // Add Authorization header if we have a token
  const storedAuth = getStoredAuth()
  if (storedAuth?.access_token) {
    headers.Authorization = `Bearer ${storedAuth.access_token}`

    // Warn if token is expiring soon (but still allow the call)
    const timeLeft = getTimeUntilExpiry(storedAuth.access_token)
    if (timeLeft && timeLeft < 60000) {
      // Less than 1 minute
      console.warn(
        '[apiClient] Token expires soon - consider refreshing before next call'
      )
    }
  }

  const fetchOptions = {
    ...options,
    headers,
  }

  // Make the request
  let response = await fetch(url, fetchOptions)

  // Handle 401 Unauthorized
  if (response.status === 401) {
    console.debug('[apiClient] Got 401 - attempting token refresh')

    // Attempt to refresh token (with queue to prevent duplicates)
    const newAuth = await queuedTokenRefresh()

    if (newAuth?.access_token) {
      // Refresh succeeded, retry original request with new token
      console.debug('[apiClient] Token refreshed - retrying original request')
      headers.Authorization = `Bearer ${newAuth.access_token}`
      const retryOptions = { ...fetchOptions, headers }
      response = await fetch(url, retryOptions)
    } else {
      // Refresh failed - user needs to log in again
      console.warn('[apiClient] Token refresh failed - logging out')
      handleLogout()

      // Throw error to inform caller that auth failed
      throw new Error('Session expired - please log in again')
    }
  }

  return response
}

/**
 * Convenience wrapper around apiCall for JSON responses.
 * Handles JSON parsing and error responses.
 *
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} On network error, HTTP error, or JSON parse error
 *
 * @example
 * try {
 *   const user = await apiJson('/api/users/me')
 *   console.log('Logged in as:', user.username)
 * } catch (err) {
 *   console.error('Failed to get user:', err.message)
 * }
 */
export async function apiJson(url, options = {}) {
  const response = await apiCall(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    let errorDetails = `HTTP ${response.status}`
    try {
      const errData = await response.json()
      if (errData.detail) errorDetails = errData.detail
    } catch {
      // Response is not JSON
    }
    throw new Error(errorDetails)
  }

  return response.json()
}

/**
 * Manually trigger a token refresh (for proactive refresh before expiry).
 * Useful when called from the expiry timer in authContext.
 *
 * @returns {Promise<object|null>} New auth data, or null if refresh failed
 *
 * @example
 * // In auth context expiry timer
 * const newAuth = await manualRefreshToken()
 * if (newAuth) {
 *   contextLogin(newAuth)
 * } else {
 *   contextLogout()
 * }
 */
export async function manualRefreshToken() {
  const newAuth = await queuedTokenRefresh()
  if (newAuth) {
    console.debug('[apiClient] Manual token refresh succeeded')
  } else {
    console.warn('[apiClient] Manual token refresh failed')
  }
  return newAuth
}

/**
 * Get the stored auth state (token, refresh_token, etc).
 * Mostly for debugging - components should use AuthContext instead.
 *
 * @returns {object|null} Stored auth data or null
 */
export function getStoredAuthData() {
  return getStoredAuth()
}

/**
 * Explicitly clear stored auth (logout).
 * Usually called by AuthContext.logout, but can be called directly if needed.
 */
export function clearStoredAuth() {
  clearAuth()
}

export default {
  apiCall,
  apiJson,
  manualRefreshToken,
  getStoredAuthData,
  clearStoredAuth,
}
