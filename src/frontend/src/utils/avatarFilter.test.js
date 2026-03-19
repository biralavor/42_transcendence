// src/frontend/src/utils/avatarFilter.test.js
import { describe, it, expect } from 'vitest'
import { getAvatarFilter } from './avatarFilter'

describe('getAvatarFilter', () => {
  it('returns a CSS filter string', () => {
    expect(getAvatarFilter(1)).toMatch(/^hue-rotate\(\d+deg\) saturate\(\d+%\)$/)
  })

  it('produces different filters for different IDs', () => {
    const filters = [1, 2, 3, 4, 5].map(getAvatarFilter)
    expect(new Set(filters).size).toBe(5)
  })

  it('hue is always in [0, 359]', () => {
    for (let id = 1; id <= 50; id++) {
      const hue = parseInt(getAvatarFilter(id).match(/hue-rotate\((\d+)deg\)/)[1])
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('saturation is always in [100, 179]', () => {
    for (let id = 1; id <= 50; id++) {
      const sat = parseInt(getAvatarFilter(id).match(/saturate\((\d+)%\)/)[1])
      expect(sat).toBeGreaterThanOrEqual(100)
      expect(sat).toBeLessThan(180)
    }
  })
})
