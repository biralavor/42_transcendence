// src/frontend/src/Components/UserProfileModal.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/authContext'
import './UserProfileModal.css'

const DEFAULT_AVATAR = '/avatar_placeholder.jpg'

export default function UserProfileModal({ username, userId, currentUserId, onClose, onChat }) {
  const { auth } = useAuth()
  const [profile, setProfile] = useState(null)
  const [wins, setWins] = useState(0)
  const [matches, setMatches] = useState(0)
  const [resolvedId, setResolvedId] = useState(userId ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        let targetId = userId ?? null

        if (!targetId) {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(username)}`)
          if (!res.ok) throw new Error('User not found')
          const results = await res.json()
          const match = results.find(u => u.username.toLowerCase() === username.toLowerCase())
          if (!match) throw new Error(`No user "${username}"`)
          targetId = match.id
        }

        if (cancelled) return
        setResolvedId(targetId)

        const [profileRes, historyRes] = await Promise.all([
          fetch(`/api/users/profile/${targetId}`),
          fetch(`/api/game/matches/history/${targetId}`),
        ])

        if (!profileRes.ok) throw new Error('Failed to load profile')
        const profileData = await profileRes.json()
        const historyData = historyRes.ok ? await historyRes.json() : []

        if (cancelled) return
        setProfile({
          displayName: profileData.display_name ?? profileData.username,
          username: profileData.username,
          avatarUrl: profileData.avatar_url ?? DEFAULT_AVATAR,
        })
        setWins(historyData.filter(m => m.result === 'Win').length)
        setMatches(historyData.length)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [username, userId])

  async function handleAddFriend() {
    if (!currentUserId || !resolvedId) return
    try {
      const res = await fetch(`/api/users/friends/${currentUserId}/request/${resolvedId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.access_token}` },
      })
      setActionMsg(res.ok ? 'Friend request sent!' : 'Could not send request.')
    } catch {
      setActionMsg('Could not send request.')
    }
  }

  async function handleBlock() {
    if (!resolvedId) return
    try {
      const res = await fetch(`/api/chat/block/${resolvedId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.access_token}` },
      })
      setActionMsg(res.ok ? 'User blocked.' : 'Could not block user.')
    } catch {
      setActionMsg('Could not block user.')
    }
  }

  const canAct = resolvedId && currentUserId && resolvedId !== currentUserId

  return (
    <div className="upm-backdrop" role="dialog" aria-modal="true">
      <div className="upm-dialog">
        <button className="upm-close" onClick={onClose} aria-label="Close">×</button>

        {loading && <p className="upm-loading">Loading…</p>}
        {error && <p className="upm-error">{error}</p>}

        {!loading && !error && profile && (
          <>
            <div className="upm-header">
              <img
                src={profile.avatarUrl}
                alt={profile.username}
                className="upm-avatar"
              />
              <div className="upm-names">
                <p className="upm-display-name">{profile.displayName}</p>
                <p className="upm-username">@{profile.username}</p>
              </div>
            </div>

            <div className="upm-stats">
              <div className="upm-stat">
                <span className="upm-stat-value">{wins}</span>
                <span className="upm-stat-label">Wins</span>
              </div>
              <div className="upm-stat">
                <span className="upm-stat-value">{matches}</span>
                <span className="upm-stat-label">Matches</span>
              </div>
            </div>

            {actionMsg && <p className="upm-action-msg">{actionMsg}</p>}

            <div className="upm-actions">
              {canAct && (
                <button
                  className="arcade-btn arcade-btn-primary"
                  onClick={() => onChat(resolvedId)}
                >
                  Chat
                </button>
              )}
              {canAct && (
                <button
                  className="arcade-btn arcade-btn-secondary"
                  onClick={handleAddFriend}
                >
                  Add Friend
                </button>
              )}
              {canAct && (
                <button
                  className="arcade-btn arcade-btn-danger"
                  onClick={handleBlock}
                >
                  Block
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
