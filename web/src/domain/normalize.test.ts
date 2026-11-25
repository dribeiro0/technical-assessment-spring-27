import { describe, expect, it } from 'vitest'
import type { VehiclesDocument } from '../api/mbtaTypes'
import { countByLine } from './counts'
import { normalizeVehicles } from './normalize'

function rawVehicle(
  id: string,
  route: string,
  overrides: Record<string, unknown> = {},
  stopId: string | null = '70074',
) {
  return {
    type: 'vehicle',
    id,
    attributes: {
      label: '1833',
      latitude: 42.32,
      longitude: -71.05,
      bearing: 275,
      current_status: 'STOPPED_AT',
      direction_id: 1,
      updated_at: '2026-11-24T18:47:30-05:00',
      ...overrides,
    },
    relationships: {
      route: { data: { type: 'route', id: route } },
      trip: { data: { type: 'trip', id: '77871341' } },
      stop: { data: stopId ? { type: 'stop', id: stopId } : null },
    },
  }
}

const doc: VehiclesDocument = {
  data: [
    // The vehicle traced in 13_engineering_handoff.txt.
    rawVehicle('R-548CD8D6', 'Red'),
    rawVehicle('G-10078', 'Green-B', { label: '3633-3864', current_status: 'IN_TRANSIT_TO' }),
    rawVehicle('G-10109', 'Green-C', {}, null),
    rawVehicle('M-3260', 'Mattapan'),
    rawVehicle('O-NOCOORD', 'Orange', { latitude: null }),
    rawVehicle('B-NOTIME', 'Blue', { updated_at: null }),
    // A repeated ID: the newer report should win.
    rawVehicle('R-548CD8D6', 'Red', { updated_at: '2026-11-24T18:48:00-05:00', bearing: 90 }),
  ],
  included: [
    { type: 'trip', id: '77871341', attributes: { headsign: 'Alewife' } },
    { type: 'stop', id: '70074', attributes: { name: 'JFK/UMass' } },
  ],
}

describe('normalizeVehicles', () => {
  const vehicles = normalizeVehicles(doc)

  it('keeps only usable, in-scope vehicles, one per ID', () => {
    expect(vehicles.map((v) => v.id)).toEqual(['R-548CD8D6', 'G-10078', 'G-10109'])
  })

  it('resolves stop and direction from the included records', () => {
    const red = vehicles[0]
    expect(red).toMatchObject({
      line: 'Red',
      routeId: 'Red',
      branch: null,
      label: '1833',
      status: 'stopped',
      stopName: 'JFK/UMass',
      headsign: 'Alewife',
      directionId: 1,
    })
  })

  it('keeps the newest report when an ID repeats', () => {
    expect(vehicles[0].bearing).toBe(90)
    expect(vehicles[0].updatedAt).toBe(Date.parse('2026-11-24T18:48:00-05:00'))
  })

  it('records Green branches and missing stops', () => {
    expect(vehicles[1]).toMatchObject({ line: 'Green', branch: 'B', status: 'in-transit' })
    expect(vehicles[2]).toMatchObject({ line: 'Green', branch: 'C', stopName: null })
  })

  it('handles an empty response', () => {
    expect(normalizeVehicles({ data: [] })).toEqual([])
  })
})

describe('countByLine', () => {
  it('lists every line, combining Green branches', () => {
    const counts = countByLine(normalizeVehicles(doc))
    expect(counts.map((c) => [c.line, c.count])).toEqual([
      ['Red', 1],
      ['Orange', 0],
      ['Blue', 0],
      ['Green', 2],
    ])
    expect(counts[3].branches).toEqual({ B: 1, C: 1 })
  })
})
