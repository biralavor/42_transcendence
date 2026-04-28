import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { apiCall } from '../utils/apiClient'
import './Admin.css'

const ADMIN_POLL_INTERVAL_MS = 5000

function StatCard({ label, value }) {
  return (
    <div className="col-12 col-md-4">
      <article className="arcade-card h-100 text-center admin-stat-card">
        <p className="arcade-kicker mb-2">{label}</p>
        <div className="arcade-title mb-0" style={{ fontSize: '2.4rem' }}>
          {value}
        </div>
      </article>
    </div>
  )
}

export default function Admin() {
  const [meStatus, setMeStatus] = useState('loading') // 'loading' | 'admin' | 'forbidden'
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiCall('/api/users/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (data?.is_admin) {
          setMeStatus('admin')
        } else {
          setMeStatus('forbidden')
        }
      })
      .catch(() => { if (!cancelled) setMeStatus('forbidden') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (meStatus !== 'admin') return

    let cancelled = false
    let timeoutId = null
    let controller = null

    async function load() {
      if (cancelled) return
      controller = new AbortController()
      try {
        const resp = await apiCall('/api/users/admin/activity', { signal: controller.signal })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (cancelled) return
        setStats(data)
        setError('')
      } catch (err) {
        if (err.name !== 'AbortError' && !cancelled) {
          setError('Failed to load admin stats.')
        }
      }
      // Schedule the next poll only while the tab is visible. visibilitychange
      // resumes polling on focus return.
      if (!cancelled && !document.hidden) {
        timeoutId = setTimeout(load, ADMIN_POLL_INTERVAL_MS)
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      } else if (timeoutId === null) {
        load()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    load()

    return () => {
      cancelled = true
      if (controller) controller.abort()
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [meStatus])

  if (meStatus === 'forbidden') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
              <div>
                <span className="arcade-display mb-3">Operations</span>
                <h1 className="arcade-title mb-2">Admin</h1>
                <p className="arcade-copy mb-0">
                  Site-wide activity at a glance. Active users count anyone who logged
                  in within the last 7 days.
                </p>
              </div>
            </div>

            {meStatus === 'loading' && (
              <p className="arcade-copy mb-0">Loading admin stats...</p>
            )}

            {meStatus === 'admin' && error && (
              <p className="arcade-copy mb-0 text-danger">{error}</p>
            )}

            {meStatus === 'admin' && !error && !stats && (
              <p className="arcade-copy mb-0">Loading admin stats...</p>
            )}

            {meStatus === 'admin' && stats && (
              <div className="row g-4 admin-stats">
                <StatCard label="Active users (last 7 days)" value={stats.active_users_last_7d} />
                <StatCard label="Games today" value={stats.games_today} />
                <StatCard label="Messages today" value={stats.messages_today} />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
