import { createWsClient } from './wsClient'

const DEFAULT_AVATAR = '/avatar_placeholder.jpg'

function getWsBaseUrl() {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}/api/game/ws/game`
}

export function getGameChannelIdForUser(userId) {
  return `user-${userId}`
}

export function buildInviteRoomId(userAId, userBId) {
  const [a, b] = [Number(userAId), Number(userBId)].sort((x, y) => x - y)
  return `invite-${a}-${b}-${Date.now()}`
}

export function createGameChannelClient(channelId, handlers = {}) {
  return createWsClient(`${getWsBaseUrl()}/${channelId}`, handlers)
}

export function sendGameChannelMessage(channelId, payload, { closeDelay = 120 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') {
      reject(new Error('WebSocket is not available in this environment.'))
      return
    }

    const ws = new WebSocket(`${getWsBaseUrl()}/${channelId}`)
    let settled = false
    let closeTimer = null

    const finish = (callback) => {
      if (settled)
        return

      settled = true
      clearTimeout(closeTimer)
      callback()
    }

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify(payload))
        closeTimer = window.setTimeout(() => {
          finish(resolve)
          ws.close()
        }, closeDelay)
      } catch {
        finish(() => reject(new Error('Failed to serialize game invite payload.')))
        ws.close()
      }
    }

    ws.onerror = () => {
      finish(() => reject(new Error('Unable to send the game invite event.')))
      ws.close()
    }

    ws.onclose = () => {
      if (!settled)
        finish(resolve)
    }
  })
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
