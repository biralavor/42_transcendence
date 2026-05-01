// src/frontend/src/pages/Profile.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import GameSettings from '../Components/GameSettings'
import { getAvatarFilter } from '../utils/avatarFilter'
import { apiCall } from '../utils/apiClient'
import './Profile.css'
import FriendsSidebar from '../Components/FriendsSidebar'
import { useUser } from '../context/userContext'
import { useNotifications } from '../context/notificationContext'
import XpBar from '../Components/XpBar'
import BadgeGrid from '../Components/BadgeGrid'
import AchievementToast from '../Components/AchievementToast'

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const PLACEHOLDER_AVATAR = '/avatar_placeholder.jpg'

const DEFAULT_HISTORY_FILTERS = {
  dateFrom: '',
  dateTo: '',
  result: 'all',
  sort: 'date:desc',
}

function buildHistoryUrl(playerId, filters, page) {
  const params = new URLSearchParams({
    player_id: String(playerId),
    limit: '10',
    page: String(page),
    result: filters.result,
    order: filters.sort,
  })

  if (filters.dateFrom) params.set('date_from', `${filters.dateFrom}T00:00:00`)
  if (filters.dateTo) params.set('date_to', `${filters.dateTo}T23:59:59.999999`)

  return `/api/game/matches/history?${params.toString()}`
}

function formatLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
  const { profileUserId } = useParams()
  const { achievementQueue, dismissAchievement } = useNotifications()
  const { user, token } = useUser() 
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
  const [xpData, setXpData] = useState(null)
  const [achievements, setAchievements] = useState([])
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_HISTORY_FILTERS)
  const [historyPage, setHistoryPage] = useState(0)
  const todayDate = formatLocalDateInputValue()
  const isOwnProfile = user !== null && (user.id == profileUserId || profileUserId == null)
  const id = isNaN(Number(profileUserId)) ? user?.id : Number(profileUserId)
  
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
    if (!isOwnProfile) return
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
    if (!isOwnProfile || !avatarFile || avatarBusy) return
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
    if (!isOwnProfile || avatarBusy) return
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
    if (!token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setSaveStatus('')
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarBusy(false)
    setAvatarToast(null)
    setAvatarVersion(0)
    setProfile(null)
    setPaginatedHistory(emptyHistory())
    setUserRankData(null)
    setXpData(null)
    setAchievements([])

    const controller = new AbortController()
    const { signal } = controller

    if (!id) return

    Promise.all([
      apiCall(`/api/users/profile/${id}`, { signal }).then(r => {
        if (!r.ok) throw new Error(`Profile fetch failed: ${r.status}`)
        return r.json()
      }),
      apiCall(`/api/game/leaderboard?player_id=${id}&limit=1`, { signal }).then(r => {
        if (!r.ok) throw new Error(`Leaderboard fetch failed: ${r.status}`)
        return r.json()
      }),
    ]).then(([profileData, rankData]) => {
      setProfile({
        displayName: profileData.display_name ?? '',
        darkMode: profileData.dark_mode ?? false,
        avatarUrl: profileData.avatar_url ?? PLACEHOLDER_AVATAR,
        username: profileData.username,
        bio: profileData.bio ?? '',
        status: profileData.status,
        createdAt: profileData.created_at,
      })
      setUserRankData(rankData.player_stats)

      // Fetch XP and achievements after core profile data is loaded (non-blocking)
      apiCall(`/api/game/xp/${id}`, { signal })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setXpData(data) })
        .catch(() => {})

      apiCall(`/api/game/achievements/${id}`, { signal })
        .then(r => r.ok ? r.json() : [])
        .then(data => setAchievements(Array.isArray(data) ? data : []))
        .catch(() => {})
    })
    .catch(err => {
      if (err.name !== 'AbortError') setError(err.message)
    })
    .finally(() => {
      if (!signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [user, token, id, profileUserId])

  useEffect(() => {
    if (!token || !user) return

    const controller = new AbortController()
    const { signal } = controller
    const url = buildHistoryUrl(id, historyFilters, historyPage)

    apiCall(url, { signal })
      .then(r => {
        if (!r.ok) throw new Error(`Matches History fetch failed: ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!signal.aborted) setPaginatedHistory(data)
      })
      .catch(err => {
        if (err.name !== 'AbortError') setError(err.message)
      })

    return () => controller.abort()
  }, [token, user, historyFilters, historyPage])

  const handleChange = (e) => {
    const { name, value } = e.target
    setProfile(prev => ({
      ...prev,
      [name]: name === 'avatarUrl' ? sanitizeAvatarUrl(value) : value,
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!isOwnProfile) return
    try {
      const response = await apiCall(`/api/users/profile/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profile.displayName,
          bio: profile.bio,
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
          {isOwnProfile && (
            <div className="profile-sidebar-col">
              <FriendsSidebar
                userId={user.id}
                username={user.username}
                currentUser={{
                  id: user.id,
                  username: user.username,
                  avatarUrl: user.avatarUrl,
                }}
              />
            </div>
          )}
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
              <div className="profile-two-column">
                {/* Cell (0,0): display name + @username + xpbar */}
                <div className="profile-grid-cell profile-grid-cell--info">
                  <div className="profile-info">
                    <h1 className="profile-display-name">{profile.displayName || profile.username}</h1>
                    <p className="profile-username">@{profile.username}</p>
                    {xpData && (
                      <XpBar level={xpData.level} xpInLevel={xpData.xp_in_level} />
                    )}
                  </div>
                </div>

                {/* Cell (0,1): avatar */}
                <div className="profile-grid-cell profile-grid-cell--avatar">
                  <div className="profile-avatar-wrapper">
                    <img
                      src={avatarSrc}
                      alt="User avatar"
                      className="profile-avatar"
                      style={{ filter: avatarPreview ? 'none' : getAvatarFilter(id) }}
                    />
                    {avatarBusy && (
                      <div className="profile-avatar-spinner" aria-label="Uploading avatar" role="status">
                        <span className="profile-spinner" />
                      </div>
                    )}
                    {isOwnProfile && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                {/* Cell (0,2): stats vertically aligned */}
                <div className="profile-grid-cell profile-grid-cell--stats">
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

                {/* Cell (1,0): Preferences (Profile sub-section + Game settings + Dark mode + Save) */}
                {isOwnProfile && (
                <div className="profile-grid-cell profile-grid-cell--prefs">
                  <form className="profile-form" onSubmit={handleSave}>
                    {saveStatus && (
                      <div className={`alert ${saveStatus.includes('successfully') ? 'alert-success' : 'alert-danger'} profile-alert`} role="alert">
                        {saveStatus}
                      </div>
                    )}
                    <div className="profile-preferences">
                      <h2 className="profile-section-title">Preferences</h2>

                      <div className="profile-preferences-subsection">
                        <p className="profile-preferences-subtitle">Profile</p>
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
                      </div>

                      <GameSettings />
                    </div>
                    <button className="arcade-btn arcade-btn-primary profile-save-btn" type="submit">
                      Save profile
                    </button>
                  </form>
                </div>
                )}

                {/* Cell (1,1): Achievements */}
                <div className="profile-grid-cell profile-grid-cell--ach">
                  <h2 className="profile-section-title">Achievements</h2>
                  {achievements.length > 0 ? (
                    <BadgeGrid achievements={achievements} />
                  ) : (
                    <p style={{ color: 'var(--metal-silver)', fontFamily: 'VT323, monospace' }}>
                      No achievements unlocked yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="profile-history">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <h2 className="profile-section-title mb-0">Match history</h2>
                  <Link to="/profile/activity" className="arcade-btn arcade-btn-secondary">
                    View activity
                  </Link>
                </div>
                <div className="history-controls" role="group" aria-label="Match history filters">
                  {['all', 'win', 'loss'].map((value) => (
                    <label key={value} className="history-filter-option">
                      <input
                        type="radio"
                        name="historyResult"
                        value={value}
                        checked={historyFilters.result === value}
                        onChange={(e) => {
                          setHistoryFilters(prev => ({ ...prev, result: e.target.value }))
                          setHistoryPage(0)
                        }}
                      />
                      {value === 'all' ? 'All' : value === 'win' ? 'Wins' : 'Losses'}
                    </label>
                  ))}
                  <label className="history-filter-option history-filter-date">
                    From
                    <input
                      type="date"
                      value={historyFilters.dateFrom}
                      max={historyFilters.dateTo || todayDate}
                      onChange={(e) => {
                        setHistoryFilters(prev => ({ ...prev, dateFrom: e.target.value }))
                        setHistoryPage(0)
                      }}
                    />
                  </label>
                  <label className="history-filter-option history-filter-date">
                    To
                    <input
                      type="date"
                      value={historyFilters.dateTo}
                      min={historyFilters.dateFrom}
                      max={todayDate}
                      onChange={(e) => {
                        setHistoryFilters(prev => ({ ...prev, dateTo: e.target.value }))
                        setHistoryPage(0)
                      }}
                    />
                  </label>
                  <label className="history-filter-option history-filter-select">
                    Sort
                    <select
                      value={historyFilters.sort}
                      onChange={(e) => {
                        setHistoryFilters(prev => ({ ...prev, sort: e.target.value }))
                        setHistoryPage(0)
                      }}
                    >
                      <option value="date:desc">Date</option>
                      <option value="result:asc">Result</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="history-clear-button"
                    onClick={() => {
                      setHistoryFilters(DEFAULT_HISTORY_FILTERS)
                      setHistoryPage(0)
                    }}
                  >
                    Clear filters
                  </button>
                </div>
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
                <div className="history-pagination" aria-label="Match history pagination">
                  <button
                    type="button"
                    className="history-page-button"
                    disabled={paginatedHistory.page <= 0}
                    onClick={() => setHistoryPage(page => Math.max(0, page - 1))}
                  >
                    Previous
                  </button>
                  <span className="history-page-summary">
                    Page {paginatedHistory.page + 1} of {paginatedHistory.last_page + 1} · {paginatedHistory.total} matches
                  </span>
                  <button
                    type="button"
                    className="history-page-button"
                    disabled={paginatedHistory.page >= paginatedHistory.last_page}
                    onClick={() => setHistoryPage(page => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {achievementQueue.length > 0 && (
        <AchievementToast
          key={achievementQueue[0].id}
          icon={achievementQueue[0].icon ?? '🏆'}
          name={achievementQueue[0].name ?? 'Achievement Unlocked'}
          description={achievementQueue[0].message ?? ''}
          onDismiss={() => dismissAchievement(achievementQueue[0].id)}
        />
      )}
    </div>
  )
}
