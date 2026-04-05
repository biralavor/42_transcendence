/**
 * JWT Utility Functions
 * Decodes JWT tokens (without verification) and calculates expiry times.
 * Used for proactive token refresh before expiry.
 */

/**
 * Decode a JWT token's payload without verification.
 * Safe to use only for reading claims, not for security purposes.
 *
 * @param {string} token - JWT token (format: header.payload.signature)
 * @returns {object|null} Decoded payload object, or null if invalid
 *
 * @example
 * const decoded = decodeJWT('eyJhbGc...')
 * console.log(decoded.sub) // 'username'
 * console.log(decoded.exp) // 1712282400
 */
export function decodeJWT(token) {
  if (!token || typeof token !== 'string') {
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    console.warn('[jwtUtils] Invalid JWT format: expected 3 parts, got', parts.length)
    return null
  }

  try {
    // Decode base64url payload (part[1])
    // Base64url uses - instead of +, _ instead of /, and omits padding
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    
    // Add base64 padding if needed (must be multiple of 4)
    const padding = 4 - (base64.length % 4)
    if (padding !== 4) {
      base64 += '='.repeat(padding)
    }
    
    const jsonStr = atob(base64) // Decode base64 to string
    const payload = JSON.parse(jsonStr)
    return payload
  } catch (err) {
    console.warn('[jwtUtils] Failed to decode JWT:', err.message)
    return null
  }
}

/**
 * Get the expiration timestamp (in milliseconds) of a JWT token.
 *
 * @param {string} token - JWT token
 * @returns {number|null} Expiration timestamp in milliseconds since epoch, or null if invalid
 *
 * @example
 * const expiry = getTokenExpiry(token)
 * if (expiry && expiry < Date.now()) {
 *   console.log('Token has expired')
 * }
 */
export function getTokenExpiry(token) {
  const payload = decodeJWT(token)
  if (!payload || typeof payload.exp !== 'number') {
    return null
  }

  // JWT exp is in seconds, convert to milliseconds
  return payload.exp * 1000
}

/**
 * Calculate milliseconds until a JWT token expires.
 * Negative value means token has already expired.
 *
 * @param {string} token - JWT token
 * @returns {number|null} Milliseconds until expiry (can be negative), or null if invalid token
 *
 * @example
 * const timeLeft = getTimeUntilExpiry(token)
 * if (timeLeft && timeLeft > 0) {
 *   console.log(`Token expires in ${Math.ceil(timeLeft / 1000)} seconds`)
 * } else if (timeLeft && timeLeft < 0) {
 *   console.log('Token has expired')
 * }
 */
export function getTimeUntilExpiry(token) {
  const expiry = getTokenExpiry(token)
  if (expiry === null) {
    return null
  }

  return expiry - Date.now()
}

/**
 * Check if a JWT token is currently valid (not expired).
 *
 * @param {string} token - JWT token
 * @returns {boolean} True if token exists and has not expired
 *
 * @example
 * if (isTokenValid(token)) {
 *   console.log('Token is still valid')
 * }
 */
export function isTokenValid(token) {
  const timeLeft = getTimeUntilExpiry(token)
  return timeLeft !== null && timeLeft > 0
}

/**
 * Check if a JWT token will expire within a given time frame.
 * Useful for checking if proactive refresh is needed.
 *
 * @param {string} token - JWT token
 * @param {number} milliseconds - Time frame in milliseconds
 * @returns {boolean} True if token expires within the given time frame
 *
 * @example
 * if (willTokenExpireSoon(token, 60000)) {
 *   console.log('Token expires within 1 minute')
 * }
 */
export function willTokenExpireSoon(token, milliseconds = 30000) {
  const timeLeft = getTimeUntilExpiry(token)
  return timeLeft !== null && timeLeft > 0 && timeLeft <= milliseconds
}

/**
 * Extract username from JWT token's 'sub' (subject) claim.
 *
 * @param {string} token - JWT token
 * @returns {string|null} Username, or null if not found
 *
 * @example
 * const username = getTokenUsername(token)
 * console.log(`Logged in as: ${username}`)
 */
export function getTokenUsername(token) {
  const payload = decodeJWT(token)
  return payload?.sub ?? null
}

/**
 * Get all claims from a JWT token.
 * Useful for debugging or extracting specific information.
 *
 * @param {string} token - JWT token
 * @returns {object|null} Full payload object, or null if invalid
 */
export function getTokenClaims(token) {
  return decodeJWT(token)
}
