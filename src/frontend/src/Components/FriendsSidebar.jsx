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
import { useNotifications } from '../context/notificationContext'
import { apiCall, apiJson } from '../utils/apiClient'
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
  const [searchResults, setSearchResults] = useState({
    results: [],
    total: 0,
    page: 0,
    per_page: 0,
    last_page: 0,
  })
  const [pendingSent, setPendingSent] = useState([])
  const [outgoingInvite, setOutgoingInvite] = useState(null)
  const [incomingInvite, setIncomingInvite] = useState(null)
  const [inviteToast, setInviteToast] = useState(null)
  const [dmOfflineTarget, setDmOfflineTarget] = useState(null) // { friendUsername, slug }
  const navigate = useNavigate()
  const searchTimer = useRef(null)
  const outgoingInviteTimer = useRef(null)
  const toastTimer = useRef(null)
  const outgoingInviteRef = useRef(null)
  const lastProcessedNotifId = useRef(null)
  const presenceMap = usePresence()
  const { unreadCounts, clearUnread } = useUnread()
  const { notifications, setInviteVisible, markRead } = useNotifications()

  const { auth } = useAuth()
  const selfId = currentUser?.id ?? userId
  const selfUsername = currentUser?.username ?? username ?? 'Player'
  const selfAvatarUrl = currentUser?.avatarUrl || currentUser?.avatar_url || DEFAULT_AVATAR

  useEffect(() => {
    outgoingInviteRef.current = outgoingInvite
  }, [outgoingInvite])

  useEffect(() => {
    setInviteVisible(!!incomingInvite)
    return () => setInviteVisible(false)
  }, [incomingInvite, setInviteVisible])

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

  const fetchFriendsData = useCallback(async (signal) => {
    if (!selfId) return
    try {
      const [f, r, s] = await Promise.all([
        apiCall('/api/users/friends/me', { signal }).then(res => res.json()),
        apiCall('/api/users/friends/me/requests', { signal }).then(res => res.json()),
        apiCall('/api/users/friends/me/sent', { signal }).then(res => res.json()),
      ])
      setFriends(Array.isArray(f) ? f : [])
      setRequests(Array.isArray(r) ? r : [])
      setPendingSent(Array.isArray(s) ? s.map(req => ({ id: req.addressee_id, username: req.addressee_username })) : [])
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Failed to fetch friends data:', err)
    }
  }, [selfId])

  useEffect(() => {
    const controller = new AbortController()
    fetchFriendsData(controller.signal)
    return () => {
      controller.abort()
      clearTimeout(searchTimer.current)
    }
  }, [fetchFriendsData])

  // Watch for friend-related notifications to refresh lists
  useEffect(() => {
    if (!notifications.length) return

    // Find the newest "real" (non-DM) notification of interest
    const latestRelevant = notifications.find(n =>
      n.type === 'friend_request' || n.type === 'friend_request_accepted'
    )

    if (latestRelevant && latestRelevant.id !== lastProcessedNotifId.current) {
      lastProcessedNotifId.current = latestRelevant.id
      fetchFriendsData()
    }
  }, [notifications, fetchFriendsData])

  // Watch for game invite responses (accept/decline notifications from recipients)
  useEffect(() => {
    if (!notifications.length || !outgoingInviteRef.current) return

    const activeInvite = outgoingInviteRef.current

    // Find game_invite_response notification that matches the active invite
    // Filter by from_user_id to ensure it's from the recipient of our invite
    const response = notifications.find(n =>
      n.type === 'game_invite_response' &&
      !n.read &&
      n.from_user_id === activeInvite.friendId  // Ensure it's from the right person
    )

    if (response) {
      // Check if this response is about our active invite
      if (response.message.includes('accepted')) {
        resetOutgoingInvite()
        // Mark response as read so it doesn't trigger GameInviteModal later
        markRead(response.id)
        showInviteToast(`${activeInvite.friendUsername} accepted your invite.`, 'success', 2200)
        navigateToWaitingRoom(activeInvite.roomId, {
          id: activeInvite.friendId,
          username: activeInvite.friendUsername,
          avatarUrl: activeInvite.friendAvatarUrl,
        })
        return
      }
      if (response.message.includes('declined')) {
        resetOutgoingInvite()
        // Mark response as read so it doesn't trigger GameInviteModal later
        markRead(response.id)
        showInviteToast(`${activeInvite.friendUsername} declined the match invite.`, 'warning')
        return
      }
    }
  }, [notifications, showInviteToast, resetOutgoingInvite, navigateToWaitingRoom, markRead])

  useEffect(() => () => {
    clearOutgoingInviteTimer()
    clearTimeout(toastTimer.current)
  }, [clearOutgoingInviteTimer])

  useEffect(() => {
    if (!selfId || typeof window === 'undefined' || typeof window.WebSocket === 'undefined')
      return undefined

    const inviteClient = createGameChannelClient(getGameChannelIdForUser(selfId), auth.access_token, {
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
      setSearchResults({
        results: [],
        total: 0,
        page: 0,
        per_page: 0,
        last_page: 0,
      })
      return
    }
    searchTimer.current = setTimeout(() => {
      apiCall(`/api/users/search?q=${encodeURIComponent(q)}`)
        .then(r => { return r.json() })
        .then(pagedSearchResults => { setSearchResults(pagedSearchResults) })
        .catch(console.error)
    }, 300)
  }

  const handleAddFriend = async (friendId) => {
    try {
      const res = await apiCall(`/api/users/friends/request/${friendId}`, { method: 'POST' })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        showInviteToast(errorData.detail || 'Could not send friend request.', 'danger')
        return
      }
      const user = searchResults.results.find(u => u.id === friendId)
      setSearchResults(prev => {
        return {
          ...prev,
          results: prev.results.filter(u => u.id !== friendId),
        }
      })

      // Refresh sent requests to ensure UI stays in sync with server state
      await fetchFriendsData()
      showInviteToast('Friend request sent!', 'success', 3000)
    } catch (error) {
      console.error('Failed to add friend:', error)
      showInviteToast('Network error while adding friend.', 'danger')
    }
  }

  const handleAccept = async (req) => {
    try {
      await apiJson(`/api/users/friends/requests/${req.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'accept' }),
      })
      setRequests(prev => prev.filter(r => r.id !== req.id))
      const newFriend = await apiJson(`/api/users/profile/${req.requester_id}`)
      setFriends(prev => [...prev, newFriend])
      showInviteToast('Friend request accepted!', 'success', 3000)
    } catch (error) {
      console.error('Failed to accept request:', error)
      showInviteToast(error.message || 'Could not accept request.', 'danger')
    }
  }

  const handleDecline = async (req) => {
    try {
      const res = await apiCall(`/api/users/friends/requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        showInviteToast(errorData.detail || 'Could not decline request.', 'danger')
        return
      }
      setRequests(prev => prev.filter(r => r.id !== req.id))
      showInviteToast('Friend request declined.', 'info', 3000)
    } catch (error) {
      console.error('Failed to decline request:', error)
      showInviteToast('Network error while declining request.', 'danger')
    }
  }

  const handleRemoveFriend = async (friendId) => {
    try {
      const res = await apiCall(`/api/users/friends/${friendId}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        showInviteToast(errorData.detail || 'Could not remove friend.', 'danger')
        return
      }
      setFriends(prev => prev.filter(f => f.id !== friendId))
      showInviteToast('Friend removed.', 'info', 3000)
    } catch (error) {
      console.error('Failed to remove friend:', error)
      showInviteToast('Network error while removing friend.', 'danger')
    }
  }

  const handleChat = async (friendId, friendUsername) => {
    const slug = dmSlug(selfId, friendId)
    let friendIsInRoom = true
    try {
      const res = await apiCall(`/api/chat/room/${slug}/active`)
      if (res.ok) {
        const data = await res.json()
        friendIsInRoom = data.active_connections > 0
      }
      // non-ok response (e.g. 401/500) → navigate anyway (fail-open, same as network error)
    } catch {
      // network error — navigate anyway
    }
    if (!friendIsInRoom) {
      setDmOfflineTarget({ friendUsername, slug })
      return
    }
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
      // Create notification for the inviter so they see accept in GameInviteModal
      // (The backend will handle WebSocket broadcasting via the dedicated endpoint)
      console.debug('[FriendsSidebar] Sending accept with room_id:', { senderId, roomId })
      const res = await apiCall('/api/users/game-invite/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_user_id: senderId,
          status: 'accepted',
          room_id: roomId,  // Include room_id so inviter can navigate
        }),
      })

      // Check if backend accepted the response
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('[FriendsSidebar] Accept API error:', { status: res.status, error: errorData })
        showInviteToast('Failed to accept invite. Please try again.', 'danger')
        return
      }

      console.debug('[FriendsSidebar] Accept response sent successfully')
      setIncomingInvite(null)
      navigateToWaitingRoom(roomId, {
        id: senderId,
        username: senderUsername,
        avatarUrl: senderAvatarUrl,
      })
    } catch (error) {
      console.error('[FriendsSidebar] Error accepting invite:', error)
      showInviteToast('Could not accept the invite right now. Please try again.', 'danger')
    }
  }

  const handleIncomingInviteDecline = async () => {
    if (!incomingInvite)
      return
    const senderId = incomingInvite.fromUserId
    const roomId = incomingInvite.roomId
    try {
      // Create notification for the inviter so they see decline in GameInviteModal
      // (The backend will handle WebSocket broadcasting via the dedicated endpoint)
      const res = await apiCall('/api/users/game-invite/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_user_id: senderId,
          status: 'declined',
        }),
      })

      // Check if backend accepted the response
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('[FriendsSidebar] Decline API error:', { status: res.status, error: errorData })
        showInviteToast('Failed to decline invite. Please try again.', 'danger')
        return
      }

      // Only clear state if response was successful
      setIncomingInvite(null)
      showInviteToast('Invite declined.', 'warning')
    } catch (error) {
      console.error('[FriendsSidebar] Error declining invite:', error)
      showInviteToast('Network error while declining invite. Please try again.', 'danger')
    }
  }

  const excludedIds = new Set([
    selfId,
    ...friends.map(f => f.id),
    ...requests.map(r => r.requester_id),
    ...pendingSent.map(p => p.id),
  ])
  const visibleResults = searchResults.results.filter(u => !excludedIds.has(u.id))
  return (
    <>
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
                        onClick={() => handleChat(friend.id, friend.username)}
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

      {dmOfflineTarget && (
        <div
          className="dm-offline-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Friend not in chat"
          tabIndex={-1}
          onClick={() => setDmOfflineTarget(null)}
          onKeyDown={(e) => e.key === 'Escape' && setDmOfflineTarget(null)}
        >
          <div className="dm-offline-dialog" onClick={(e) => e.stopPropagation()}>
            <p>
              Nobody is currently connected to this DM room.{' '}
              <strong>{dmOfflineTarget.friendUsername}</strong> may not see your message right away.
            </p>
            <div className="dm-offline-actions">
              <button
                type="button"
                className="arcade-btn arcade-btn-primary"
                autoFocus
                onClick={() => {
                  const { slug } = dmOfflineTarget
                  setDmOfflineTarget(null)
                  clearUnread(slug)
                  navigate(`/chat/${slug}`, { state: { username: selfUsername, userId: selfId } })
                }}
              >
                Open Chat
              </button>
              <button
                type="button"
                className="arcade-btn arcade-btn-secondary"
                onClick={() => setDmOfflineTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
