import { describe, it, expect } from 'vitest'
import { formatRank } from './formatRank'

describe('formatRank', () => {
  it('renders a two-digit zero-padded integer rank', () => {
    expect(formatRank(4)).toBe('Rank #04')
    expect(formatRank(9)).toBe('Rank #09')
  })

  it('does not pad ranks above 99', () => {
    expect(formatRank(123)).toBe('Rank #123')
  })

  it('returns "Rank —" for null', () => {
    expect(formatRank(null)).toBe('Rank —')
  })

  it('returns "Rank —" for undefined', () => {
    expect(formatRank(undefined)).toBe('Rank —')
  })
})
