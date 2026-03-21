const AUTH_KEYS = ['access_token', 'refresh_token', 'token_type']

function readStorage(storage) {
  const accessToken = storage.getItem('access_token')
  const refreshToken = storage.getItem('refresh_token')
  const tokenType = storage.getItem('token_type')

  if (!accessToken || !refreshToken || !tokenType)
    return null

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
  }
}

export function getStoredAuth() {
  const sessionAuth = readStorage(window.sessionStorage)
  if (sessionAuth)
    return { ...sessionAuth, storageType: 'session' }

  const localAuth = readStorage(window.localStorage)
  if (localAuth)
    return { ...localAuth, storageType: 'local' }

  return null
}

export function saveAuth(authData, rememberMe) {
  const activeStorage = rememberMe ? window.localStorage : window.sessionStorage
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage

  activeStorage.setItem('access_token', authData.access_token)
  activeStorage.setItem('refresh_token', authData.refresh_token)
  activeStorage.setItem('token_type', authData.token_type)

  AUTH_KEYS.forEach((key) => otherStorage.removeItem(key))
}

export function clearAuth() {
  AUTH_KEYS.forEach((key) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  })
}