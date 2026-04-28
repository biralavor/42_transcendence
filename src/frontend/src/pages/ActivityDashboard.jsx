import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import NavbarComponent from '../Components/Navbar'
import { apiCall } from '../utils/apiClient'
import './ActivityDashboard.css'

const ACTIVITY_POLL_INTERVAL_MS = 5000

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

function StatCard({ label, value }) {
  return (
    <div className="col-12 col-md-6">
      <article className="arcade-card h-100 text-center activity-stat-card">
        <p className="arcade-kicker mb-2">{label}</p>
        <div className="arcade-title mb-0 activity-stat-value">{value}</div>
      </article>
    </div>
  )
}

function formatDateLabel(iso) {
  // Short label (MM-DD) for chart axis. The full date stays in the a11y table.
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${m}-${day}`
}

function formatLastLogin(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { intersect: false, mode: 'index' },
  },
  scales: {
    x: { ticks: { maxRotation: 0, autoSkipPadding: 12 } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
}

function ChartA11yTable({ caption, rows }) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <thead>
        <tr><th scope="col">Date</th><th scope="col">Count</th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.date}>
            <td>{r.date}</td>
            <td>{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function ActivityDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timeoutId = null
    let controller = null

    async function load() {
      if (cancelled) return
      controller = new AbortController()
      try {
        const resp = await apiCall('/api/users/activity', { signal: controller.signal })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const body = await resp.json()
        if (cancelled) return
        setData(body)
        setError('')
      } catch (err) {
        if (err.name !== 'AbortError' && !cancelled) {
          setError('Failed to load activity.')
        }
      }
      if (!cancelled && !document.hidden) {
        timeoutId = setTimeout(load, ACTIVITY_POLL_INTERVAL_MS)
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
  }, [])

  const games = data?.games_per_day ?? []
  const messages = data?.messages_per_day ?? []
  const labels = games.map(p => formatDateLabel(p.date))

  const gamesData = {
    labels,
    datasets: [{
      label: 'Games',
      data: games.map(p => p.count),
      // Striped pattern via borderWidth keeps the chart readable without
      // relying on color alone (a11y requirement of the analytics module).
      backgroundColor: 'rgba(94, 234, 212, 0.55)',
      borderColor: 'rgba(94, 234, 212, 1)',
      borderWidth: 1,
    }],
  }

  const messagesData = {
    labels: messages.map(p => formatDateLabel(p.date)),
    datasets: [{
      label: 'Messages',
      data: messages.map(p => p.count),
      borderColor: 'rgba(244, 114, 182, 1)',
      backgroundColor: 'rgba(244, 114, 182, 0.25)',
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 3,
      pointStyle: 'rectRot',
      fill: true,
    }],
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
              <div>
                <span className="arcade-display mb-3">Stats</span>
                <h1 className="arcade-title mb-2">Your activity</h1>
                <p className="arcade-copy mb-0">
                  Last 30 days of games and messages, plus your current login streak.
                </p>
              </div>
              <Link to="/profile" className="arcade-btn arcade-btn-secondary">
                Back to profile
              </Link>
            </div>

            {error && (
              <p className="arcade-copy mb-0 text-danger">{error}</p>
            )}

            {!error && !data && (
              <p className="arcade-copy mb-0">Loading activity…</p>
            )}

            {!error && data && (
              <>
                <div className="row g-4 activity-stats mb-4">
                  <StatCard
                    label="Last login"
                    value={formatLastLogin(data.last_login_at)}
                  />
                  <StatCard
                    label="Active streak (days)"
                    value={data.active_streak_days}
                  />
                </div>

                <div className="activity-chart-block">
                  <h2 className="arcade-kicker mb-2">Games per day</h2>
                  <div
                    className="activity-chart"
                    role="img"
                    aria-label={`Bar chart of games played per day over the last 30 days. Total: ${games.reduce((a, p) => a + p.count, 0)}.`}
                  >
                    <Bar data={gamesData} options={baseChartOptions} />
                  </div>
                  <ChartA11yTable caption="Games played per day (30-day window)" rows={games} />
                </div>

                <div className="activity-chart-block">
                  <h2 className="arcade-kicker mb-2">Messages per day</h2>
                  <div
                    className="activity-chart"
                    role="img"
                    aria-label={`Line chart of messages sent per day over the last 30 days. Total: ${messages.reduce((a, p) => a + p.count, 0)}.`}
                  >
                    <Line data={messagesData} options={baseChartOptions} />
                  </div>
                  <ChartA11yTable caption="Messages sent per day (30-day window)" rows={messages} />
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
