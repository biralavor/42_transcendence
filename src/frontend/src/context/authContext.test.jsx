import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './authContext'

// Mock the dependencies
vi.mock('../utils/jwtUtils', () => ({
  getTimeUntilExpiry: vi.fn(() => 900000), // Default: 15 min (safe for most tests)
}))

vi.mock('../utils/apiClient', () => ({
  manualRefreshToken: vi.fn(),
}))

const MOCK_AUTH = {
  access_token: 'acc',
  refresh_token: 'ref',
  token_type: 'bearer',
}

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('AuthProvider — hydration', () => {
  it('isAuthReady becomes true after mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { })
    expect(result.current.isAuthReady).toBe(true)
  })

  it('isAuthenticated is false when storage is empty on mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { })
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('isAuthenticated is true when sessionStorage has valid tokens on mount', async () => {
    sessionStorage.setItem('access_token', 'acc')
    sessionStorage.setItem('refresh_token', 'ref')
    sessionStorage.setItem('token_type', 'bearer')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('isAuthenticated is true when localStorage has valid tokens on mount', async () => {
    localStorage.setItem('access_token', 'acc')
    localStorage.setItem('refresh_token', 'ref')
    localStorage.setItem('token_type', 'bearer')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { })
    expect(result.current.isAuthenticated).toBe(true)
  })
})

describe('AuthProvider — login', () => {
  it('login() sets isAuthenticated to true and saves to sessionStorage by default', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { result.current.login(MOCK_AUTH) })
    expect(result.current.isAuthenticated).toBe(true)
    expect(sessionStorage.getItem('access_token')).toBe('acc')
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('login(data, true) saves to localStorage and clears sessionStorage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { result.current.login(MOCK_AUTH, true) })
    expect(result.current.isAuthenticated).toBe(true)
    expect(localStorage.getItem('access_token')).toBe('acc')
    expect(sessionStorage.getItem('access_token')).toBeNull()
  })
})

describe('AuthProvider — logout', () => {
  it('logout() sets isAuthenticated to false and clears both storages', async () => {
    sessionStorage.setItem('access_token', 'acc')
    sessionStorage.setItem('refresh_token', 'ref')
    sessionStorage.setItem('token_type', 'bearer')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { })
    expect(result.current.isAuthenticated).toBe(true)
    await act(async () => { result.current.logout() })
    expect(result.current.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })
})

describe('AuthProvider — Expiry Timer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should set up expiry timer when token is logged in', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    getTimeUntilExpiry.mockReturnValue(900000) // 15 min from now

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.login({
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        token_type: 'bearer',
      })
    })

    // Timer should have been set up
    expect(getTimeUntilExpiry).toHaveBeenCalled()
  })

  it('should attempt refresh when timer fires', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const { manualRefreshToken } = await import('../utils/apiClient')

    getTimeUntilExpiry.mockReturnValue(60000) // 1 min from now
    manualRefreshToken.mockResolvedValue({
      access_token: 'new_token',
      refresh_token: 'new_refresh',
      token_type: 'bearer',
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.login({
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        token_type: 'bearer',
      })
    })

    // Advance time to when refresh timer should fire
    // Timer fires at: 60000 - 30000 = 30000ms
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    expect(manualRefreshToken).toHaveBeenCalled()
  })

  it('should logout if token is already expired', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

    getTimeUntilExpiry.mockReturnValue(-1000) // Already expired

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.login({
        access_token: 'expired_token',
        refresh_token: 'test_refresh',
        token_type: 'bearer',
      })
    })

    // Should have logged out due to expiry
    expect(result.current.isAuthenticated).toBe(false)
    consoleWarnSpy.mockRestore()
  })

  it('should logout if refresh fails', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const { manualRefreshToken } = await import('../utils/apiClient')
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

    getTimeUntilExpiry.mockReturnValue(60000) // 1 min from now
    manualRefreshToken.mockResolvedValue(null) // Refresh failed

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.login({
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        token_type: 'bearer',
      })
    })

    expect(result.current.isAuthenticated).toBe(true)

    // Advance time to timer fire
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    // Should have logged out after failed refresh
    expect(result.current.isAuthenticated).toBe(false)
    consoleWarnSpy.mockRestore()
  })

  it('should clear timer when token is cleared (logout)', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    getTimeUntilExpiry.mockReturnValue(900000)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.login({
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        token_type: 'bearer',
      })
    })

    // Now logout
    await act(async () => {
      result.current.logout()
    })

    // clearTimeout should have been called
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('should not throw if no token on initial mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => { })

    expect(result.current.isAuthenticated).toBe(false)
    expect(() => {
      // Accessing result should not throw
      result.current.auth
    }).not.toThrow()
  })

  it('should refresh immediately when token is near-expiry (< 30s remaining)', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const { manualRefreshToken } = await import('../utils/apiClient')

    getTimeUntilExpiry.mockReturnValue(10000) // Only 10s until expiry (< 30s buffer)
    manualRefreshToken.mockResolvedValue({
      access_token: 'new_token',
      refresh_token: 'new_refresh',
      token_type: 'bearer',
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.login({
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        token_type: 'bearer',
      })
    })

    // Should refresh immediately (delay should be 0, not clamped to 1000ms)
    // Timer fires at: max(10000 - 30000, 0) = max(-20000, 0) = 0
    await act(async () => {
      vi.advanceTimersByTime(0) // Fire immediately
    })

    expect(manualRefreshToken).toHaveBeenCalled()
  })

  it('should handle edge case: token expires in 1 second', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const { manualRefreshToken } = await import('../utils/apiClient')

    getTimeUntilExpiry.mockReturnValue(1000) // 1 second until expiry
    manualRefreshToken.mockResolvedValue({
      access_token: 'new_token',
      refresh_token: 'new_refresh',
      token_type: 'bearer',
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.login({
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        token_type: 'bearer',
      })
    })

    // Should refresh immediately, not wait 1000ms
    // Timer fires at: max(1000 - 30000, 0) = 0
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    expect(manualRefreshToken).toHaveBeenCalled()
  })

  it('should preserve remember-me (localStorage) during proactive refresh', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const { manualRefreshToken } = await import('../utils/apiClient')
    const authStorageModule = await import('../context/authStorage')

    getTimeUntilExpiry.mockReturnValue(60000) // 1 min
    manualRefreshToken.mockResolvedValue({
      access_token: 'new_token_xyz',
      refresh_token: 'new_refresh_token',
      token_type: 'bearer',
    })

    // Track saveAuth calls to verify remember-me is preserved
    const saveSpy = vi.spyOn(authStorageModule, 'saveAuth')

    const { result } = renderHook(() => useAuth(), { wrapper })

    // User logs in with "remember me" (localStorage)
    await act(async () => {
      result.current.login(
        {
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          token_type: 'bearer',
        },
        true // Remember me!
      )
    })

    // Verify tokens were saved to localStorage
    expect(saveSpy).toHaveBeenLastCalledWith(
      expect.any(Object),
      true // localStorage
    )

    // Advance time to trigger proactive refresh
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    // After refresh, tokens should STILL be saved to localStorage
    // (not sessionStorage), preserving the remember-me choice
    const lastCall = saveSpy.mock.calls[saveSpy.mock.calls.length - 1]
    expect(lastCall[1]).toBe(true) // Should still be localStorage (rememberMe = true)

    saveSpy.mockRestore()
  })

  it('should preserve non-remember-me (sessionStorage) during proactive refresh', async () => {
    const { getTimeUntilExpiry } = await import('../utils/jwtUtils')
    const { manualRefreshToken } = await import('../utils/apiClient')
    const authStorageModule = await import('../context/authStorage')

    getTimeUntilExpiry.mockReturnValue(60000) // 1 min
    manualRefreshToken.mockResolvedValue({
      access_token: 'new_token_xyz',
      refresh_token: 'new_refresh_token',
      token_type: 'bearer',
    })

    // Track saveAuth calls to verify remember-me is NOT set
    const saveSpy = vi.spyOn(authStorageModule, 'saveAuth')

    const { result } = renderHook(() => useAuth(), { wrapper })

    // User logs in WITHOUT "remember me" (sessionStorage)
    await act(async () => {
      result.current.login(
        {
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          token_type: 'bearer',
        },
        false // No remember me
      )
    })

    // Verify tokens were saved to sessionStorage
    expect(saveSpy).toHaveBeenLastCalledWith(
      expect.any(Object),
      false // sessionStorage
    )

    // Advance time to trigger proactive refresh
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    // After refresh, tokens should STILL be saved to sessionStorage
    // (not localStorage), preserving the non-remember-me choice
    const lastCall = saveSpy.mock.calls[saveSpy.mock.calls.length - 1]
    expect(lastCall[1]).toBe(false) // Should still be sessionStorage (rememberMe = false)

    saveSpy.mockRestore()
  })
})
