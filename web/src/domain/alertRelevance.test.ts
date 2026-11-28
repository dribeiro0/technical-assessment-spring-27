import { describe, expect, it } from 'vitest'
import { alertRelevance } from './alertRelevance'
import type { Commute } from './commute'
import type { AlertEntity, LineAlert } from './lineStatus'

// Kenmore -> Copley on the Green C branch, inbound (direction 1), riding through
// Hynes Convention Center.
const commute: Commute = {
  id: 'c',
  name: 'Class',
  stationId: 'place-kencl',
  stationName: 'Kenmore',
  routeId: 'Green-C',
  directionId: 1,
  destinationId: 'place-coecl',
  destinationName: 'Copley',
  walkMin: 5,
  bufferMin: 2,
}
const stretch = new Set(['place-kencl', 'place-hymnl', 'place-coecl'])

const alert = (entities: AlertEntity[]): LineAlert => ({
  id: 'a',
  header: 'h',
  description: null,
  effect: 'X',
  severity: 7,
  level: 'minor',
  lines: ['Green'],
  timing: 'active',
  start: null,
  end: null,
  entities,
  updatedAt: null,
})
const closure = (stationId: string, directionId: 0 | 1 | null = null): AlertEntity => ({
  routeId: 'Green-C',
  stationId,
  directionId,
  ride: false,
})
const suspension = (stationId: string | null, directionId: 0 | 1 | null = null): AlertEntity => ({
  routeId: 'Green-C',
  stationId,
  directionId,
  ride: true,
})

describe('alertRelevance', () => {
  it('a closure at the boarding or destination station affects the trip', () => {
    expect(alertRelevance(alert([closure('place-kencl')]), commute, stretch)).toBe('direct')
    expect(alertRelevance(alert([closure('place-coecl', 1)]), commute, stretch)).toBe('direct')
  })

  it('a closure mid-trip does not: the train runs through it', () => {
    expect(alertRelevance(alert([closure('place-hymnl')]), commute, stretch)).toBe('indirect')
  })

  it('a suspension anywhere on the stretch affects the trip', () => {
    expect(alertRelevance(alert([suspension('place-hymnl')]), commute, stretch)).toBe('direct')
    expect(alertRelevance(alert([suspension(null)]), commute, stretch)).toBe('direct')
  })

  it('the other direction, or elsewhere on the route, is only indirect', () => {
    expect(alertRelevance(alert([closure('place-kencl', 0)]), commute, stretch)).toBe('indirect')
    // Like the real Hawes St closure: inbound C branch, west of Kenmore.
    expect(alertRelevance(alert([closure('place-hwsst', 1)]), commute, stretch)).toBe('indirect')
  })

  it('another route is unrelated', () => {
    const other = alert([
      { routeId: 'Green-E', stationId: 'place-kencl', directionId: null, ride: true },
    ])
    expect(alertRelevance(other, commute, stretch)).toBe('none')
  })

  it('says unknown, never none, while the stretch is not known', () => {
    expect(alertRelevance(alert([suspension('place-hymnl')]), commute, null)).toBe('unknown')
    // A closure at the rider's own station is still certain.
    expect(alertRelevance(alert([closure('place-kencl')]), commute, null)).toBe('direct')
  })
})
