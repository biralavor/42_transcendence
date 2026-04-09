import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { useAuth } from '../context/authContext'
import { apiCall, apiJson } from '../utils/apiClient'

/**
 * Tournaments hub
 *
 * This page allows authenticated users to create new tournaments and join
 * existing ones. Because the backend currently exposes no endpoint to
 * list all tournaments, this component maintains a local list of
 * tournaments the current user creates or joins. After creating a
 * tournament, details are fetched from the server so participant counts
 * and status remain accurate. Users can join open tournaments that have
 * not yet reached their participant capacity and view the bracket by
 * navigating to the tournament detail page. Once a proper tournaments
 * listing endpoint is available, this page can be extended to fetch
 * tournaments from the backend instead of relying on local state.
 */
export default function Tournaments() {
  const navigate = useNavigate()
  const { auth } = useAuth()
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [tournaments, setTournaments] = useState([])
  const [name, setName] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(4)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Track whether the current user is already registered in an active tournament (open or in progress).
  const [hasActiveTournament, setHasActiveTournament] = useState(false)

  // Track an id to manually add/join a tournament by id.  This allows other
  // users to join tournaments created elsewhere when they know the id.
  const [manualId, setManualId] = useState('')
  const [joiningById, setJoiningById] = useState(false)

  // Fetch the authenticated user's info once to know their id.
  useEffect(() => {
    let cancelled = false
    async function loadMe() {
      if (!auth?.access_token) {
        setCurrentUser(null)
        setLoadingUser(false)
        return
      }
      try {
        const resp = await apiCall('/api/users/auth/me')
        if (!resp.ok) throw new Error(`Failed to load user: ${resp.status}`)
        const data = await resp.json()
        if (!cancelled) setCurrentUser({ id: data.id, username: data.username })
      } catch {
        if (!cancelled) setCurrentUser(null)
      } finally {
        if (!cancelled) setLoadingUser(false)
      }
    }
    loadMe()
    return () => { cancelled = true }
  }, [auth?.access_token])

  // Helper to fetch a tournament's full details and merge into local state
  async function fetchAndStoreTournament(id) {
    try {
      const resp = await apiCall(`/api/game/tournaments/${id}`)
      if (!resp.ok) throw new Error('Failed to load tournament details')
      const data = await resp.json()
      setTournaments((prev) => {
        // Update existing entry or append new
        const idx = prev.findIndex((t) => t.id === data.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = data
          return updated
        }
        return [...prev, data]
      })

      // Persist tournament id in localStorage for this user so it remains
      // available across page reloads.  Merge with existing stored ids.
      try {
        const stored = JSON.parse(localStorage.getItem('myTournaments') || '[]')
        if (!stored.includes(data.id)) {
          stored.push(data.id)
          localStorage.setItem('myTournaments', JSON.stringify(stored))
        }
      } catch {
        // Ignore storage errors
      }
      // Return the loaded data so callers can inspect participant counts
      return data
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load tournament details')
    }
  }

  // Create a new tournament via the backend and fetch its details
  async function handleCreate(e) {
    e.preventDefault()
    if (!name || creating) return
    // Prevent creating a new tournament if the user already participates in another
    if (hasActiveTournament) {
      setError('You are already registered in a tournament. Leave your current tournament before creating a new one.')
      return
    }
    setError('')
    setCreating(true)
    try {
      // Send create tournament request.  The backend uses the authenticated
      // user as creator_id implicitly via dependency injection.
      const body = { name, max_participants: Number(maxParticipants) }
      const data = await apiJson('/api/game/tournaments', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      // Response includes id and join_link.  Fetch full details next.
      if (data?.id) {
        await fetchAndStoreTournament(data.id)
      }
      // Reset the form
      setName('')
      setMaxParticipants(4)
    } catch (err) {
      setError(err.message || 'Failed to create tournament')
    } finally {
      setCreating(false)
    }
  }

  // Join a tournament and refresh its details
  async function handleJoin(id) {
    setError('')
    // Prevent joining a second active tournament unless it's the one the user is already in
    if (hasActiveTournament) {
      const existing = tournaments.find((t) => t.id === id)
      const alreadyJoined = existing?.participants?.some((p) => Number(p.user_id) === Number(currentUser?.id))
      if (!alreadyJoined) {
        setError('You are already registered in an active tournament. Leave it before joining another.')
        return
      }
    }
    try {
      await apiJson(`/api/game/tournaments/${id}/join`, {
        method: 'POST',
      })
      const data = await fetchAndStoreTournament(id)
      // If the tournament is now full (participants == max), redirect to its detail page
      if (data && data.participants && data.participants.length === data.max_participants) {
        navigate(`/tournaments/${id}`)
      }
    } catch (err) {
      setError(err.message || 'Failed to join tournament')
    }
  }

  // Manually join a tournament by entering its id.  Useful when another
  // user shares an id and there is no listing endpoint.  This adds the
  // tournament to the local list and attempts to join if not already
  // registered.
  async function handleJoinById(e) {
    e.preventDefault()
    const idNum = Number(manualId)
    if (!idNum || joiningById) return
    setError('')
    setJoiningById(true)
    try {
      // Prevent joining a second active tournament unless it's the same tournament
      if (hasActiveTournament) {
        const existing = tournaments.find((t) => t.id === idNum)
        const alreadyJoinedExisting = existing?.participants?.some((p) => Number(p.user_id) === Number(currentUser?.id))
        if (!alreadyJoinedExisting) {
          setError('You are already registered in an active tournament. Leave it before joining another.')
          return
        }
      }
      // Fetch tournament details first to verify existence and status
      const resp = await apiCall(`/api/game/tournaments/${idNum}`)
      if (!resp.ok) {
        if (resp.status === 404) throw new Error('Tournament not found')
        throw new Error('Failed to fetch tournament')
      }
      const data = await resp.json()
      // Determine if user has already joined
      const joined = data.participants?.some((p) => Number(p.user_id) === Number(currentUser?.id))
      if (!joined && data.status === 'open' && data.participants?.length < data.max_participants) {
        // Attempt to join the tournament
        await apiJson(`/api/game/tournaments/${idNum}/join`, { method: 'POST' })
      }
      // Store the tournament in local state and localStorage
      await fetchAndStoreTournament(idNum)
      setManualId('')
    } catch (err) {
      setError(err.message || 'Could not join tournament')
    } finally {
      setJoiningById(false)
    }
  }

  // Cancel a tournament created by the current user.  Sends a DELETE request
  // to the backend and removes the tournament from local state and
  // localStorage. Only makes sense when the tournament is still open.
  async function handleCancel(id) {
    setError('')
    try {
      await apiJson(`/api/game/tournaments/${id}`, { method: 'DELETE' })
      // Remove from in-memory list
      setTournaments((prev) => prev.filter((t) => t.id !== id))
      // Remove from localStorage cache
      try {
        const stored = JSON.parse(localStorage.getItem('myTournaments') || '[]')
        const idx = stored.indexOf(id)
        if (idx >= 0) {
          stored.splice(idx, 1)
          localStorage.setItem('myTournaments', JSON.stringify(stored))
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel tournament')
    }
  }

  // Leave a tournament in which the user is a participant.  Posts to a leave
  // endpoint and then removes the tournament from local state and
  // localStorage. Only applicable while the tournament is open.
  async function handleLeave(id) {
    setError('')
    try {
      await apiJson(`/api/game/tournaments/${id}/leave`, { method: 'POST' })
      setTournaments((prev) => prev.filter((t) => t.id !== id))
      try {
        const stored = JSON.parse(localStorage.getItem('myTournaments') || '[]')
        const idx = stored.indexOf(id)
        if (idx >= 0) {
          stored.splice(idx, 1)
          localStorage.setItem('myTournaments', JSON.stringify(stored))
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.message || 'Failed to leave tournament')
    }
  }

  // On mount, load any persisted tournaments for this user from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('myTournaments') || '[]')
      if (Array.isArray(stored) && stored.length > 0) {
        // Fetch details for each stored id.  Use Promise.all to run in parallel.
        Promise.all(stored.map((id) => fetchAndStoreTournament(id)))
          .catch(() => { /* ignore errors */ })
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Determine if the user already participates in any active tournament.  An active
  // tournament is one that is not yet complete (status 'open' or 'in_progress') and
  // where the user is listed as a participant.  Recompute whenever tournaments
  // or currentUser changes.
  useEffect(() => {
    if (!currentUser) {
      setHasActiveTournament(false)
      return
    }
    const active = tournaments.some((t) => {
      const joined = t.participants?.some((p) => Number(p.user_id) === Number(currentUser.id))
      return joined && (t.status === 'open' || t.status === 'in_progress')
    })
    setHasActiveTournament(active)
  }, [tournaments, currentUser])

  // When a tournament in which the current user participates reaches its maximum
  // number of participants (i.e. is full) and is still open, automatically
  // redirect to that tournament's page.  This ensures all participants see
  // the bracket/leaderboard once the lobby is full.
  useEffect(() => {
    if (!currentUser) return
    tournaments.forEach((t) => {
      const joined = t.participants?.some((p) => Number(p.user_id) === Number(currentUser.id))
      const isFull = (t.participants?.length || 0) === (t.max_participants || 0)
      if (joined && isFull && t.status === 'open') {
        navigate(`/tournaments/${t.id}`)
      }
    })
  }, [tournaments, currentUser, navigate])

  // Navigate to bracket page
  function handleView(id) {
    navigate(`/tournaments/${id}`)
  }

  // Determine if the current user has joined a tournament
  function hasJoined(t) {
    if (!currentUser || !t.participants) return false
    return t.participants.some((p) => Number(p.user_id) === Number(currentUser.id))
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />
      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
              <div>
                <span className="arcade-display mb-3">Tournament hub</span>
                <h1 className="arcade-title mb-2">Tournaments</h1>
                <p className="arcade-copy mb-0">
                  Create a new tournament or join an existing one.  This view
                  lists tournaments you have created or joined.  Once a
                  tournament is full, its creator can start it from the
                  bracket page.
                </p>
              </div>
            </div>

            {/* Tournament creation form */}
            <div className="arcade-card soft p-4 mb-4">
              <h2 className="arcade-section-title mb-3">Create new tournament</h2>
              {hasActiveTournament && (
                <p className="arcade-copy text-warning mb-2">
                  You are currently registered in an active tournament. Leave or cancel it before creating or joining another.
                </p>
              )}
              <form onSubmit={handleCreate} className="row g-3 align-items-end">
                <div className="col-12 col-sm-6 col-md-5">
                  <label htmlFor="tournament-name" className="form-label">Name</label>
                  <input
                    id="tournament-name"
                    type="text"
                    className="form-control"
                    placeholder="Enter tournament name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-6 col-sm-3 col-md-2">
                  <label htmlFor="tournament-size" className="form-label">Slots</label>
                  <input
                    id="tournament-size"
                    type="number"
                    className="form-control"
                    min="2"
                    max="8"
                    step="1"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    required
                  />
                </div>
                <div className="col-6 col-sm-3 col-md-2">
                  <button
                    type="submit"
                    className="arcade-btn arcade-btn-primary w-100"
                    disabled={creating || !name || hasActiveTournament}
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
              {error && <p className="arcade-copy text-danger mt-2 mb-0">{error}</p>}

              {/* Manual join by ID */}
              <hr className="my-4" />
              <h2 className="arcade-section-title mb-3">Join by ID</h2>
              <form onSubmit={handleJoinById} className="row g-3 align-items-end">
                <div className="col-12 col-sm-6 col-md-5">
                  <label htmlFor="manual-id" className="form-label">Tournament ID</label>
                  <input
                    id="manual-id"
                    type="number"
                    className="form-control"
                    placeholder="Enter ID"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    min="1"
                  />
                </div>
                  <div className="col-6 col-sm-3 col-md-2">
                    <button
                      type="submit"
                      className="arcade-btn arcade-btn-secondary w-100"
                      disabled={joiningById || !manualId || hasActiveTournament}
                    >
                      {joiningById ? 'Processing...' : 'Join'}
                    </button>
                  </div>
              </form>
            </div>

            {/* List tournaments */}
            <div className="arcade-card soft p-4">
              <h2 className="arcade-section-title mb-3">Your tournaments</h2>
              {loadingUser && <p className="arcade-copy mb-0">Loading...</p>}
              {!loadingUser && tournaments.length === 0 && (
                <p className="arcade-copy mb-0">No tournaments yet. Create one above.</p>
              )}
              {!loadingUser && tournaments.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-dark table-striped align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Players</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournaments.map((t) => {
                        const joined = hasJoined(t)
                        const participantCount = t.participants?.length ?? 0
                        const isFull = participantCount >= (t.max_participants || 0)
                        const canJoin = !joined && t.status === 'open' && !isFull && !hasActiveTournament
                        return (
                          <tr key={t.id}>
                            <td>{t.name || `Tournament ${t.id}`}</td>
                            <td>{participantCount} / {t.max_participants}</td>
                            <td>{t.status}</td>
                            <td className="d-flex gap-2">
                              {canJoin && (
                                <button
                                  type="button"
                                  className="arcade-btn arcade-btn-secondary"
                                  onClick={() => handleJoin(t.id)}
                                >
                                  Join
                                </button>
                              )}
                              {joined && (
                                <>
                                  <span className="badge bg-success">Joined</span>
                                  {t.status === 'open' && Number(currentUser?.id) === Number(t.creator_id) && (
                                    <button
                                      type="button"
                                      className="arcade-btn arcade-btn-danger"
                                      onClick={() => handleCancel(t.id)}
                                    >
                                      Cancel
                                    </button>
                                  )}
                                  {t.status === 'open' && Number(currentUser?.id) !== Number(t.creator_id) && (
                                    <button
                                      type="button"
                                      className="arcade-btn arcade-btn-secondary"
                                      onClick={() => handleLeave(t.id)}
                                    >
                                      Leave
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                type="button"
                                className="arcade-btn arcade-btn-ghost"
                                onClick={() => handleView(t.id)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}