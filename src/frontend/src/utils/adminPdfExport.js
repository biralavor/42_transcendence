import { jsPDF } from 'jspdf'

const PAGE_MARGIN = 40
const LINE_HEIGHT = 16

function ensureSpace(doc, y, needed) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - PAGE_MARGIN) {
    doc.addPage()
    return PAGE_MARGIN
  }
  return y
}

function drawHeader(doc, stats) {
  let y = PAGE_MARGIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Admin Analytics Report', PAGE_MARGIN, y)
  y += LINE_HEIGHT * 1.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Range: ${stats.range_start} -> ${stats.range_end}`, PAGE_MARGIN, y)
  y += LINE_HEIGHT
  doc.text(`Generated: ${new Date().toISOString()}`, PAGE_MARGIN, y)
  y += LINE_HEIGHT * 1.5
  return y
}

function drawTotals(doc, stats, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Totals', PAGE_MARGIN, y)
  y += LINE_HEIGHT

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Active users: ${stats.active_users}`, PAGE_MARGIN, y)
  y += LINE_HEIGHT
  doc.text(`Games: ${stats.games_total}`, PAGE_MARGIN, y)
  y += LINE_HEIGHT
  doc.text(`Messages: ${stats.messages_total}`, PAGE_MARGIN, y)
  y += LINE_HEIGHT * 1.5
  return y
}

function drawChart(doc, title, canvas, y) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const maxWidth = pageWidth - PAGE_MARGIN * 2
  const ratio = canvas.height / canvas.width
  const drawWidth = maxWidth
  const drawHeight = drawWidth * ratio

  y = ensureSpace(doc, y, LINE_HEIGHT + drawHeight + LINE_HEIGHT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title, PAGE_MARGIN, y)
  y += LINE_HEIGHT * 0.5

  const dataUrl = canvas.toDataURL('image/png')
  doc.addImage(dataUrl, 'PNG', PAGE_MARGIN, y, drawWidth, drawHeight)
  y += drawHeight + LINE_HEIGHT
  return y
}

function drawTable(doc, title, rows, y) {
  y = ensureSpace(doc, y, LINE_HEIGHT * 3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, PAGE_MARGIN, y)
  y += LINE_HEIGHT

  doc.setFontSize(10)
  doc.text('Date', PAGE_MARGIN, y)
  doc.text('Count', PAGE_MARGIN + 120, y)
  y += LINE_HEIGHT * 0.75
  doc.setLineWidth(0.5)
  doc.line(PAGE_MARGIN, y - LINE_HEIGHT * 0.5, PAGE_MARGIN + 200, y - LINE_HEIGHT * 0.5)

  doc.setFont('helvetica', 'normal')
  for (const row of rows) {
    y = ensureSpace(doc, y, LINE_HEIGHT)
    doc.text(String(row.date), PAGE_MARGIN, y)
    doc.text(String(row.count), PAGE_MARGIN + 120, y)
    y += LINE_HEIGHT * 0.85
  }
  return y + LINE_HEIGHT * 0.5
}

export function exportAdminPdf({ stats, gamesCanvas, messagesCanvas }) {
  if (!stats) throw new Error('exportAdminPdf: stats is required')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let y = drawHeader(doc, stats)
  y = drawTotals(doc, stats, y)

  if (gamesCanvas) y = drawChart(doc, 'Games per day', gamesCanvas, y)
  y = drawTable(doc, 'Games per day (data)', stats.games_per_day ?? [], y)

  if (messagesCanvas) y = drawChart(doc, 'Messages per day', messagesCanvas, y)
  y = drawTable(doc, 'Messages per day (data)', stats.messages_per_day ?? [], y)

  const filename = `admin-analytics-${stats.range_start}_to_${stats.range_end}.pdf`
  doc.save(filename)
}
