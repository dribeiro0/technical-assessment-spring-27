import { describe, expect, it } from 'vitest'
import type { PredictionsDocument } from '../api/mbtaTypes'
import { groupDepartures, parseDepartures } from './departures'

const NOW = Date.parse('2026-11-25T08:00:00-05:00')
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

function prediction(
  id: string,
  route: string,
  trip: string,
  dep: string | null,
  rel: string | null = null,
) {
  return {
    type: 'prediction',
    id,
    attributes: { arrival_time: dep, departure_time: dep, schedule_relationship: rel },
    relationships: {
      route: { data: { type: 'route', id: route } },
      trip: { data: { type: 'trip', id: trip } },
    },
  }
}

// Modelled on Park Street: several lines, repeated predictions, a train ending its trip.
const doc: PredictionsDocument = {
  data: [
    prediction('p1', 'Red', 't-alewife-1', at(2)),
    prediction('p2', 'Red', 't-alewife-2', at(9)),
    prediction('p3', 'Red', 't-ashmont-1', at(4)),
    prediction('p4', 'Green-E', 't-heath-1', at(1)),
    prediction('p4b', 'Green-E', 't-heath-1', at(1)), // the MBTA repeating itself
    prediction('p5', 'Green-E', 't-ends-here', null), // arrives, does not leave
    prediction('p6', 'Red', 't-skipped', at(3), 'SKIPPED'),
    prediction('p7', 'Mattapan', 't-mattapan', at(5)),
    prediction('p8', 'Red', 't-alewife-gone', at(-2)),
  ],
  included: [
    { type: 'trip', id: 't-alewife-1', attributes: { headsign: 'Alewife' } },
    { type: 'trip', id: 't-alewife-2', attributes: { headsign: 'Alewife' } },
    { type: 'trip', id: 't-alewife-gone', attributes: { headsign: 'Alewife' } },
    { type: 'trip', id: 't-ashmont-1', attributes: { headsign: 'Ashmont' } },
    { type: 'trip', id: 't-heath-1', attributes: { headsign: 'Heath Street' } },
  ],
}

describe('parseDepartures', () => {
  const deps = parseDepartures(doc)

  it('keeps boardable in-scope trains, one per trip', () => {
    expect(deps.map((d) => d.tripId).sort()).toEqual(
      ['t-alewife-1', 't-alewife-2', 't-alewife-gone', 't-ashmont-1', 't-heath-1'].sort(),
    )
  })

  it('reads the headsign and Green branch', () => {
    const heath = deps.find((d) => d.tripId === 't-heath-1')
    expect(heath).toMatchObject({ line: 'Green', branch: 'E', headsign: 'Heath Street' })
  })
})

describe('groupDepartures', () => {
  const groups = groupDepartures(parseDepartures(doc), NOW)

  it('groups by route and destination, in line order, soonest first', () => {
    expect(groups.map((g) => `${g.routeId} ${g.headsign}`)).toEqual([
      'Red Alewife',
      'Red Ashmont',
      'Green-E Heath Street',
    ])
  })

  it('drops trains that already left and sorts the times', () => {
    expect(groups[0].times).toEqual([NOW + 2 * 60_000, NOW + 9 * 60_000])
  })

  it('keeps at most three per group', () => {
    const many = [1, 2, 3, 4, 5].map((m) => ({
      tripId: `t${m}`,
      line: 'Red' as const,
      routeId: 'Red',
      branch: null,
      headsign: 'Alewife',
      at: NOW + m * 60_000,
    }))
    expect(groupDepartures(many, NOW)[0].times).toHaveLength(3)
  })
})

describe('multi-car Green Line trains', () => {
  // Seen at Park Street on November 25, 2026: each car of one E train came back as its
  // own trip, all leaving platform 70199 at the same time.
  const car = (id: string, trip: string) => ({
    type: 'prediction',
    id,
    attributes: { arrival_time: at(12), departure_time: at(12), schedule_relationship: null },
    relationships: {
      route: { data: { type: 'route', id: 'Green-E' } },
      trip: { data: { type: 'trip', id: trip } },
      stop: { data: { type: 'stop', id: '70199' } },
    },
  })
  const cars: PredictionsDocument = {
    data: [car('c1', 'ADDED-1'), car('c2', 'ADDED-2'), car('c3', '77745213')],
    included: ['ADDED-1', 'ADDED-2', '77745213'].map((id) => ({
      type: 'trip',
      id,
      attributes: { headsign: 'Heath Street' },
    })),
  }

  it('counts one train, not one per car', () => {
    const groups = groupDepartures(parseDepartures(cars), NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].times).toEqual([NOW + 12 * 60_000])
  })
})
