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
import './ActivityCharts.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

function formatDateLabel(iso) {
  // Short label (MM-DD) for chart axis. The full date stays in the a11y table.
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${m}-${day}`
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

export function ChartA11yTable({ caption, rows }) {
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

export function GamesPerDayChart({ points, ariaLabelPrefix = 'Bar chart of games played per day' }) {
  const total = points.reduce((a, p) => a + p.count, 0)
  const data = {
    labels: points.map(p => formatDateLabel(p.date)),
    datasets: [{
      label: 'Games',
      data: points.map(p => p.count),
      backgroundColor: 'rgba(94, 234, 212, 0.55)',
      borderColor: 'rgba(94, 234, 212, 1)',
      borderWidth: 1,
    }],
  }
  return (
    <div
      className="activity-chart"
      role="img"
      aria-label={`${ariaLabelPrefix}. Total: ${total}.`}
    >
      <Bar data={data} options={baseChartOptions} />
    </div>
  )
}

export function MessagesPerDayChart({ points, ariaLabelPrefix = 'Line chart of messages sent per day' }) {
  const total = points.reduce((a, p) => a + p.count, 0)
  const data = {
    labels: points.map(p => formatDateLabel(p.date)),
    datasets: [{
      label: 'Messages',
      data: points.map(p => p.count),
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
    <div
      className="activity-chart"
      role="img"
      aria-label={`${ariaLabelPrefix}. Total: ${total}.`}
    >
      <Line data={data} options={baseChartOptions} />
    </div>
  )
}
