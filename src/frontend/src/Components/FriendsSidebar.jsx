// src/frontend/src/Components/FriendsSidebar.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'

export default function FriendsSidebar({ userId, username }) {
  const { auth } = useAuth()
  const [friends, setFriends]             = useState([])
  const [requests, setRequests]           = useState([])
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [pendingSent, setPendingSent]     = useState([])
  const navigate    = useNavigate()
  const searchTimer = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch(`/api/users/friends/${userId}`, { signal: controller.signal }).then(r => r.json()),
      fetch(`/api/users/friends/${userId}/requests`, { signal: controller.signal }).then(r => r.json()),
      fetch(`/api/users/friends/${userId}/sent`, { signal: controller.signal }).then(r => r.json()),
    ]).then(([f, r, s]) => {
      setFriends(f)
      setRequests(r)
      setPendingSent(s.map(req => ({ id: req.addressee_id, username: req.addressee_username })))
    }).catch(err => { if (err.name !== 'AbortError') console.error(err) })
    return () => {
      controller.abort()
      clearTimeout(searchTimer.current)
    }
  }, [userId])

  const handleSearchChange = (e) => {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) { setSearchResults([]); return }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(setSearchResults)
        .catch(console.error)
    }, 300)
  }

  const handleAddFriend = async (friendId) => {
    const res = await fetch(`/api/users/friends/${userId}/request/${friendId}`, { method: 'POST' })
    if (!res.ok) return
    const user = searchResults.find(u => u.id === friendId)
    setSearchResults(prev => prev.filter(u => u.id !== friendId))
    if (user) setPendingSent(prev => [...prev, user])
  }

  const handleRespond = async (req, action) => {
    const res = await fetch(`/api/users/friends/${userId}/requests/${req.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`,
      },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) return
    setRequests(prev => prev.filter(r => r.id !== req.id))
    if (action === 'accept') {
      const profileRes = await fetch(`/api/users/profile/${req.requester_id}`)
      if (profileRes.ok) {
        const newFriend = await profileRes.json()
        setFriends(prev => [...prev, newFriend])
      }
    }
  }

  const handleRemoveFriend = async (friendId) => {
    const res = await fetch(`/api/users/friends/${userId}/${friendId}`, { method: 'DELETE' })
    if (!res.ok) return
    setFriends(prev => prev.filter(f => f.id !== friendId))
  }

  const handleChat = (friendId) => {
    const [a, b] = [userId, friendId].sort((x, y) => x - y)
    navigate(`/chat/DM-${a}-${b}`, { state: { username } })
  }

  const excludedIds = new Set([
    userId,
    ...friends.map(f => f.id),
    ...requests.map(r => r.requester_id),
    ...pendingSent.map(p => p.id),
  ])
  const visibleResults = searchResults.filter(u => !excludedIds.has(u.id))

  return (
    <aside className="friends-sidebar arcade-screen">
      <h2 className="friends-sidebar-title">Players</h2>

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
                    onClick={() => handleRespond(req, 'accept')}
                  >
                    ✓
                  </button>
                  <button
                    className="arcade-btn friends-btn friends-btn-decline"
                    onClick={() => handleRespond(req, 'decline')}
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
            {friends.map(friend => (
              <li key={friend.id} className="friends-list-item">
                <div className="friends-user-info">
                  <img
                    src={friend.avatar_url || '/avatar_placeholder.jpg'}
                    alt={friend.username}
                    className="friends-avatar"
                  />
                  <span className={`friends-status-dot friends-status-${friend.status}`} />
                  <span className="friends-username">{friend.username}</span>
                </div>
                <div className="friends-actions">
                  <button
                    className="arcade-btn arcade-btn-primary friends-btn"
                    onClick={() => handleChat(friend.id)}
                  >
                    Chat
                  </button>
                  <button
                    className="arcade-btn friends-btn friends-btn-decline"
                    onClick={() => handleRemoveFriend(friend.id)}
                  >
                    ✗
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
