import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { useAuth } from '../context/authContext'
import { apiCall, apiJson } from '../utils/apiClient'

export default function Tournaments() {
  const navigate = useNavigate()
  const { auth } = useAuth()
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [tournaments, setTournaments] = useState([])
  const [name, setName] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('4')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [hasActiveTournament, setHasActiveTournament] = useState(false)
  const [manualId, setManualId] = useState('')
  const [joiningById, setJoiningById] = useState(false)

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

  async function fetchAndStoreTournament(id) {
    try {
      const resp = await apiCall(`/api/game/tournaments/${id}`)
      if (!resp.ok) throw new Error('Failed to load tournament details')
      const data = await resp.json()

      setTournaments((prev) => {
        const idx = prev.findIndex((t) => t.id === data.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = data
          return updated
        }
        return [...prev, data]
      })

      return data
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load tournament details')
    }
  }

  async function loadTournaments() {
    try {
      setError('')
      const resp = await apiCall('/api/game/tournaments')
      if (!resp.ok) throw new Error('Failed to load tournaments')
      const data = await resp.json()
      setTournaments(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load tournaments')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name || creating) return

    if (hasActiveTournament) {
      setError('You are already registered in an active tournament. You cannot create another one right now.')
      return
    }

    setError('')
    setCreating(true)

    try {
      const slots = Number(maxParticipants)
      if (slots < 4 || slots > 8) {
        throw new Error('Tournament size must be between 4 and 8 players')
      }

      const body = { name, max_participants: slots }
      const data = await apiJson('/api/game/tournaments', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (data?.id) {
        await loadTournaments()
      }

      setName('')
      setMaxParticipants('4')
    } catch (err) {
      setError(err.message || 'Failed to create tournament')
    } finally {
      setCreating(false)
    }
  }

  async function handleLeave(id) {
    setError('')
    try {
      await apiJson(`/api/game/tournaments/${id}/leave`, { method: 'POST' })
      await loadTournaments()
    } catch (err) {
      setError(err.message || 'Failed to leave tournament')
    }
  }

  async function handleCancel(id) {
    setError('')
    try {
      await apiJson(`/api/game/tournaments/${id}`, { method: 'DELETE' })
      await loadTournaments()
    } catch (err) {
      setError(err.message || 'Failed to cancel tournament')
    }
  }

  async function handleJoin(id) {
    setError('')

    if (hasActiveTournament) {
      const existing = tournaments.find((t) => t.id === id)
      const alreadyJoined = existing?.participants?.some(
        (p) => Number(p.user_id) === Number(currentUser?.id),
      )

      if (!alreadyJoined) {
        setError('You are already registered in an active tournament. You cannot join another one right now.')
        return
      }
    }

    try {
      await apiJson(`/api/game/tournaments/${id}/join`, {
        method: 'POST',
      })

      const data = await fetchAndStoreTournament(id)
      await loadTournaments()

      if (data && data.participants && data.participants.length === data.max_participants) {
        navigate(`/tournaments/${id}`)
      }
    } catch (err) {
      setError(err.message || 'Failed to join tournament')
    }
  }

  async function handleJoinById(e) {
    e.preventDefault()
    const idNum = Number(manualId)
    if (!idNum || joiningById) return

    setError('')
    setJoiningById(true)

    try {
      if (hasActiveTournament) {
        const existing = tournaments.find((t) => t.id === idNum)
        const alreadyJoinedExisting = existing?.participants?.some(
          (p) => Number(p.user_id) === Number(currentUser?.id),
        )

        if (!alreadyJoinedExisting) {
          setError('You are already registered in an active tournament. You cannot join another one right now.')
          return
        }
      }

      const resp = await apiCall(`/api/game/tournaments/${idNum}`)
      if (!resp.ok) {
        if (resp.status === 404) throw new Error('Tournament not found')
        throw new Error('Failed to fetch tournament')
      }

      const data = await resp.json()
      const joined = data.participants?.some(
        (p) => Number(p.user_id) === Number(currentUser?.id),
      )

      if (!joined && data.status === 'open' && data.participants?.length < data.max_participants) {
        await apiJson(`/api/game/tournaments/${idNum}/join`, { method: 'POST' })
      }

      await fetchAndStoreTournament(idNum)
      await loadTournaments()
      setManualId('')
    } catch (err) {
      setError(err.message || 'Could not join tournament')
    } finally {
      setJoiningById(false)
    }
  }

  useEffect(() => {
    loadTournaments()
  }, [])

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

  function handleView(id) {
    navigate(`/tournaments/${id}`)
  }

  function isActiveTournament(t) {
  return t?.status === 'open' || t?.status === 'in_progress'
}

function hasJoined(t) {
  if (!currentUser || !t.participants) return false
  if (!isActiveTournament(t)) return false

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
                  Create a new tournament or join an existing one. This view
                  lists tournaments you have created or joined. Once a
                  tournament is full, its creator can start it from the
                  tournament page.
                </p>
              </div>
            </div>

            <div className="arcade-card soft p-4 mb-4">
              <h2 className="arcade-section-title mb-3">Create new tournament</h2>
              {hasActiveTournament && (
                <p className="arcade-copy text-warning mb-2">
                  You are currently registered in an active tournament. You cannot create or join another one right now.
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
                    min="4"
                    max="8"
                    step="1"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    required
                  />
                  <small className="form-text text-muted">Choose between 4 and 8 players.</small>
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

            <div className="arcade-card soft p-4">
              <h2 className="arcade-section-title mb-3">Tournaments</h2>

              {loadingUser && <p className="arcade-copy mb-0">Loading...</p>}

              {!loadingUser && tournaments.length === 0 && (
                <p className="arcade-copy mb-0">No tournaments yet. Create one above.</p>
              )}

              {!loadingUser && tournaments.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-dark table-striped align-middle">
                    <thead>
                      <tr>
                        <th>ID</th>
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
                            <td>{t.id}</td>
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
                                  {t.status === 'open' && Number(currentUser?.id) === Number(t.creator_id) ? (
                                    <button
                                      type="button"
                                      className="arcade-btn arcade-btn-danger"
                                      onClick={() => handleCancel(t.id)}
                                    >
                                      Cancel
                                    </button>
                                  ) : t.status === 'open' ? (
                                    <button
                                      type="button"
                                      className="arcade-btn arcade-btn-secondary"
                                      onClick={() => handleLeave(t.id)}
                                    >
                                      Leave
                                    </button>
                                  ) : null}
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