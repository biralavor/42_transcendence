import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  buildInviteRoomId,
  createGameChannelClient,
  getGameChannelIdForUser,
  isInviteExpired,
  sendGameChannelMessage,
} from '../utils/gameInviteChannel'
import { usePresence } from '../context/presenceContext'
import { useAuth } from '../context/authContext'
import { useUnread } from '../context/unreadContext'
import './FriendsSidebar.css'

const INVITE_TIMEOUT_MS = 60_000
const DEFAULT_AVATAR = '/avatar_placeholder.jpg'

function dmSlug(a, b) {
  const [lo, hi] = [Number(a), Number(b)].sort((x, y) => x - y)
  return `DM-${lo}-${hi}`
}

function mapIncomingInvite(data) {
  return {
    roomId: data.room_id,
    fromUserId: data.from_user_id,
    fromUsername: data.from_username ?? 'Player',
    fromAvatarUrl: data.from_avatar_url ?? DEFAULT_AVATAR,
    expiresAt: Number(data.expires_at) || Date.now() + INVITE_TIMEOUT_MS,
  }
}

export default function FriendsSidebar({ userId, username, currentUser, onViewProfile }) {
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [pendingSent, setPendingSent] = useState([])
  const [outgoingInvite, setOutgoingInvite] = useState(null)
  const [incomingInvite, setIncomingInvite] = useState(null)
  const [inviteToast, setInviteToast] = useState(null)
  const navigate = useNavigate()
  const searchTimer = useRef(null)
  const outgoingInviteTimer = useRef(null)
  const toastTimer = useRef(null)
  const outgoingInviteRef = useRef(null)
  const presenceMap = usePresence()
  const { unreadCounts, clearUnread } = useUnread()

  const { auth } = useAuth()
  const selfId = currentUser?.id ?? userId
  const selfUsername = currentUser?.username ?? username ?? 'Player'
  const selfAvatarUrl = currentUser?.avatarUrl || currentUser?.avatar_url || DEFAULT_AVATAR

  useEffect(() => {
    outgoingInviteRef.current = outgoingInvite
  }, [outgoingInvite])

  const showInviteToast = useCallback((message, tone = 'info', duration = 4200) => {
    clearTimeout(toastTimer.current)
    setInviteToast({ message, tone })
    if (duration > 0)
      toastTimer.current = setTimeout(() => setInviteToast(null), duration)
  }, [])

  const clearOutgoingInviteTimer = useCallback(() => {
    clearTimeout(outgoingInviteTimer.current)
  }, [])

  const resetOutgoingInvite = useCallback(() => {
    clearOutgoingInviteTimer()
    setOutgoingInvite(null)
  }, [clearOutgoingInviteTimer])

  const navigateToWaitingRoom = useCallback((roomId, opponent) => {
    navigate(`/game/waiting/${roomId}`, {
      state: {
        currentUser: {
          id: selfId,
          username: selfUsername,
          avatarUrl: selfAvatarUrl,
        },
        opponent: {
          id: opponent.id,
          username: opponent.username,
          avatarUrl: opponent.avatarUrl || opponent.avatar_url || DEFAULT_AVATAR,
        },
        friendId: opponent.id,
        friendUsername: opponent.username,
      },
    })
  }, [navigate, selfId, selfUsername, selfAvatarUrl])

  const sendInviteEvent = useCallback(async (targetUserId, payload) => {
    await sendGameChannelMessage(getGameChannelIdForUser(targetUserId), payload)
  }, [])

  useEffect(() => {
    if (!selfId)
      return undefined

    const controller = new AbortController()

    Promise.all([
      fetch(`/api/users/friends/${selfId}`, { signal: controller.signal }).then(r => r.json()),
      fetch(`/api/users/friends/${selfId}/requests`, { signal: controller.signal }).then(r => r.json()),
      fetch(`/api/users/friends/${selfId}/sent`, { signal: controller.signal }).then(r => r.json()),
    ]).then(([f, r, s]) => {
      setFriends(f)
      setRequests(r)
      setPendingSent(s.map(req => ({ id: req.addressee_id, username: req.addressee_username })))
    }).catch(err => { if (err.name !== 'AbortError') console.error(err) })

    return () => {
      controller.abort()
      clearTimeout(searchTimer.current)
    }
  }, [selfId])

  useEffect(() => () => {
    clearOutgoingInviteTimer()
    clearTimeout(toastTimer.current)
  }, [clearOutgoingInviteTimer])

  useEffect(() => {
    if (!selfId || typeof window === 'undefined' || typeof window.WebSocket === 'undefined')
      return undefined

    const inviteClient = createGameChannelClient(getGameChannelIdForUser(selfId), {
      onMessage: (data) => {
        if (!data || typeof data !== 'object')
          return

        if (data.type === 'game_invite') {
          const invite = mapIncomingInvite(data)
          if (isInviteExpired(invite.expiresAt))
            return
          setIncomingInvite(invite)
          showInviteToast(`${invite.fromUsername} invited you to a match.`, 'info')
          return
        }

        if (data.type === 'game_invite_response') {
          const activeInvite = outgoingInviteRef.current
          if (!activeInvite || data.room_id !== activeInvite.roomId)
            return
          resetOutgoingInvite()
          if (data.status === 'accepted') {
            showInviteToast(`${activeInvite.friendUsername} accepted your invite.`, 'success', 2200)
            navigateToWaitingRoom(activeInvite.roomId, {
              id: activeInvite.friendId,
              username: activeInvite.friendUsername,
              avatarUrl: data.from_avatar_url ?? activeInvite.friendAvatarUrl,
            })
            return
          }
          if (data.status === 'declined') {
            showInviteToast(`${activeInvite.friendUsername} declined the match invite.`, 'warning')
            return
          }
          if (data.status === 'timeout')
            showInviteToast(`The invite to ${activeInvite.friendUsername} expired.`, 'warning')
        }

        if (data.type === 'game_invite_timeout') {
          setIncomingInvite((prev) => {
            if (!prev || prev.roomId !== data.room_id)
              return prev
            showInviteToast('That invite expired before it was accepted.', 'warning')
            return null
          })
        }
      },
    })

    return () => inviteClient.close()
  }, [selfId, showInviteToast, resetOutgoingInvite, navigateToWaitingRoom])

  const handleSearchChange = (e) => {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(setSearchResults)
        .catch(console.error)
    }, 300)
  }

  const handleAddFriend = async (friendId) => {
    const res = await fetch(`/api/users/friends/${selfId}/request/${friendId}`, { method: 'POST' })
    if (!res.ok) return
    const user = searchResults.find(u => u.id === friendId)
    setSearchResults(prev => prev.filter(u => u.id !== friendId))
    if (user) setPendingSent(prev => [...prev, user])
  }

  const handleAccept = async (req) => {
    const res = await fetch(`/api/users/friends/${selfId}/requests/${req.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`,
      },
      body: JSON.stringify({ action: 'accept' }),
    })
    if (!res.ok) return
    setRequests(prev => prev.filter(r => r.id !== req.id))
    const profileRes = await fetch(`/api/users/profile/${req.requester_id}`)
    if (profileRes.ok) {
      const newFriend = await profileRes.json()
      setFriends(prev => [...prev, newFriend])
    }
  }

  const handleDecline = async (req) => {
    const res = await fetch(`/api/users/friends/${selfId}/requests/${req.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`,
      },
      body: JSON.stringify({ action: 'decline' }),
    })
    if (!res.ok) return
    setRequests(prev => prev.filter(r => r.id !== req.id))
  }

  const handleRemoveFriend = async (friendId) => {
    const res = await fetch(`/api/users/friends/${selfId}/${friendId}`, { method: 'DELETE' })
    if (!res.ok) return
    setFriends(prev => prev.filter(f => f.id !== friendId))
  }

  const handleChat = (friendId) => {
    const slug = dmSlug(selfId, friendId)
    clearUnread(slug)
    navigate(`/chat/${slug}`, { state: { username: selfUsername, userId: selfId } })
  }

  const handleInviteToGame = async (friend) => {
    if (!selfId || !selfUsername || outgoingInviteRef.current)
      return

    const roomId = buildInviteRoomId(selfId, friend.id)
    const expiresAt = Date.now() + INVITE_TIMEOUT_MS
    const pendingInvite = {
      roomId,
      friendId: friend.id,
      friendUsername: friend.username,
      friendAvatarUrl: friend.avatar_url ?? friend.avatarUrl ?? DEFAULT_AVATAR,
      expiresAt,
    }

    setOutgoingInvite(pendingInvite)
    showInviteToast(`Waiting for ${friend.username} to respond...`, 'info')

    outgoingInviteTimer.current = setTimeout(async () => {
      setOutgoingInvite((prev) => {
        if (!prev || prev.roomId !== roomId)
          return prev
        return null
      })
      showInviteToast(`${friend.username} did not answer the match invite in time.`, 'warning')
      try {
        await sendInviteEvent(friend.id, {
          type: 'game_invite_timeout',
          room_id: roomId,
          from_user_id: selfId,
          to_user_id: friend.id,
        })
      } catch (error) {
        console.error(error)
      }
    }, INVITE_TIMEOUT_MS)

    try {
      await sendInviteEvent(friend.id, {
        type: 'game_invite',
        room_id: roomId,
        from_user_id: selfId,
        from_username: selfUsername,
        from_avatar_url: selfAvatarUrl,
        to_user_id: friend.id,
        to_username: friend.username,
        expires_at: expiresAt,
      })
    } catch (error) {
      console.error(error)
      resetOutgoingInvite()
      showInviteToast('Could not send the match invite. Check the connection and try again.', 'danger')
    }
  }

  const handleIncomingInviteAccept = async () => {
    if (!incomingInvite)
      return
    if (isInviteExpired(incomingInvite.expiresAt)) {
      setIncomingInvite(null)
      showInviteToast('That invite already expired.', 'warning')
      return
    }
    const senderId = incomingInvite.fromUserId
    const senderUsername = incomingInvite.fromUsername
    const senderAvatarUrl = incomingInvite.fromAvatarUrl
    const roomId = incomingInvite.roomId
    try {
      await sendInviteEvent(senderId, {
        type: 'game_invite_response',
        status: 'accepted',
        room_id: roomId,
        from_user_id: selfId,
        from_username: selfUsername,
        from_avatar_url: selfAvatarUrl,
        to_user_id: senderId,
      })
      setIncomingInvite(null)
      navigateToWaitingRoom(roomId, {
        id: senderId,
        username: senderUsername,
        avatarUrl: senderAvatarUrl,
      })
    } catch (error) {
      console.error(error)
      showInviteToast('Could not accept the invite right now. Please try again.', 'danger')
    }
  }

  const handleIncomingInviteDecline = async () => {
    if (!incomingInvite)
      return
    const senderId = incomingInvite.fromUserId
    const roomId = incomingInvite.roomId
    try {
      await sendInviteEvent(senderId, {
        type: 'game_invite_response',
        status: 'declined',
        room_id: roomId,
        from_user_id: selfId,
        from_username: selfUsername,
        from_avatar_url: selfAvatarUrl,
        to_user_id: senderId,
      })
    } catch (error) {
      console.error(error)
    }
    setIncomingInvite(null)
    showInviteToast('Invite declined.', 'warning')
  }

  const excludedIds = new Set([
    selfId,
    ...friends.map(f => f.id),
    ...requests.map(r => r.requester_id),
    ...pendingSent.map(p => p.id),
  ])
  const visibleResults = searchResults.filter(u => !excludedIds.has(u.id))

  return (
    <aside className="friends-sidebar arcade-screen">
      <h2 className="friends-sidebar-title">Friends sidebar</h2>

      {inviteToast && (
        <div className={`friends-sidebar-alert friends-sidebar-alert-${inviteToast.tone}`} role="status">
          {inviteToast.message}
        </div>
      )}

      {incomingInvite && (
        <div className="friends-invite-banner" role="alert">
          <div className="friends-invite-banner-copy">
            <span className="friends-invite-banner-label">Match invite</span>
            <strong>{incomingInvite.fromUsername}</strong> wants to play right now.
          </div>
          <div className="friends-invite-banner-actions">
            <button
              type="button"
              className="arcade-btn arcade-btn-primary friends-btn"
              onClick={handleIncomingInviteAccept}
            >
              Accept
            </button>
            <button
              type="button"
              className="arcade-btn arcade-btn-secondary friends-btn"
              onClick={handleIncomingInviteDecline}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      <div className="friends-search">
        <input
          className="form-control arcade-input friends-search-input"
          type="text"
          placeholder="Search players…"
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      {searchQuery.length >= 2 && (
        <div className="friends-section">
          <h3 className="friends-section-title">Results</h3>
          {visibleResults.length === 0 ? (
            <p className="friends-empty">No players found.</p>
          ) : (
            <ul className="friends-list">
              {visibleResults.map(user => (
                <li key={user.id} className="friends-list-item">
                  <span className="friends-username">{user.username}</span>
                  <button
                    className="arcade-btn arcade-btn-secondary friends-btn"
                    onClick={() => handleAddFriend(user.id)}
                  >
                    Add Friend
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="friends-section">
          <h3 className="friends-section-title">Pending</h3>
          <ul className="friends-list">
            {pendingSent.map(user => (
              <li key={user.id} className="friends-list-item">
                <span className="friends-username">{user.username}</span>
                <span className="friends-pending-badge">Pending</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.length > 0 && (
        <div className="friends-section">
          <h3 className="friends-section-title">Requests</h3>
          <ul className="friends-list">
            {requests.map(req => (
              <li key={req.id} className="friends-list-item friends-request-item">
                <span className="friends-username">{req.requester_username ?? `Player #${req.requester_id}`}</span>
                <div className="friends-request-actions">
                  <button
                    className="arcade-btn arcade-btn-primary friends-btn"
                    onClick={() => handleAccept(req)}
                  >
                    ✓
                  </button>
                  <button
                    className="arcade-btn friends-btn friends-btn-decline"
                    onClick={() => handleDecline(req)}
                  >
                    ✗
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="friends-section">
        <h3 className="friends-section-title">Friends</h3>
        {friends.length === 0 ? (
          <p className="friends-empty">No friends yet.</p>
        ) : (
          <ul className="friends-list">
            {friends.map(friend => {
              const waitingThisFriend = outgoingInvite?.friendId === friend.id
              const inviteDisabled = Boolean(outgoingInvite)
              const onlineStatus = presenceMap[friend.id] ?? friend.status

              return (
                <li key={friend.id} className="friends-list-item friends-friend-item">
                  <div className="friends-user-info">
                    <img
                      src={friend.avatar_url || DEFAULT_AVATAR}
                      alt={friend.username}
                      className={`friends-avatar friends-avatar-${onlineStatus}`}
                    />
                    <span className={`friends-status-dot friends-status-${onlineStatus}`} />
                    {onViewProfile ? (
                      <button
                        className="friends-username friends-username-btn"
                        onClick={() => onViewProfile(friend.username, friend.id)}
                      >
                        {friend.username}
                      </button>
                    ) : (
                      <span className="friends-username">{friend.username}</span>
                    )}
                    {(() => {
                      const slug = dmSlug(selfId, friend.id)
                      const count = unreadCounts[slug] ?? 0
                      return count > 0 ? (
                        <span className="friends-unread-badge">{count}</span>
                      ) : null
                    })()}
                  </div>
                  <div className="friends-actions friends-actions-stack">
                    <button
                      className="arcade-btn arcade-btn-primary friends-btn"
                      onClick={() => handleChat(friend.id)}
                    >
                      Chat
                    </button>
                    <button
                      className="arcade-btn arcade-btn-secondary friends-btn"
                      onClick={() => handleInviteToGame(friend)}
                      disabled={inviteDisabled}
                    >
                      {waitingThisFriend ? 'Waiting...' : 'Invite'}
                    </button>
                    <button
                      className="arcade-btn friends-btn friends-btn-decline"
                      onClick={() => handleRemoveFriend(friend.id)}
                    >
                      ✗
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
