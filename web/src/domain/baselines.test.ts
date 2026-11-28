import { describe, expect, it } from 'vitest'
import {
  dateRangeText,
  reliabilityByHour,
  serviceOrder,
  serviceSlot,
  usualTrains,
  type Baselines,
} from './baselines'

const at = (iso: string) => Date.parse(iso)

const baselines: Baselines = {
  source: {
    name: 'MBTA LAMP subway on-time performance',
    fromDate: 20261003,
    toDate: 20261127,
    days: 56,
    events: 2160710,
    importedAt: 0,
  },
  trains: [
    { line: 'Red', day_type: 'weekday', hour: 8, typical_trains: 21, days: 40 },
    { line: 'Red', day_type: 'weekday', hour: 1, typical_trains: 6, days: 40 },
    { line: 'Red', day_type: 'saturday', hour: 14, typical_trains: 16, days: 8 },
    { line: 'Blue', day_type: 'sunday', hour: 6, typical_trains: 4, days: 2 },
  ],
  headways: [
    {
      line: 'Red',
      direction_id: 0,
      day_type: 'weekday',
      hour: 8,
      samples: 300,
      median_seconds: 300,
      p90_seconds: 700,
      scheduled_median_seconds: 300,
      reliable_share: 0.8,
    },
    {
      line: 'Red',
      direction_id: 1,
      day_type: 'weekday',
      hour: 8,
      samples: 100,
      median_seconds: 300,
      p90_seconds: 700,
      scheduled_median_seconds: 300,
      reliable_share: 0.4,
    },
    {
      line: 'Red',
      direction_id: 0,
      day_type: 'weekday',
      hour: 0,
      samples: 50,
      median_seconds: 600,
      p90_seconds: 900,
      scheduled_median_seconds: 600,
      reliable_share: 0.9,
    },
    {
      line: 'Red',
      direction_id: 0,
      day_type: 'weekday',
      hour: 5,
      samples: 50,
      median_seconds: 600,
      p90_seconds: 900,
      scheduled_median_seconds: 600,
      reliable_share: 1,
    },
  ],
}

describe('serviceSlot', () => {
  it('uses the Boston hour and day', () => {
    expect(serviceSlot(at('2026-11-27T08:30:00-05:00'))).toEqual({ dayType: 'weekday', hour: 8 })
    expect(serviceSlot(at('2026-11-28T14:10:00-05:00'))).toEqual({ dayType: 'saturday', hour: 14 })
  })

  it('counts the small hours as the previous day’s service', () => {
    // 1:30 a.m. Saturday is still Friday's (weekday) service.
    expect(serviceSlot(at('2026-11-28T01:30:00-05:00'))).toEqual({ dayType: 'weekday', hour: 1 })
    // 2 a.m. Monday is still Sunday's.
    expect(serviceSlot(at('2026-11-30T02:00:00-05:00'))).toEqual({ dayType: 'sunday', hour: 2 })
  })
})

describe('usualTrains (B4)', () => {
  it('finds the typical count for this line, day type and hour', () => {
    expect(usualTrains(baselines, 'Red', at('2026-11-27T08:45:00-05:00'))).toEqual({
      typical: 21,
      days: 40,
      dayType: 'weekday',
      hour: 8,
    })
    expect(usualTrains(baselines, 'Red', at('2026-11-28T01:10:00-05:00'))?.typical).toBe(6)
  })

  it('says nothing rather than guess: no row, or too few days', () => {
    expect(usualTrains(baselines, 'Orange', at('2026-11-27T08:45:00-05:00'))).toBeNull()
    expect(usualTrains(baselines, 'Blue', at('2026-11-29T06:30:00-05:00'))).toBeNull()
  })
})

describe('reliabilityByHour (B5)', () => {
  it('weights directions by how many gaps each had, in service-day order', () => {
    const rows = reliabilityByHour(baselines, 'Red', 'weekday')
    expect(rows.map((r) => r.hour)).toEqual([5, 8, 0])
    expect(rows.every((r) => r.samples >= 50)).toBe(true)
    const eight = rows.find((r) => r.hour === 8)!
    expect(eight.share).toBeCloseTo((0.8 * 300 + 0.4 * 100) / 400, 6)
    expect(eight.samples).toBe(400)
  })

  it('orders after-midnight hours last', () => {
    expect(serviceOrder(1)).toBe(25)
    expect(serviceOrder(5)).toBe(5)
  })
})

describe('thin data (B4, B5)', () => {
  it('leaves out hours with too few gaps to measure', () => {
    const thin: Baselines = {
      ...baselines,
      headways: [{ ...baselines.headways[0], hour: 4, samples: 6, reliable_share: 0 }],
    }
    expect(reliabilityByHour(thin, 'Red', 'weekday')).toEqual([])
  })
})

describe('dateRangeText', () => {
  it('names the source period', () => {
    expect(dateRangeText(20261003, 20261127)).toBe('Oct 3 – Nov 27')
  })
})
