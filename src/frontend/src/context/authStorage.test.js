import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredAuth, saveAuth, clearAuth } from './authStorage'

const MOCK_AUTH = {
  access_token: 'acc',
  refresh_token: 'ref',
  token_type: 'bearer',
}

function seedSession() {
  sessionStorage.setItem('access_token', 'acc')
  sessionStorage.setItem('refresh_token', 'ref')
  sessionStorage.setItem('token_type', 'bearer')
}

function seedLocal() {
  localStorage.setItem('access_token', 'acc')
  localStorage.setItem('refresh_token', 'ref')
  localStorage.setItem('token_type', 'bearer')
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('getStoredAuth', () => {
  it('returns null when both storages are empty', () => {
    expect(getStoredAuth()).toBeNull()
  })

  it('returns session tokens when sessionStorage has all three keys', () => {
    seedSession()
    expect(getStoredAuth()).toMatchObject(MOCK_AUTH)
  })

  it('falls back to localStorage when sessionStorage is empty', () => {
    seedLocal()
    expect(getStoredAuth()).toMatchObject(MOCK_AUTH)
  })

  it('prefers sessionStorage over localStorage when both have tokens', () => {
    sessionStorage.setItem('access_token', 'session-acc')
    sessionStorage.setItem('refresh_token', 'session-ref')
    sessionStorage.setItem('token_type', 'bearer')
    localStorage.setItem('access_token', 'local-acc')
    localStorage.setItem('refresh_token', 'local-ref')
    localStorage.setItem('token_type', 'bearer')
    expect(getStoredAuth()?.access_token).toBe('session-acc')
  })
})

describe('saveAuth', () => {
  it('writes to sessionStorage and clears localStorage when rememberMe is false', () => {
    seedLocal()
    saveAuth(MOCK_AUTH, false)
    expect(sessionStorage.getItem('access_token')).toBe('acc')
    expect(sessionStorage.getItem('refresh_token')).toBe('ref')
    expect(sessionStorage.getItem('token_type')).toBe('bearer')
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(localStorage.getItem('token_type')).toBeNull()
  })

  it('writes to localStorage and clears sessionStorage when rememberMe is true', () => {
    seedSession()
    saveAuth(MOCK_AUTH, true)
    expect(localStorage.getItem('access_token')).toBe('acc')
    expect(localStorage.getItem('refresh_token')).toBe('ref')
    expect(localStorage.getItem('token_type')).toBe('bearer')
    expect(sessionStorage.getItem('access_token')).toBeNull()
    expect(sessionStorage.getItem('refresh_token')).toBeNull()
    expect(sessionStorage.getItem('token_type')).toBeNull()
  })
})

describe('clearAuth', () => {
  it('removes all three keys from both storages', () => {
    seedSession()
    seedLocal()
    clearAuth()
    expect(sessionStorage.getItem('access_token')).toBeNull()
    expect(sessionStorage.getItem('refresh_token')).toBeNull()
    expect(sessionStorage.getItem('token_type')).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(localStorage.getItem('token_type')).toBeNull()
  })
})
