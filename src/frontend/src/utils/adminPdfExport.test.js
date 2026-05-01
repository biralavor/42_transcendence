import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSave = vi.fn()
const mockText = vi.fn()
const mockAddImage = vi.fn()
const mockAddPage = vi.fn()
const mockSetFont = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetLineWidth = vi.fn()
const mockLine = vi.fn()

const mockDocInstance = {
  save: mockSave,
  text: mockText,
  addImage: mockAddImage,
  addPage: mockAddPage,
  setFont: mockSetFont,
  setFontSize: mockSetFontSize,
  setLineWidth: mockSetLineWidth,
  line: mockLine,
  internal: {
    pageSize: { getWidth: () => 595, getHeight: () => 842 },
  },
}

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => mockDocInstance),
}))

import { exportAdminPdf } from './adminPdfExport'
import { jsPDF } from 'jspdf'

function fakeCanvas() {
  return {
    width: 800,
    height: 400,
    toDataURL: vi.fn(() => 'data:image/png;base64,FAKE'),
  }
}

const baseStats = {
  range_start: '2026-04-01',
  range_end: '2026-04-30',
  active_users: 12,
  games_total: 5,
  messages_total: 34,
  games_per_day: [
    { date: '2026-04-28', count: 2 },
    { date: '2026-04-29', count: 3 },
  ],
  messages_per_day: [
    { date: '2026-04-28', count: 7 },
  ],
}

describe('exportAdminPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws if stats is missing', () => {
    expect(() => exportAdminPdf({ stats: null })).toThrow(/stats is required/)
  })

  it('saves a pdf using the date range in the filename', () => {
    exportAdminPdf({ stats: baseStats, gamesCanvas: null, messagesCanvas: null })
    expect(jsPDF).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledWith(
      'admin-analytics-2026-04-01_to_2026-04-30.pdf',
    )
  })

  it('writes the totals into the document', () => {
    exportAdminPdf({ stats: baseStats, gamesCanvas: null, messagesCanvas: null })
    const written = mockText.mock.calls.map(c => c[0])
    expect(written).toContain('Admin Analytics Report')
    expect(written).toContain('Range: 2026-04-01 -> 2026-04-30')
    expect(written).toContain('Active users: 12')
    expect(written).toContain('Games: 5')
    expect(written).toContain('Messages: 34')
  })

  it('embeds chart canvases as PNG images when provided', () => {
    const games = fakeCanvas()
    const messages = fakeCanvas()
    exportAdminPdf({ stats: baseStats, gamesCanvas: games, messagesCanvas: messages })

    expect(games.toDataURL).toHaveBeenCalledWith('image/png')
    expect(messages.toDataURL).toHaveBeenCalledWith('image/png')
    expect(mockAddImage).toHaveBeenCalledTimes(2)
    for (const call of mockAddImage.mock.calls) {
      expect(call[0]).toBe('data:image/png;base64,FAKE')
      expect(call[1]).toBe('PNG')
    }
  })

  it('skips chart embedding when canvas is null but still writes the data tables', () => {
    exportAdminPdf({ stats: baseStats, gamesCanvas: null, messagesCanvas: null })
    expect(mockAddImage).not.toHaveBeenCalled()
    const written = mockText.mock.calls.map(c => c[0])
    expect(written).toContain('Games per day (data)')
    expect(written).toContain('Messages per day (data)')
    expect(written).toContain('2026-04-29')
  })
})
