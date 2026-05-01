import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import {
  ChartA11yTable,
  GamesPerDayChart,
  MessagesPerDayChart,
} from '../Components/ActivityCharts'
import { apiCall } from '../utils/apiClient'
import { exportAdminPdf } from '../utils/adminPdfExport'
import './Admin.css'

const ADMIN_POLL_INTERVAL_MS = 5000
const MAX_WINDOW_DAYS = 30

function todayUtcIso() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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

  const today = useMemo(() => todayUtcIso(), [])
  const minStart = useMemo(() => isoDaysAgo(MAX_WINDOW_DAYS - 1), [])
  const defaultStart = minStart
  const defaultEnd = today
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const gamesChartRef = useRef(null)
  const messagesChartRef = useRef(null)

  function handleExportPdf() {
    if (!stats) return
    const gamesCanvas = gamesChartRef.current?.querySelector('canvas') ?? null
    const messagesCanvas = messagesChartRef.current?.querySelector('canvas') ?? null
    exportAdminPdf({ stats, gamesCanvas, messagesCanvas })
  }

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
    if (start > end) {
      setError('Start date must be on or before end date.')
      setStats(null)
      return
    }

    let cancelled = false
    let timeoutId = null
    let controller = null

    async function load() {
      if (cancelled) return
      controller = new AbortController()
      try {
        const url = `/api/users/admin/activity?start=${start}&end=${end}`
        const resp = await apiCall(url, { signal: controller.signal })
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
  }, [meStatus, start, end])

  if (meStatus === 'forbidden') {
    return <Navigate to="/" replace />
  }

  const games = stats?.games_per_day ?? []
  const messages = stats?.messages_per_day ?? []

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
                  Site-wide activity for the selected window. Pick any range up to
                  the last {MAX_WINDOW_DAYS} days.
                </p>
              </div>
            </div>

            {meStatus === 'loading' && (
              <p className="arcade-copy mb-0">Loading admin stats...</p>
            )}

            {meStatus === 'admin' && (
              <>
                <div className="admin-filters">
                  <label>
                    Start
                    <input
                      type="date"
                      value={start}
                      min={minStart}
                      max={end}
                      onChange={e => setStart(e.target.value)}
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="date"
                      value={end}
                      min={start}
                      max={today}
                      onChange={e => setEnd(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-secondary"
                    onClick={() => { setStart(defaultStart); setEnd(defaultEnd) }}
                  >
                    Reset (last {MAX_WINDOW_DAYS} days)
                  </button>
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-primary"
                    onClick={handleExportPdf}
                    disabled={!stats || !!error}
                  >
                    Export PDF
                  </button>
                </div>

                {error && (
                  <p className="arcade-copy mb-0 text-danger">{error}</p>
                )}

                {!error && !stats && (
                  <p className="arcade-copy mb-0">Loading admin stats...</p>
                )}

                {!error && stats && (
                  <>
                    <p className="admin-filter-caption">
                      Showing {stats.range_start} → {stats.range_end}
                    </p>

                    <div className="row g-4 admin-stats">
                      <StatCard label="Active users" value={stats.active_users} />
                      <StatCard label="Games" value={stats.games_total} />
                      <StatCard label="Messages" value={stats.messages_total} />
                    </div>

                    <div className="activity-chart-block" ref={gamesChartRef}>
                      <h2 className="arcade-kicker mb-2">Games per day</h2>
                      <GamesPerDayChart points={games} />
                      <ChartA11yTable caption="Games played per day (selected window)" rows={games} />
                    </div>

                    <div className="activity-chart-block" ref={messagesChartRef}>
                      <h2 className="arcade-kicker mb-2">Messages per day</h2>
                      <MessagesPerDayChart points={messages} />
                      <ChartA11yTable caption="Messages sent per day (selected window)" rows={messages} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
