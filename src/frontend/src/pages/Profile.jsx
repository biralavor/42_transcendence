// src/frontend/src/pages/Profile.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import NavbarComponent from '../Components/Navbar'
import GameSettings from '../Components/GameSettings'
import { getAvatarFilter } from '../utils/avatarFilter'
import { apiCall } from '../utils/apiClient'
import './Profile.css'
import FriendsSidebar from '../Components/FriendsSidebar'
import { useAuth } from '../context/authContext'

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const PLACEHOLDER_AVATAR = '/avatar_placeholder.jpg'

function getSafeAvatarUrl(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    return ''
  }
  const trimmed = avatarUrl.trim()
  if (!trimmed) {
    return ''
  }
  // Same-origin relative path (reject scheme-relative "//host/...")
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }
  // Absolute http(s) URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.toString()
      }
    } catch {
      // fall through to return empty string
    }
  }
  return ''
}

function sanitizeAvatarUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return PLACEHOLDER_AVATAR
  }

  const url = rawUrl.trim()

  // Same-origin relative path (reject scheme-relative "//host/...")
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }

  // Absolute http(s) URL
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString()
      }
    } catch {
      // Fall through to placeholder on parse errors
    }
  }

  return PLACEHOLDER_AVATAR
}

function emptyHistory(){
  return {
    results: [],
    summary: {
      player_id: 0,
      wins: 0,
      losses: 0,
      total_matches: 0
    },
    total: 0,
    page: 0,
    per_page: 0,
    last_page: 0,
  }
}

export default function Profile() {
  const { auth } = useAuth()
  const [userId, setUserId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [paginatedHistory, setPaginatedHistory] = useState(emptyHistory())
  const [userRankData, setUserRankData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const saveStatusTimer = useRef(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarToast, setAvatarToast] = useState(null)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const fileInputRef = useRef(null)
  const avatarToastTimer = useRef(null)

  useEffect(() => {
    return () => {
      clearTimeout(saveStatusTimer.current)
      clearTimeout(avatarToastTimer.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  const avatarSrc = useMemo(() => {
    if (avatarPreview) return avatarPreview
    const base = getSafeAvatarUrl(profile?.avatarUrl)
    if (!base) return ''
    if (avatarVersion > 0 && profile?.avatarUrl !== PLACEHOLDER_AVATAR) {
      const sep = base.includes('?') ? '&' : '?'
      return `${base}${sep}v=${encodeURIComponent(avatarVersion)}`
    }
    return base
  }, [avatarPreview, profile?.avatarUrl, avatarVersion])

  const showAvatarToast = (kind, message) => {
    setAvatarToast({ kind, message })
    clearTimeout(avatarToastTimer.current)
    avatarToastTimer.current = setTimeout(() => setAvatarToast(null), 4000)
  }

  const clearAvatarSelection = () => {
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      showAvatarToast('error', 'Only JPEG, PNG, or WebP images are allowed.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showAvatarToast('error', 'File is too large. Maximum size is 2 MB.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile || avatarBusy) return
    setAvatarBusy(true)
    try {
      const formData = new FormData()
      formData.append('file', avatarFile)
      const response = await apiCall('/api/users/avatar', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        let msg = `Upload failed (HTTP ${response.status})`
        try {
          const data = await response.json()
          if (data?.detail) msg = data.detail
        } catch {
          // response had no JSON body
        }
        throw new Error(msg)
      }
      const data = await response.json()
      setProfile(prev => prev ? { ...prev, avatarUrl: data.avatar_url } : prev)
      setAvatarVersion(v => v + 1)
      clearAvatarSelection()
      showAvatarToast('success', 'Avatar updated.')
    } catch (err) {
      showAvatarToast('error', err.message || 'Failed to upload avatar.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarDelete = async () => {
    if (avatarBusy) return
    setAvatarBusy(true)
    try {
      const response = await apiCall('/api/users/avatar', { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(`Delete failed (HTTP ${response.status})`)
      }
      setProfile(prev => prev ? { ...prev, avatarUrl: PLACEHOLDER_AVATAR } : prev)
      setAvatarVersion(v => v + 1)
      clearAvatarSelection()
      showAvatarToast('success', 'Avatar removed.')
    } catch (err) {
      showAvatarToast('error', err.message || 'Failed to remove avatar.')
    } finally {
      setAvatarBusy(false)
    }
  }

  useEffect(() => {
    if (!auth.access_token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const { signal } = controller

    apiCall('/api/users/auth/me', { signal })
      .then(r => {
        if (!r.ok) throw new Error(`Auth failed: ${r.status}`)
        return r.json()
      })
      .then(me => {
        const id = me.id
        setUserId(id)
        return Promise.all([
          apiCall(`/api/users/profile/${id}`, { signal }).then(r => {
            if (!r.ok) throw new Error(`Profile fetch failed: ${r.status}`)
            return r.json()
          }),
          apiCall(`/api/game/matches/history?player_id=${id}`, { signal }).then(r => {
            if (!r.ok) throw new Error(`History fetch failed: ${r.status}`)
            return r.json()
          }),
          apiCall(`/api/game/leaderboard?player_id=${id}&limit=1`, { signal }).then(r => {
            if (!r.ok) throw new Error(`History fetch failed: ${r.status}`)
            return r.json()
          }),
        ])
      })
      .then(([profileData, historyData, rankData]) => {
        setProfile({
          displayName: profileData.display_name ?? '',
          darkMode: profileData.dark_mode ?? false,
          avatarUrl: profileData.avatar_url ?? PLACEHOLDER_AVATAR,
          username: profileData.username,
          bio: profileData.bio ?? '',
          status: profileData.status,
          createdAt: profileData.created_at,
        })
        setPaginatedHistory(historyData)
        setUserRankData(rankData.player_stats)
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
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'avatarUrl'
            ? sanitizeAvatarUrl(value)
            : value,
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const response = await apiCall(`/api/users/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profile.displayName,
          bio: profile.bio,
          dark_mode: profile.darkMode,
        }),
      })
      if (!response.ok) throw new Error('Save failed')
      setSaveStatus('Profile updated successfully!')
      clearTimeout(saveStatusTimer.current)
      saveStatusTimer.current = setTimeout(() => setSaveStatus(''), 3000)
    } catch {
      setSaveStatus('Failed to save profile.')
      clearTimeout(saveStatusTimer.current)
      saveStatusTimer.current = setTimeout(() => setSaveStatus(''), 3000)
    }
  }

  const wins = paginatedHistory.summary.wins
  const matches = paginatedHistory.summary.total_matches

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
            <FriendsSidebar
              userId={userId}
              username={profile?.username}
              currentUser={{
                id: userId,
                username: profile?.username,
                avatarUrl: profile?.avatarUrl,
              }}
            />
          </div>
          <div className="profile-main-col">
            <div className="arcade-screen profile-card">
              {avatarToast && (
                <div
                  className={`alert ${avatarToast.kind === 'success' ? 'alert-success' : 'alert-danger'} profile-alert`}
                  role="alert"
                >
                  {avatarToast.message}
                </div>
              )}
              <div className="profile-header">
                <div className="profile-avatar-wrapper">
                  <img
                    src={avatarSrc}
                    alt="User avatar"
                    className="profile-avatar"
                    style={{ filter: avatarPreview ? 'none' : getAvatarFilter(userId) }}
                  />
                  {avatarBusy && (
                    <div className="profile-avatar-spinner" aria-label="Uploading avatar" role="status">
                      <span className="profile-spinner" />
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="profile-avatar-file-input"
                    onChange={handleAvatarPick}
                    aria-label="Choose avatar image"
                  />
                  <div className="profile-avatar-actions">
                    {!avatarPreview && (
                      <>
                        <button
                          type="button"
                          className="arcade-btn arcade-btn-secondary profile-avatar-btn"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarBusy}
                        >
                          Change avatar
                        </button>
                        <button
                          type="button"
                          className="arcade-btn arcade-btn-danger profile-avatar-btn"
                          onClick={handleAvatarDelete}
                          disabled={avatarBusy || !profile?.avatarUrl || profile.avatarUrl === PLACEHOLDER_AVATAR}
                        >
                          Remove
                        </button>
                      </>
                    )}
                    {avatarPreview && (
                      <>
                        <button
                          type="button"
                          className="arcade-btn arcade-btn-primary profile-avatar-btn"
                          onClick={handleAvatarUpload}
                          disabled={avatarBusy}
                        >
                          {avatarBusy ? 'Uploading…' : 'Confirm upload'}
                        </button>
                        <button
                          type="button"
                          className="arcade-btn arcade-btn-secondary profile-avatar-btn"
                          onClick={clearAvatarSelection}
                          disabled={avatarBusy}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
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
                      <span className="profile-stat-value">{userRankData?.rank ?? '-'}</span>
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
                  <GameSettings />
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
                {paginatedHistory.total === 0 ? (
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
                    {paginatedHistory.results.map((match) => (
                      <div className="history-row" key={match.match_id}>
                        <div className="history-col history-opponent">
                          {
                            match?.opponent_display_name
                              ?? `Player #${match.opponent_id}`
                          }
                        </div>
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
