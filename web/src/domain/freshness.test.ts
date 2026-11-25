import { describe, expect, it } from 'vitest'
import { formatAge, isFeedStale, vehicleFreshness } from './freshness'

const NOW = Date.parse('2026-11-24T22:00:00-05:00')
const secondsAgo = (s: number) => NOW - s * 1000

describe('vehicleFreshness', () => {
  it('is live up to 2 minutes', () => {
    expect(vehicleFreshness(secondsAgo(19), NOW)).toBe('live')
    expect(vehicleFreshness(secondsAgo(120), NOW)).toBe('live')
  })

  it('is aging between 2 and 10 minutes', () => {
    expect(vehicleFreshness(secondsAgo(121), NOW)).toBe('aging')
    expect(vehicleFreshness(secondsAgo(410), NOW)).toBe('aging')
  })

  it('expires after 10 minutes', () => {
    expect(vehicleFreshness(secondsAgo(601), NOW)).toBe('expired')
  })

  it('treats a report slightly in the future as live', () => {
    expect(vehicleFreshness(NOW + 5000, NOW)).toBe('live')
  })
})

describe('feed staleness and formatting', () => {
  it('marks the feed stale after 45 seconds', () => {
    expect(isFeedStale(secondsAgo(44), NOW)).toBe(false)
    expect(isFeedStale(secondsAgo(46), NOW)).toBe(true)
  })

  it('formats short ages', () => {
    expect(formatAge(secondsAgo(8), NOW)).toBe('8s')
    expect(formatAge(secondsAgo(250), NOW)).toBe('4m')
  })
})
