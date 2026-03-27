import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './authContext'

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
    await act(async () => {})
    expect(result.current.isAuthReady).toBe(true)
  })

  it('isAuthenticated is false when storage is empty on mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('isAuthenticated is true when sessionStorage has valid tokens on mount', async () => {
    sessionStorage.setItem('access_token', 'acc')
    sessionStorage.setItem('refresh_token', 'ref')
    sessionStorage.setItem('token_type', 'bearer')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('isAuthenticated is true when localStorage has valid tokens on mount', async () => {
    localStorage.setItem('access_token', 'acc')
    localStorage.setItem('refresh_token', 'ref')
    localStorage.setItem('token_type', 'bearer')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
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
    await act(async () => {})
    expect(result.current.isAuthenticated).toBe(true)
    await act(async () => { result.current.logout() })
    expect(result.current.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })
})
