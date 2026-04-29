import { describe, it, expect, beforeEach } from 'vitest'
import wsLogger from './wsLogger'

beforeEach(() => {
  wsLogger.clear()
})

describe('wsLogger', () => {
  it('exposes a singleton with the public API', () => {
    expect(typeof wsLogger.getTimestamp).toBe('function')
    expect(typeof wsLogger.ready).toBe('function')
    expect(typeof wsLogger.send).toBe('function')
    expect(typeof wsLogger.receive).toBe('function')
    expect(typeof wsLogger.connection).toBe('function')
    expect(typeof wsLogger.uiUpdate).toBe('function')
    expect(typeof wsLogger.latency).toBe('function')
    expect(typeof wsLogger.flowStart).toBe('function')
    expect(typeof wsLogger.flowEnd).toBe('function')
    expect(typeof wsLogger.export).toBe('function')
    expect(typeof wsLogger.clear).toBe('function')
    expect(typeof wsLogger.summary).toBe('function')
  })

  it('getTimestamp returns a non-negative number from performance.now', () => {
    const t = wsLogger.getTimestamp()
    expect(typeof t).toBe('number')
    expect(t).toBeGreaterThanOrEqual(0)
  })

  it('clear() empties the events buffer', () => {
    wsLogger.clear()
    expect(wsLogger.export().eventCount).toBe(0)
  })

  it('export() returns a shape with exportedAt, eventCount, and events array', () => {
    const dump = wsLogger.export()
    expect(dump).toHaveProperty('exportedAt')
    expect(dump).toHaveProperty('eventCount')
    expect(Array.isArray(dump.events)).toBe(true)
    expect(typeof dump.exportedAt).toBe('string')
    // ISO 8601 sanity check
    expect(() => new Date(dump.exportedAt).toISOString()).not.toThrow()
  })

  it('summary() returns totals and a byType map even on empty buffer', () => {
    const s = wsLogger.summary()
    expect(s.totalEvents).toBe(0)
    expect(s.byType).toEqual({})
    expect(s.timeSpan).toBeNull()
  })

  it('latency() returns a non-negative number and records a latency event', () => {
    const start = wsLogger.getTimestamp()
    const result = wsLogger.latency('test-label', start)
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
    const dump = wsLogger.export()
    expect(dump.eventCount).toBeGreaterThan(0)
    expect(dump.events.some(e => e.type === 'latency' && e.label === 'test-label')).toBe(true)
  })

  it('flowStart() returns a timestamp usable as a latency anchor', () => {
    const ts = wsLogger.flowStart('room-1', 'test-flow')
    expect(typeof ts).toBe('number')
    expect(ts).toBeGreaterThanOrEqual(0)
  })

  it('ring buffer caps at maxEvents and discards oldest entries', () => {
    // The class caps `events` at 100 entries (maxEvents). Logging 105 should
    // leave exactly 100 in the buffer, with the earliest 5 evicted.
    for (let i = 0; i < 105; i++) {
      wsLogger.send(`room-${i}`, { i })
    }
    expect(wsLogger.export().eventCount).toBe(100)
    const dump = wsLogger.export()
    expect(dump.events[0].roomId).toBe('room-5')
    expect(dump.events[99].roomId).toBe('room-104')
  })
})
