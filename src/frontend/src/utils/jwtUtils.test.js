import { describe, it, expect, vi } from 'vitest'
import {
  decodeJWT,
  getTokenExpiry,
  getTimeUntilExpiry,
  isTokenValid,
  willTokenExpireSoon,
  getTokenUsername,
  getTokenClaims,
} from './jwtUtils'

describe('jwtUtils', () => {
  // Helper to create a valid JWT with custom claims
  const createToken = (expirySeconds = null, claims = {}) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    const now = Math.floor(Date.now() / 1000)
    const exp = expirySeconds ?? now + 900 // Default 15 min from now

    const payload = btoa(JSON.stringify({ exp, sub: 'testuser', ...claims }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    const signature = 'fake_signature'

    return `${header}.${payload}.${signature}`
  }

  describe('decodeJWT', () => {
    it('should decode a valid JWT', () => {
      const token = createToken(null, { username: 'alice' })
      const payload = decodeJWT(token)

      expect(payload).not.toBeNull()
      expect(payload.sub).toBe('testuser')
      expect(payload.username).toBe('alice')
      expect(typeof payload.exp).toBe('number')
    })

    it('should return null for invalid token format', () => {
      expect(decodeJWT('invalid')).toBeNull()
      expect(decodeJWT('two.parts')).toBeNull()
      expect(decodeJWT('one.two.three.four')).toBeNull()
    })

    it('should return null for null/undefined token', () => {
      expect(decodeJWT(null)).toBeNull()
      expect(decodeJWT(undefined)).toBeNull()
      expect(decodeJWT('')).toBeNull()
    })

    it('should return null for non-string token', () => {
      expect(decodeJWT(123)).toBeNull()
      expect(decodeJWT({ token: 'test' })).toBeNull()
      expect(decodeJWT(['token'])).toBeNull()
    })

    it('should handle malformed base64 payload', () => {
      // Invalid base64 in payload section
      const invalidToken = 'header.!!!invalid!!!.signature'
      expect(decodeJWT(invalidToken)).toBeNull()
    })

    it('should handle non-JSON payload', () => {
      const header = btoa('header').replace(/=/g, '')
      const payload = btoa('not json').replace(/=/g, '')
      const token = `${header}.${payload}.sig`
      expect(decodeJWT(token)).toBeNull()
    })
  })

  describe('getTokenExpiry', () => {
    it('should return expiry in milliseconds', () => {
      const expirySeconds = 1712282400
      const token = createToken(expirySeconds)
      const expiry = getTokenExpiry(token)

      expect(expiry).toBe(expirySeconds * 1000)
    })

    it('should return null for invalid token', () => {
      expect(getTokenExpiry('invalid')).toBeNull()
      expect(getTokenExpiry('')).toBeNull()
    })

    it('should return null if exp claim missing', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const payload = btoa(JSON.stringify({ sub: 'user' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const token = `${header}.${payload}.sig`

      expect(getTokenExpiry(token)).toBeNull()
    })

    it('should return null if exp is not a number', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const payload = btoa(JSON.stringify({ exp: 'not-a-number' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const token = `${header}.${payload}.sig`

      expect(getTokenExpiry(token)).toBeNull()
    })
  })

  describe('getTimeUntilExpiry', () => {
    it('should return positive milliseconds for future expiry', () => {
      const futureSeconds = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const token = createToken(futureSeconds)
      const timeLeft = getTimeUntilExpiry(token)

      expect(timeLeft).toBeGreaterThan(0)
      expect(timeLeft).toBeLessThan(3600 * 1000 + 1000) // Allow 1s drift
    })

    it('should return negative milliseconds for past expiry', () => {
      const pastSeconds = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      const token = createToken(pastSeconds)
      const timeLeft = getTimeUntilExpiry(token)

      expect(timeLeft).toBeLessThan(0)
    })

    it('should return null for invalid token', () => {
      expect(getTimeUntilExpiry('invalid')).toBeNull()
      expect(getTimeUntilExpiry('')).toBeNull()
    })
  })

  describe('isTokenValid', () => {
    it('should return true for unexpired token', () => {
      const futureSeconds = Math.floor(Date.now() / 1000) + 3600
      const token = createToken(futureSeconds)

      expect(isTokenValid(token)).toBe(true)
    })

    it('should return false for expired token', () => {
      const pastSeconds = Math.floor(Date.now() / 1000) - 3600
      const token = createToken(pastSeconds)

      expect(isTokenValid(token)).toBe(false)
    })

    it('should return false for invalid token', () => {
      expect(isTokenValid('invalid')).toBe(false)
      expect(isTokenValid('')).toBe(false)
      expect(isTokenValid(null)).toBe(false)
    })

    it('should return false if exp is missing', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const payload = btoa(JSON.stringify({ sub: 'user' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const token = `${header}.${payload}.sig`

      expect(isTokenValid(token)).toBe(false)
    })
  })

  describe('willTokenExpireSoon', () => {
    it('should return true if token expires within 30s (default)', () => {
      const soonSeconds = Math.floor(Date.now() / 1000) + 15 // Expires in 15s
      const token = createToken(soonSeconds)

      expect(willTokenExpireSoon(token)).toBe(true)
    })

    it('should return false if token expires after 30s (default)', () => {
      const laterSeconds = Math.floor(Date.now() / 1000) + 3600 // Expires in 1 hour
      const token = createToken(laterSeconds)

      expect(willTokenExpireSoon(token)).toBe(false)
    })

    it('should return false if token is already expired', () => {
      const pastSeconds = Math.floor(Date.now() / 1000) - 100
      const token = createToken(pastSeconds)

      expect(willTokenExpireSoon(token)).toBe(false)
    })

    it('should support custom time frame', () => {
      const soonSeconds = Math.floor(Date.now() / 1000) + 30 // Expires in 30s
      const token = createToken(soonSeconds)

      expect(willTokenExpireSoon(token, 60000)).toBe(true) // 60s frame
      expect(willTokenExpireSoon(token, 10000)).toBe(false) // 10s frame
    })

    it('should return false for invalid token', () => {
      expect(willTokenExpireSoon('invalid')).toBe(false)
      expect(willTokenExpireSoon('')).toBe(false)
    })
  })

  describe('getTokenUsername', () => {
    it('should extract username from sub claim', () => {
      const token = createToken(null, { sub: 'alice' })
      expect(getTokenUsername(token)).toBe('alice')
    })

    it('should return null if sub is missing', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const payload = btoa(JSON.stringify({ exp: 123456 }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const token = `${header}.${payload}.sig`

      expect(getTokenUsername(token)).toBeNull()
    })

    it('should return null for invalid token', () => {
      expect(getTokenUsername('invalid')).toBeNull()
    })
  })

  describe('getTokenClaims', () => {
    it('should return full payload', () => {
      const token = createToken(null, { role: 'admin', email: 'test@example.com' })
      const claims = getTokenClaims(token)

      expect(claims).not.toBeNull()
      expect(claims.sub).toBe('testuser')
      expect(claims.role).toBe('admin')
      expect(claims.email).toBe('test@example.com')
      expect(typeof claims.exp).toBe('number')
    })

    it('should return null for invalid token', () => {
      expect(getTokenClaims('invalid')).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle base64url padding correctly', () => {
      // JWT uses base64url without padding
      const token = createToken()
      const payload = decodeJWT(token)
      expect(payload).not.toBeNull()
    })

    it('should handle tokens with many claims', () => {
      const token = createToken(null, {
        claim1: 'value1',
        claim2: 'value2',
        claim3: { nested: 'value' },
        claim4: [1, 2, 3],
      })
      const claims = getTokenClaims(token)

      expect(claims.claim1).toBe('value1')
      expect(claims.claim2).toBe('value2')
      expect(claims.claim3.nested).toBe('value')
      expect(claims.claim4).toEqual([1, 2, 3])
    })

    it('should handle tokens expiring exactly now', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const token = createToken(nowSeconds)
      const timeLeft = getTimeUntilExpiry(token)

      // Should be very close to 0 (within ±1500ms to account for test execution overhead)
      expect(Math.abs(timeLeft)).toBeLessThan(1500)
      // But token should be considered expired (0 or negative)
      expect(isTokenValid(token)).toBe(false)
    })
  })
})
