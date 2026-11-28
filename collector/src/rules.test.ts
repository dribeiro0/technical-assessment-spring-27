import { describe, expect, it } from 'vitest'
import {
  alertVersions,
  dedupe,
  gapSince,
  observationKey,
  rawCutoff,
  replacesCurrent,
  vehicleObservations,
} from './rules'

const RETRIEVED = Date.parse('2026-11-29T08:00:05Z')
const vehicle = (id: string, route: string, updated: string | null, lat: number | null = 42.36) => ({
  id,
  attributes: {
    latitude: lat,
    longitude: -71.06,
    bearing: 90,
    current_status: 'IN_TRANSIT_TO',
    direction_id: 0,
    updated_at: updated,
  },
  relationships: {
    route: { data: { id: route } },
    trip: { data: { id: 't1' } },
    stop: { data: { id: '70075' } },
  },
})

describe('vehicleObservations (H1)', () => {
  it('keeps source time and retrieval time for in-scope trains', () => {
    const [o] = vehicleObservations({ data: [vehicle('R-1', 'Red', '2026-11-29T08:00:00Z')] }, RETRIEVED)
    expect(o).toMatchObject({
      vehicleId: 'R-1',
      routeId: 'Red',
      updatedAt: Date.parse('2026-11-29T08:00:00Z'),
      retrievedAt: RETRIEVED,
      tripId: 't1',
      stopId: '70075',
    })
  })

  it('drops out-of-scope routes and records that cannot be placed', () => {
    const doc = {
      data: [
        vehicle('M-1', 'Mattapan', '2026-11-29T08:00:00Z'),
        vehicle('R-2', 'Red', null),
        vehicle('R-3', 'Red', '2026-11-29T08:00:00Z', null),
      ],
    }
    expect(vehicleObservations(doc, RETRIEVED)).toEqual([])
  })
})

describe('duplicates and replay (H2)', () => {
  it('stores the same vehicle and source time once', () => {
    const doc = { data: [vehicle('R-1', 'Red', '2026-11-29T08:00:00Z')] }
    const first = vehicleObservations(doc, RETRIEVED)
    const replay = vehicleObservations(doc, RETRIEVED + 60_000)
    expect(dedupe([...first, ...replay])).toHaveLength(1)
    expect(observationKey(first[0])).toBe(observationKey(replay[0]))
  })

  it('keeps a new report from the same vehicle', () => {
    const a = vehicleObservations({ data: [vehicle('R-1', 'Red', '2026-11-29T08:00:00Z')] }, RETRIEVED)
    const b = vehicleObservations({ data: [vehicle('R-1', 'Red', '2026-11-29T08:00:30Z')] }, RETRIEVED)
    expect(dedupe([...a, ...b])).toHaveLength(2)
  })
})

describe('out-of-order updates (H4)', () => {
  it('never lets an older report overwrite a newer one', () => {
    expect(replacesCurrent(null, 100)).toBe(true)
    expect(replacesCurrent(100, 200)).toBe(true)
    expect(replacesCurrent(200, 100)).toBe(false)
    expect(replacesCurrent(200, 200)).toBe(false)
  })
})

describe('gaps (H3)', () => {
  const now = Date.parse('2026-11-29T08:10:00Z')
  it('records nothing on the first run or when nothing was missed', () => {
    expect(gapSince(null, now)).toBeNull()
    expect(gapSince(now - 60_000, now)).toBeNull()
    expect(gapSince(now - 120_000, now)).toBeNull() // one missed run is tolerated
  })

  it('records one gap from the last success to now after a stop', () => {
    expect(gapSince(now - 10 * 60_000, now)).toEqual({ start: now - 10 * 60_000, end: now })
  })
})

describe('retention (H5)', () => {
  it('keeps raw rows 14 days', () => {
    const now = Date.parse('2026-11-29T00:00:00Z')
    expect(rawCutoff(now)).toBe(Date.parse('2026-11-15T00:00:00Z'))
  })
})

describe('alertVersions', () => {
  it('keeps one version per alert and update time, with its routes', () => {
    const doc = {
      data: [
        {
          id: 'a1',
          attributes: {
            updated_at: '2026-11-25T10:00:00Z',
            effect: 'SUSPENSION',
            severity: 7,
            lifecycle: 'UPCOMING',
            header: 'No trains',
            informed_entity: [{ route: 'Blue' }, { route: 'Blue' }],
          },
        },
        { id: 'a2', attributes: { updated_at: null } },
      ],
    }
    expect(alertVersions(doc, RETRIEVED)).toEqual([
      {
        alertId: 'a1',
        updatedAt: Date.parse('2026-11-25T10:00:00Z'),
        retrievedAt: RETRIEVED,
        effect: 'SUSPENSION',
        severity: 7,
        lifecycle: 'UPCOMING',
        header: 'No trains',
        routes: 'Blue',
      },
    ])
  })
})
