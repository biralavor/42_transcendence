import { useState } from 'react'
import NavbarComponent from '../Components/Navbar'
import './Profile.css'

/**
 * Profile page component.  This page displays the current user's public
 * information along with editable fields for display name, bio and
 * preferences.  A simple match history table is also included to
 * illustrate how past games could be surfaced once the backend is
 * implemented.  All data on this page is mock data and is stored in
 * component state – no requests are sent to a server.  When a real
 * backend becomes available, replace the state management with API
 * calls to load and persist user data.
 */
export default function Profile() {
  // Mock profile data.  In a real application this would be loaded from
  // an API after the user signs in.
  const [profile, setProfile] = useState({
    username: 'retro_gamer',
    displayName: 'Retro Gamer',
    bio: 'Paddling through pixels and climbing the leaderboard!',
    preferences: {
      // Dark mode preference; additional settings can be added here when needed.
      darkMode: false,
    },
    metrics: {
      wins: 12,
      rank: 34,
      matches: 20,
    },
    history: [
      { id: 1, opponent: 'ArcadeAce', result: 'Win', score: '11–7', date: '2026-03-15' },
      { id: 2, opponent: 'PaddlePro', result: 'Loss', score: '9–11', date: '2026-03-14' },
      { id: 3, opponent: 'PixelMaster', result: 'Win', score: '11–4', date: '2026-03-12' },
      { id: 4, opponent: 'GameGuru', result: 'Win', score: '11–9', date: '2026-03-10' },
    ],
  })

  const [status, setStatus] = useState('')

  // Generic change handler for form inputs.  It can update nested
  // preference values as well as top‑level profile fields.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    if (name in profile.preferences) {
      setProfile((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [name]: type === 'checkbox' ? checked : value,
        },
      }))
    } else {
      setProfile((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }))
    }
  }

  // Simulate saving the profile.  In a real app this would make a
  // request to persist the updated user data.  We simply set a status
  // message to let the user know the operation completed.
  const handleSave = (e) => {
    e.preventDefault()
    // In a real implementation you would POST/PATCH to an API here.
    setStatus('Profile updated successfully!')
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />
      <main className="arcade-content profile-page">
        <div className="arcade-screen profile-card">
          <div className="profile-header">
            <div className="profile-avatar-wrapper">
              {/* Placeholder avatar; replace with user avatar once available */}
              <img src="/avatar_placeholder.png" alt="User avatar" className="profile-avatar" />
            </div>
            <div className="profile-info">
              <h1 className="profile-display-name">{profile.displayName}</h1>
              <p className="profile-username">@{profile.username}</p>
              <div className="profile-stats">
                <div className="profile-stat-card">
                  <span className="profile-stat-value">{profile.metrics.wins}</span>
                  <span className="profile-stat-label">Wins</span>
                </div>
                <div className="profile-stat-card">
                  <span className="profile-stat-value">{profile.metrics.rank}</span>
                  <span className="profile-stat-label">Rank</span>
                </div>
                <div className="profile-stat-card">
                  <span className="profile-stat-value">{profile.metrics.matches}</span>
                  <span className="profile-stat-label">Matches</span>
                </div>
              </div>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            {status && (
              <div className="alert alert-success profile-alert" role="alert">
                {status}
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
                  checked={profile.preferences.darkMode}
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
            <div className="history-table">
              <div className="history-row history-header">
                <div className="history-col">Opponent</div>
                <div className="history-col">Date</div>
                <div className="history-col">Result</div>
                <div className="history-col">Score</div>
              </div>
              {profile.history.map((match) => (
                <div className="history-row" key={match.id}>
                  <div className="history-col history-opponent">{match.opponent}</div>
                  <div className="history-col history-date">{match.date}</div>
                  <div className="history-col history-result">{match.result}</div>
                  <div className="history-col history-score">{match.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}