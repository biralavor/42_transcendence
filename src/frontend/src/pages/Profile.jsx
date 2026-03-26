// src/frontend/src/pages/Profile.jsx
import { useState, useEffect, useRef } from 'react'
import NavbarComponent from '../Components/Navbar'
import { getAvatarFilter } from '../utils/avatarFilter'
import './Profile.css'
import FriendsSidebar from '../Components/FriendsSidebar'
import { useAuth } from '../context/authContext'

export default function Profile() {
  const { auth } = useAuth()
  const [userId, setUserId]     = useState(null)
  const [profile, setProfile]   = useState(null)
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const saveStatusTimer = useRef(null)

  useEffect(() => {
    return () => clearTimeout(saveStatusTimer.current)
  }, [])

  useEffect(() => {
    if (!auth.access_token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const { signal } = controller

    fetch('/api/users/auth/me', {
      signal,
      headers: { Authorization: `Bearer ${auth.access_token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`Auth failed: ${r.status}`)
        return r.json()
      })
      .then(me => {
        const id = me.id
        setUserId(id)
        return Promise.all([
          fetch(`/api/users/profile/${id}`, { signal }).then(r => {
            if (!r.ok) throw new Error(`Profile fetch failed: ${r.status}`)
            return r.json()
          }),
          fetch(`/api/game/matches/history/${id}`, { signal }).then(r => {
            if (!r.ok) throw new Error(`History fetch failed: ${r.status}`)
            return r.json()
          }),
        ])
      })
      .then(([profileData, historyData]) => {
        setProfile({
          displayName: profileData.display_name ?? '',
          darkMode:    profileData.dark_mode ?? false,
          avatarUrl:   profileData.avatar_url ?? '/avatar_placeholder.jpg',
          username:    profileData.username,
          bio:         profileData.bio ?? '',
          status:      profileData.status,
          createdAt:   profileData.created_at,
        })
        setHistory(historyData)
      })
      .catch(err => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [auth.access_token])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setProfile(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const resp = await fetch(`/api/users/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profile.displayName,
          bio:          profile.bio,
          dark_mode:    profile.darkMode,
        }),
      })
      if (!resp.ok) throw new Error('Save failed')
      setSaveStatus('Profile updated successfully!')
      clearTimeout(saveStatusTimer.current)
      saveStatusTimer.current = setTimeout(() => setSaveStatus(''), 3000)
    } catch {
      setSaveStatus('Failed to save profile.')
      clearTimeout(saveStatusTimer.current)
      saveStatusTimer.current = setTimeout(() => setSaveStatus(''), 3000)
    }
  }

  const wins    = history.filter(m => m.result === 'Win').length
  const matches = history.length

  if (loading) return (
    <div className="arcade-shell">
      <NavbarComponent />
      <main className="arcade-content profile-page">
        <div className="arcade-screen profile-card">
          <p style={{ color: 'var(--metal-silver)' }}>Loading profile…</p>
        </div>
      </main>
    </div>
  )

  if (error) return (
    <div className="arcade-shell">
      <NavbarComponent />
      <main className="arcade-content profile-page">
        <div className="arcade-screen profile-card">
          <p style={{ color: '#ef9a9a' }}>{error}</p>
        </div>
      </main>
    </div>
  )

  return (
    <div className="arcade-shell">
      <NavbarComponent />
      <main className="arcade-content profile-page">
        <div className="profile-layout">
          <div className="profile-sidebar-col">
            <FriendsSidebar userId={userId} username={profile?.username} />
          </div>
          <div className="profile-main-col">
          <div className="arcade-screen profile-card">
          <div className="profile-header">
            <div className="profile-avatar-wrapper">
              <img
                src={profile.avatarUrl}
                alt="User avatar"
                className="profile-avatar"
                style={{ filter: getAvatarFilter(userId) }}
              />
            </div>
            <div className="profile-info">
              <h1 className="profile-display-name">{profile.displayName || profile.username}</h1>
              <p className="profile-username">@{profile.username}</p>
              <div className="profile-stats">
                <div className="profile-stat-card">
                  <span className="profile-stat-value">{wins}</span>
                  <span className="profile-stat-label">Wins</span>
                </div>
                <div className="profile-stat-card">
                  <span className="profile-stat-value">—</span>
                  <span className="profile-stat-label">Rank</span>
                </div>
                <div className="profile-stat-card">
                  <span className="profile-stat-value">{matches}</span>
                  <span className="profile-stat-label">Matches</span>
                </div>
              </div>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            {saveStatus && (
              <div className={`alert ${saveStatus.includes('successfully') ? 'alert-success' : 'alert-danger'} profile-alert`} role="alert">
                {saveStatus}
              </div>
            )}
            <div className="form-floating mb-3 arcade-form-control profile-form-control">
              <input
                type="text"
                className="form-control"
                id="displayName"
                name="displayName"
                placeholder="Display name"
                value={profile.displayName}
                onChange={handleChange}
              />
              <label htmlFor="displayName">Display name</label>
            </div>
            <div className="form-floating mb-3 arcade-form-control profile-form-control">
              <textarea
                className="form-control"
                id="bio"
                name="bio"
                placeholder="Your bio"
                style={{ height: '100px' }}
                value={profile.bio}
                onChange={handleChange}
              />
              <label htmlFor="bio">Bio</label>
            </div>
            <div className="profile-preferences">
              <h2 className="profile-section-title">Preferences</h2>
              <div className="profile-preference-item form-check arcade-form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="darkMode"
                  name="darkMode"
                  checked={profile.darkMode}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="darkMode">
                  Enable dark mode
                </label>
              </div>
            </div>
            <button className="arcade-btn arcade-btn-primary profile-save-btn" type="submit">
              Save profile
            </button>
          </form>

          <div className="profile-history">
            <h2 className="profile-section-title">Match history</h2>
            {history.length === 0 ? (
              <p style={{ color: 'var(--metal-silver)', fontFamily: 'VT323, monospace' }}>
                No matches yet.
              </p>
            ) : (
              <div className="history-table">
                <div className="history-row history-header">
                  <div className="history-col">Opponent</div>
                  <div className="history-col">Date</div>
                  <div className="history-col">Result</div>
                  <div className="history-col">Score</div>
                </div>
                {history.map((match) => (
                  <div className="history-row" key={match.id}>
                    <div className="history-col history-opponent">Player #{match.opponent_id}</div>
                    <div className="history-col history-date">
                      {match.date ? new Date(match.date).toLocaleDateString() : '—'}
                    </div>
                    <div className="history-col history-result">{match.result}</div>
                    <div className="history-col history-score">{match.score}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}