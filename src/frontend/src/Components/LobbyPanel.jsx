import { useState, useEffect } from 'react'
import './LobbyPanel.css'

export default function LobbyPanel({ compact = false, onEnter, username, token }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const controller = new AbortController()
    fetch('/api/chat/rooms', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setRooms(data)
        setLoading(false)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setFetchError('Could not load rooms. Try refreshing.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [token])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newRoomName.trim() || !token || !username) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room_name: newRoomName.trim(), creator_name: username }),
      })
      if (res.status === 201) {
        const data = await res.json()
        onEnter(data.room_name)
      } else if (res.status === 409) {
        setCreateError('A room with that name already exists.')
      } else if (res.status === 400) {
        setCreateError('Invalid room name. Use letters, numbers, spaces and dashes (max 50 chars).')
      } else {
        setCreateError('Failed to create room. Try again.')
      }
    } catch {
      setCreateError('Network error. Try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className={`lobby-panel${compact ? ' lobby-panel--compact' : ''}`}
      aria-label="Public rooms lobby"
    >
      <h3 className="lobby-panel__title">{compact ? 'Rooms' : 'Public Rooms'}</h3>

      {loading ? (
        <p className="lobby-panel__status">Loading…</p>
      ) : fetchError ? (
        <p className="lobby-panel__error" role="alert">{fetchError}</p>
      ) : rooms.length === 0 ? (
        <p className="lobby-panel__status">
          {compact ? 'No live rooms.' : 'No live rooms yet. Create the first one!'}
        </p>
      ) : (
        <ul className="lobby-panel__list">
          {rooms.map(room => (
            <li key={room.room_name} className="lobby-panel__item">
              <button
                type="button"
                className="lobby-panel__room-btn"
                onClick={() => onEnter(room.room_name)}
                aria-label={`${room.room_name}, ${room.active_connections} users`}
                disabled={!username}
              >
                <span className="lobby-panel__room-name">{room.room_name}</span>
                <span className="lobby-panel__room-count">({room.active_connections})</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!compact && (
        <form
          className="lobby-panel__create"
          onSubmit={handleCreate}
          aria-label="Create a new room"
        >
          <input
            className="lobby-panel__create-input"
            placeholder="New room name…"
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            maxLength={50}
            aria-label="New room name"
          />
          <button
            type="submit"
            className="arcade-btn arcade-btn-primary"
            disabled={creating || !newRoomName.trim() || !token || !username}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
          {createError && (
            <p className="lobby-panel__error" role="alert">
              {createError}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
