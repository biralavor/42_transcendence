import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getGameChannelIdForUser,
  buildInviteRoomId,
  createGameChannelClient,
  sendGameChannelMessage,
  normalizeInviteUser,
  isInviteExpired,
} from './gameInviteChannel.js'

// ── createWsClient mock ────────────────────────────────────────────────────────
vi.mock('./wsClient', () => ({
  createWsClient: vi.fn(),
}))
import { createWsClient } from './wsClient'

// ── apiCall mock ───────────────────────────────────────────────────────────────
vi.mock('./apiClient', () => ({
  apiCall: vi.fn(),
}))
import { apiCall } from './apiClient'

// ── helpers ───────────────────────────────────────────────────────────────────

function stubLocation(protocol, host) {
  vi.stubGlobal('window', {
    ...window,
    location: { protocol, host },
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  stubLocation('https:', 'example.com')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── createGameChannelClient — WS URL construction ────────────────────────────

describe('createGameChannelClient', () => {
  it('builds a wss:// URL under /api/users/ws/notifications/{userId}', () => {
    stubLocation('https:', 'example.com')
    createGameChannelClient(42, 'tok123')
    expect(createWsClient).toHaveBeenCalledWith(
      'wss://example.com/api/users/ws/notifications/42?token=tok123',
      {},
    )
  })

  it('builds a ws:// URL when protocol is http:', () => {
    stubLocation('http:', 'localhost:3000')
    createGameChannelClient(7, 'abc')
    expect(createWsClient).toHaveBeenCalledWith(
      'ws://localhost:3000/api/users/ws/notifications/7?token=abc',
      {},
    )
  })

  it('omits the token query param when token is falsy', () => {
    createGameChannelClient(5, '')
    const [url] = createWsClient.mock.calls[0]
    expect(url).toBe('wss://example.com/api/users/ws/notifications/5')
    expect(url).not.toContain('?token')
  })

  it('forwards the handlers object to createWsClient', () => {
    const handlers = { onMessage: vi.fn() }
    createGameChannelClient(1, 'tok', handlers)
    expect(createWsClient).toHaveBeenCalledWith(expect.any(String), handlers)
  })
})

// ── getGameChannelIdForUser ───────────────────────────────────────────────────

describe('getGameChannelIdForUser', () => {
  it('returns the userId as-is', () => {
    expect(getGameChannelIdForUser(99)).toBe(99)
    expect(getGameChannelIdForUser('42')).toBe('42')
  })
})

// ── sendGameChannelMessage — apiCall POST ─────────────────────────────────────

describe('sendGameChannelMessage', () => {
  beforeEach(() => {
    apiCall.mockClear()
  })

  it('calls apiCall with POST to /api/users/game-invites', async () => {
    apiCall.mockResolvedValue({ ok: true })
    const payload = { type: 'game_invite', to_user_id: 2 }
    await sendGameChannelMessage('ignored', payload)
    expect(apiCall).toHaveBeenCalledWith('/api/users/game-invites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  })

  it('throws when the server returns a non-OK status', async () => {
    apiCall.mockResolvedValue({ ok: false, status: 403 })
    await expect(
      sendGameChannelMessage('ignored', {}),
    ).rejects.toThrow('Unable to send the game invite event.')
  })

  it('ignores the _channelId param and applies options (kept for call-site compat)', async () => {
    apiCall.mockResolvedValue({ ok: true })
    await expect(
      sendGameChannelMessage('any-channel', { type: 'game_invite' }, { closeDelay: 999 }),
    ).resolves.toBeUndefined()
  })
})

// ── buildInviteRoomId ─────────────────────────────────────────────────────────

describe('buildInviteRoomId', () => {
  it('produces invite-{min}-{max}-{timestamp} format', () => {
    const room = buildInviteRoomId(5, 2)
    expect(room).toMatch(/^invite-2-5-\d+$/)
  })

  it('is symmetric — same two users always produce the same ordered prefix', () => {
    const a = buildInviteRoomId(3, 10).replace(/-\d+$/, '')
    const b = buildInviteRoomId(10, 3).replace(/-\d+$/, '')
    expect(a).toBe(b)
  })
})

// ── normalizeInviteUser ───────────────────────────────────────────────────────

describe('normalizeInviteUser', () => {
  it('returns defaults for null input', () => {
    expect(normalizeInviteUser(null)).toEqual({
      id: null,
      username: 'Player',
      avatarUrl: '/avatar_placeholder.jpg',
    })
  })

  it('prefers avatarUrl over avatar_url', () => {
    const user = { id: 1, username: 'bob', avatarUrl: '/a.png', avatar_url: '/b.png' }
    expect(normalizeInviteUser(user).avatarUrl).toBe('/a.png')
  })

  it('falls back to avatar_url when avatarUrl is absent', () => {
    const user = { id: 1, username: 'bob', avatar_url: '/b.png' }
    expect(normalizeInviteUser(user).avatarUrl).toBe('/b.png')
  })
})

// ── isInviteExpired ───────────────────────────────────────────────────────────

describe('isInviteExpired', () => {
  it('returns true for a timestamp in the past', () => {
    expect(isInviteExpired(Date.now() - 1000)).toBe(true)
  })

  it('returns false for a timestamp in the future', () => {
    expect(isInviteExpired(Date.now() + 60_000)).toBe(false)
  })

  it('returns false for non-numeric input', () => {
    expect(isInviteExpired(null)).toBe(false)
    expect(isInviteExpired('expired')).toBe(false)
  })
})
