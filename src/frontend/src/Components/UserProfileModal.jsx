import { useState, useEffect } from 'react'
import './UserProfileModal.css'

const DEFAULT_AVATAR = '/avatar_placeholder.jpg'

export default function UserProfileModal({ username, userId, currentUserId, onClose, onChat }) {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [resolvedId, setResolvedId] = useState(userId ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // placeholder — data fetching added in Task 2
  }, [username, userId])

  return (
    <div className="upm-backdrop" role="dialog" aria-modal="true">
      <div className="upm-dialog">
        <button className="upm-close" onClick={onClose} aria-label="Close">×</button>
        {loading && <p className="upm-loading">Loading…</p>}
        {error && <p className="upm-error">{error}</p>}
      </div>
    </div>
  )
}
