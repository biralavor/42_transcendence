import { createWsClient } from './wsClient'
import { apiCall } from './apiClient'

const DEFAULT_AVATAR = '/avatar_placeholder.jpg'

function getWsBaseUrl() {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}/api/users/ws/notifications`
}

export function getGameChannelIdForUser(userId) {
  return userId
}

export function buildInviteRoomId(userAId, userBId) {
  const [a, b] = [Number(userAId), Number(userBId)].sort((x, y) => x - y)
  return `invite-${a}-${b}-${Date.now()}`
}

export function createGameChannelClient(channelId, token, handlers = {}) {
  let url = `${getWsBaseUrl()}/${channelId}`
  if (token) url += `?token=${token}`
  return createWsClient(url, handlers)
}

export async function sendGameChannelMessage(_channelId, payload, options = {}) {
  const resp = await apiCall('/api/users/game-invites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    ...options,
  })
  if (!resp.ok)
    throw new Error('Unable to send the game invite event.')
}

export function normalizeInviteUser(user) {
  return {
    id: user?.id ?? null,
    username: user?.username ?? 'Player',
    avatarUrl: user?.avatarUrl || user?.avatar_url || DEFAULT_AVATAR,
  }
}

export function isInviteExpired(expiresAt) {
  return typeof expiresAt === 'number' && Date.now() > expiresAt
}
