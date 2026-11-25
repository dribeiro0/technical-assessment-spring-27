import { describe, expect, it } from 'vitest'
import type { PredictionsDocument } from '../api/mbtaTypes'
import {
  minutesAway,
  progressToNextStop,
  shortEta,
  stillAhead,
  stripStops,
  upcomingStops,
} from './predictions'

function prediction(
  id: string,
  stop: string,
  sequence: number,
  arrival: string | null,
  rel: string | null = null,
) {
  return {
    type: 'prediction',
    id,
    attributes: {
      arrival_time: arrival,
      departure_time: null,
      stop_sequence: sequence,
      schedule_relationship: rel,
    },
    relationships: { stop: { data: { type: 'stop', id: stop } } },
  }
}

// Modelled on a real Red Line trip toward Alewife (November 25, 2026), given out of order.
const doc: PredictionsDocument = {
  data: [
    prediction('p3', '70061', 220, '2026-11-25T00:57:48-05:00'),
    prediction('p1', '70065', 200, '2026-11-25T00:52:35-05:00'),
    prediction('p2', '70063', 210, '2026-11-25T00:54:29-05:00'),
    prediction('px', '70099', 205, '2026-11-25T00:53:00-05:00', 'SKIPPED'),
  ],
  included: [
    { type: 'stop', id: '70065', attributes: { name: 'Porter' } },
    { type: 'stop', id: '70063', attributes: { name: 'Davis' } },
    { type: 'stop', id: '70061', attributes: { name: 'Alewife' } },
  ],
}

const NOW = Date.parse('2026-11-25T00:51:30-05:00')

describe('upcomingStops', () => {
  it('orders stops by sequence, names them and drops skipped stops', () => {
    expect(upcomingStops(doc).map((s) => s.name)).toEqual(['Porter', 'Davis', 'Alewife'])
  })

  it('keeps the arrival estimate', () => {
    expect(upcomingStops(doc)[0].at).toBe(Date.parse('2026-11-25T00:52:35-05:00'))
  })

  it('handles an empty response', () => {
    expect(upcomingStops({ data: [] })).toEqual([])
  })
})

describe('countdown text', () => {
  it('rounds to the nearest minute', () => {
    expect(minutesAway(NOW + 4.7 * 60_000, NOW)).toEqual({ value: '5', unit: 'min' })
    expect(minutesAway(NOW + 4.2 * 60_000, NOW)).toEqual({ value: '4', unit: 'min' })
  })

  it('drops stops more than a minute in the past', () => {
    const stops = [
      { id: 'a', name: 'Gone', at: NOW - 90_000 },
      { id: 'b', name: 'Due', at: NOW - 30_000 },
      { id: 'c', name: 'Later', at: NOW + 60_000 },
      { id: 'd', name: 'Unknown', at: null },
    ]
    expect(stillAhead(stops, NOW).map((s) => s.name)).toEqual(['Due', 'Later', 'Unknown'])
  })

  it('says Now under a minute', () => {
    expect(minutesAway(NOW + 40_000, NOW)).toEqual({ value: 'Now', unit: '' })
    expect(shortEta(NOW + 40_000, NOW)).toBe('now')
  })

  it('shows nothing without an estimate', () => {
    expect(shortEta(null, NOW)).toBe('')
  })
})

describe('stripStops', () => {
  const stop = (n: string) => ({ id: n, name: n, at: null })
  const trip = ['Central', 'Harvard', 'Porter', 'Davis', 'Alewife'].map(stop)

  it('shows every stop when they fit', () => {
    expect(stripStops(trip).map((s) => s.name)).toEqual([
      'Central',
      'Harvard',
      'Porter',
      'Davis',
      'Alewife',
    ])
  })

  it('keeps the next stops and the destination, marking the gap', () => {
    const long = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(stop)
    const shown = stripStops(long)
    expect(shown.map((s) => s.name)).toEqual(['A', 'B', 'C', 'D', 'G'])
    expect(shown[4].afterGap).toBe(true)
  })
})

describe('progressToNextStop', () => {
  it('places the train by what the feed says', () => {
    expect(progressToNextStop('stopped')).toBe(1)
    expect(progressToNextStop('incoming')).toBeGreaterThan(progressToNextStop('in-transit'))
  })
})
