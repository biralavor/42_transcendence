import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiCall, apiJson, manualRefreshToken, getStoredAuthData } from './apiClient'
import * as authStorage from '../context/authStorage'

// Mock the auth storage module
vi.mock('../context/authStorage', () => ({
  getStoredAuth: vi.fn(),
  saveAuth: vi.fn(),
  clearAuth: vi.fn(),
}))

// Mock jwtUtils
vi.mock('./jwtUtils', () => ({
  getTimeUntilExpiry: vi.fn(() => 500000), // Default: token expires in ~8 min
}))

describe('apiClient', () => {
  let fetchMock

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()

    // Mock global fetch
    fetchMock = vi.fn()
    global.fetch = fetchMock

    // Mock window.dispatchEvent
    global.dispatchEvent = vi.fn()

    // Default: have stored auth available
    authStorage.getStoredAuth.mockReturnValue({
      access_token: 'valid_token_123',
      refresh_token: 'refresh_token_456',
      token_type: 'bearer',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('apiCall', () => {
    it('should make a successful GET request', async () => {
      const responseData = { id: 1, name: 'Alice' }
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(responseData), { status: 200 })
      )

      const response = await apiCall('/api/users/1')

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock).toHaveBeenCalledWith('/api/users/1', {
        headers: { Authorization: 'Bearer valid_token_123' },
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(responseData)
    })

    it('should add Authorization header with stored token', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      await apiCall('/api/endpoint', {})

      const call = fetchMock.mock.calls[0]
      expect(call[1].headers.Authorization).toBe('Bearer valid_token_123')
    })

    it('should not add Authorization header if no token stored', async () => {
      authStorage.getStoredAuth.mockReturnValueOnce(null)
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      await apiCall('/api/endpoint', {})

      const call = fetchMock.mock.calls[0]
      expect(call[1].headers.Authorization).toBeUndefined()
    })

    it('should merge custom headers with Authorization header', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      await apiCall('/api/endpoint', {
        headers: { 'X-Custom': 'value' },
      })

      const call = fetchMock.mock.calls[0]
      expect(call[1].headers.Authorization).toBe('Bearer valid_token_123')
      expect(call[1].headers['X-Custom']).toBe('value')
    })

    it('should handle POST request with body', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }))

      const body = { text: 'Hello' }
      await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const call = fetchMock.mock.calls[0]
      expect(call[0]).toBe('/api/messages')
      expect(call[1].method).toBe('POST')
      expect(call[1].body).toBe(JSON.stringify(body))
    })

    it('should handle 401 and attempt token refresh', async () => {
      // First call returns 401
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 })
      )

      // Refresh endpoint call succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new_token_xyz',
            refresh_token: 'new_refresh_abc',
            token_type: 'bearer',
          }),
          { status: 200 }
        )
      )

      // Retry call succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      const response = await apiCall('/api/protected', { method: 'GET' })

      // Should have made 3 calls: original, refresh, retry
      expect(fetchMock).toHaveBeenCalledTimes(3)

      // First call to original endpoint
      expect(fetchMock.mock.calls[0][0]).toBe('/api/protected')

      // Second call to refresh endpoint
      expect(fetchMock.mock.calls[1][0]).toBe('/api/users/auth/refresh')
      expect(fetchMock.mock.calls[1][1].method).toBe('POST')

      // Third call to original endpoint with new token
      expect(fetchMock.mock.calls[2][0]).toBe('/api/protected')
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
        'Bearer new_token_xyz'
      )

      // New tokens should be saved
      expect(authStorage.saveAuth).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'new_token_xyz' }),
        expect.any(Boolean)
      )

      // Response should be the final retry response
      expect(await response.json()).toEqual({ success: true })
    })

    it('should logout if refresh fails', async () => {
      // First call returns 401
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      // Refresh endpoint call fails
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      // Attempt to call apiCall should throw
      await expect(apiCall('/api/protected')).rejects.toThrow(
        'Session expired - please log in again'
      )

      // Should have called clearAuth
      expect(authStorage.clearAuth).toHaveBeenCalled()
    })

    it('should handle refresh endpoint returning invalid data', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      // Refresh returns 200 but with incomplete data
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ token_type: 'bearer' }), { status: 200 })
      )

      await expect(apiCall('/api/protected')).rejects.toThrow(
        'Session expired - please log in again'
      )

      expect(authStorage.clearAuth).toHaveBeenCalled()
    })

    it('should prevent concurrent token refreshes', async () => {
      // Two parallel requests both get 401
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      // Refresh succeeds only after delay
      fetchMock.mockImplementationOnce(() =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve(
                new Response(
                  JSON.stringify({
                    access_token: 'new_token',
                    refresh_token: 'new_refresh',
                    token_type: 'bearer',
                  }),
                  { status: 200 }
                )
              ),
            10
          )
        )
      )

      // First retry
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      // Second retry
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      // Make two concurrent requests
      const [result1, result2] = await Promise.all([
        apiCall('/api/protected1').then(r => r.status),
        apiCall('/api/protected2').then(r => r.status),
      ])

      expect(result1).toBe(200)
      expect(result2).toBe(200)

      // saveAuth should be called once (not twice)
      expect(authStorage.saveAuth).toHaveBeenCalledOnce()

      // Refresh should be called once (not twice)
      const refreshCalls = fetchMock.mock.calls.filter(
        call => call[0] === '/api/users/auth/refresh'
      )
      expect(refreshCalls).toHaveLength(1)
    })

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiCall('/api/endpoint')).rejects.toThrow('Network error')
    })

    it('should pass through non-401 error responses', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Bad Request' }), { status: 400 })
      )

      const response = await apiCall('/api/endpoint')

      expect(response.status).toBe(400)
      // Should not attempt refresh
      expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('should handle empty refresh_token in storage', async () => {
      authStorage.getStoredAuth.mockReturnValueOnce({
        access_token: 'valid_token',
      })

      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      await expect(apiCall('/api/protected')).rejects.toThrow(
        'Session expired - please log in again'
      )

      expect(authStorage.clearAuth).toHaveBeenCalled()
    })
  })

  describe('apiJson', () => {
    it('should return parsed JSON response', async () => {
      const data = { id: 1, name: 'Bob' }
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(data), { status: 200 })
      )

      const result = await apiJson('/api/users/1')

      expect(result).toEqual(data)
    })

    it('should set Content-Type header for JSON', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      )

      await apiJson('/api/endpoint')

      const call = fetchMock.mock.calls[0]
      expect(call[1].headers['Content-Type']).toBe('application/json')
    })

    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
      )

      await expect(apiJson('/api/missing')).rejects.toThrow('Not found')
    })

    it('should throw with HTTP status if no detail in response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 404 })
      )

      await expect(apiJson('/api/missing')).rejects.toThrow('HTTP 404')
    })

    it('should handle non-JSON error response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Not JSON', { status: 500 })
      )

      await expect(apiJson('/api/endpoint')).rejects.toThrow('HTTP 500')
    })

    it('should merge custom headers with Content-Type (not overwrite)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      )

      await apiJson('/api/endpoint', {
        headers: { 'X-Custom-Header': 'custom-value' },
      })

      const call = fetchMock.mock.calls[0]
      // Content-Type should be preserved
      expect(call[1].headers['Content-Type']).toBe('application/json')
      // Custom header should also be present
      expect(call[1].headers['X-Custom-Header']).toBe('custom-value')
    })

    it('should allow custom headers to override default headers', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      )

      await apiJson('/api/endpoint', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      const call = fetchMock.mock.calls[0]
      // Custom Content-Type should be used (not the default)
      expect(call[1].headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded'
      )
    })
  })

  describe('manualRefreshToken', () => {
    it('should refresh token on demand', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'fresh_token',
            refresh_token: 'fresh_refresh',
            token_type: 'bearer',
          }),
          { status: 200 }
        )
      )

      const newAuth = await manualRefreshToken()

      expect(newAuth).toEqual(
        expect.objectContaining({
          access_token: 'fresh_token',
        })
      )
      expect(fetchMock).toHaveBeenCalledWith('/api/users/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'refresh_token_456' }),
      })
    })

    it('should return null if refresh fails', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      const result = await manualRefreshToken()

      expect(result).toBeNull()
    })
  })

  describe('getStoredAuthData', () => {
    it('should return stored auth', () => {
      const auth = getStoredAuthData()

      expect(auth).toEqual({
        access_token: 'valid_token_123',
        refresh_token: 'refresh_token_456',
        token_type: 'bearer',
      })
      expect(authStorage.getStoredAuth).toHaveBeenCalled()
    })

    it('should preserve storageType (remember-me) when refreshing from localStorage', async () => {
      // Simulate token stored in localStorage (remember-me case)
      // Note: mockReturnValue (not Once) because getStoredAuth is called twice:
      // 1) in apiCall() to add Authorization header, 2) in attemptTokenRefresh()
      authStorage.getStoredAuth.mockReturnValue({
        access_token: 'old_token',
        refresh_token: 'refresh_token_456',
        token_type: 'bearer',
        storageType: 'local', // ← Key: stored in localStorage
      })

      // First call returns 401
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      // Refresh succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new_token_xyz',
            refresh_token: 'new_refresh_token',
            token_type: 'bearer',
          }),
          { status: 200 }
        )
      )

      // Retry succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      await apiCall('/api/protected')

      // When saving refreshed tokens, should save to localStorage (preserve remember-me)
      expect(authStorage.saveAuth).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'new_token_xyz' }),
        true // ← Should be TRUE for localStorage
      )
    })

    it('should preserve storageType when refreshing from sessionStorage', async () => {
      // Simulate token stored in sessionStorage (non-remember-me case)
      // Note: mockReturnValue (not Once) because getStoredAuth is called twice:
      // 1) in apiCall() to add Authorization header, 2) in attemptTokenRefresh()
      authStorage.getStoredAuth.mockReturnValue({
        access_token: 'old_token',
        refresh_token: 'refresh_token_456',
        token_type: 'bearer',
        storageType: 'session', // ← Key: stored in sessionStorage
      })

      // First call returns 401
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

      // Refresh succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new_token_xyz',
            refresh_token: 'new_refresh_token',
            token_type: 'bearer',
          }),
          { status: 200 }
        )
      )

      // Retry succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      await apiCall('/api/protected')

      // When saving refreshed tokens, should save to sessionStorage
      expect(authStorage.saveAuth).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'new_token_xyz' }),
        false // ← Should be FALSE for sessionStorage
      )
    })
  })
})
