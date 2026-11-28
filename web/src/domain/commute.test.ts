import { describe, expect, it } from 'vitest'
import type { SchedulesDocument } from '../api/mbtaTypes'
import {
  chooseDepartures,
  createCommute,
  distanceMetres,
  leaveAdvice,
  walkFromHere,
  parseCommutes,
  parseScheduledDepartures,
  recommendDeparture,
  reverseCommute,
  serializeCommutes,
  serviceDayQuery,
  type Commute,
  type CommuteDeparture,
} from './commute'
import type { Departure } from './departures'
import { directionDestination } from './lines'

const MIN = 60_000
const NOW = Date.parse('2026-11-28T08:00:00-05:00')

const work: Commute = {
  id: 'c1',
  name: 'Work',
  stationId: 'place-knncl',
  stationName: 'Kendall/MIT',
  routeId: 'Red',
  directionId: 0,
  destinationId: 'place-pktrm',
  destinationName: 'Park Street',
  walkMin: 6,
  bufferMin: 3,
}

function departure(tripId: string, minutesFromNow: number): Departure {
  return {
    tripId,
    line: 'Red',
    routeId: 'Red',
    branch: null,
    headsign: 'Ashmont',
    at: NOW + minutesFromNow * MIN,
  }
}

describe('saved commutes (C2: survive a reload)', () => {
  it('round-trips through storage unchanged', () => {
    expect(parseCommutes(serializeCommutes([work]))).toEqual([work])
  })

  it('treats missing or unreadable storage as no commutes', () => {
    expect(parseCommutes(null)).toEqual([])
    expect(parseCommutes('not json')).toEqual([])
    expect(parseCommutes('{"a":1}')).toEqual([])
  })

  it('drops malformed entries and duplicates but keeps the good ones', () => {
    const stored = JSON.stringify([
      work,
      { ...work, id: 'c2', routeId: 'Mattapan' },
      { ...work, id: 'c3', directionId: 2 },
      { ...work, id: 'c4', walkMin: -1 },
      { ...work, id: 'c5', walkMin: 2.5 },
      work,
      'junk',
    ])
    expect(parseCommutes(stored)).toEqual([work])
  })

  it('keeps a commute with no destination', () => {
    const noDestination = { ...work, destinationId: null, destinationName: null }
    expect(parseCommutes(serializeCommutes([noDestination]))).toEqual([noDestination])
  })
})

describe('createCommute (C1)', () => {
  const { id: _id, ...input } = work

  it('trims the name and accepts valid input', () => {
    const result = createCommute({ ...input, name: '  Work  ' }, 'new')
    expect(result).toEqual({ ok: true, commute: { ...work, id: 'new' } })
  })

  it('explains what is wrong instead of saving', () => {
    expect(createCommute({ ...input, name: ' ' }, 'x').ok).toBe(false)
    expect(createCommute({ ...input, destinationId: 'place-knncl' }, 'x').ok).toBe(false)
    expect(createCommute({ ...input, bufferMin: 99 }, 'x').ok).toBe(false)
  })
})

describe('reverseCommute (C3)', () => {
  it('swaps the stations and flips the direction when there is a destination', () => {
    const back = reverseCommute(work)
    expect(back).toMatchObject({
      stationId: 'place-pktrm',
      stationName: 'Park Street',
      destinationId: 'place-knncl',
      directionId: 1,
    })
    expect(reverseCommute(back)).toEqual(work)
  })

  it('only flips the direction without a destination', () => {
    const plain = { ...work, destinationId: null, destinationName: null }
    expect(reverseCommute(plain)).toEqual({ ...plain, directionId: 1 })
  })
})

describe('direction labels', () => {
  it('names where each direction goes', () => {
    expect(directionDestination('Red', 1)).toBe('Alewife')
    expect(directionDestination('Green-E', 0)).toBe('Heath Street')
    expect(directionDestination('Unknown', 0)).toBe('Direction 0')
  })
})

describe('leaveAdvice (C5)', () => {
  it('matches the example in planning file 06: 15 min train, 6 walk, 3 buffer', () => {
    expect(leaveAdvice(NOW + 15 * MIN, NOW, 6, 3)).toEqual({ kind: 'leave-in', minutes: 6 })
  })

  it('rounds down so the rider is never late', () => {
    expect(leaveAdvice(NOW + 15.9 * MIN, NOW, 6, 3)).toEqual({ kind: 'leave-in', minutes: 6 })
  })

  it('says leave now under a minute, and miss when it is too late', () => {
    expect(leaveAdvice(NOW + 9.5 * MIN, NOW, 6, 3)).toEqual({ kind: 'leave-now' })
    expect(leaveAdvice(NOW + 9 * MIN, NOW, 6, 3)).toEqual({ kind: 'leave-now' })
    expect(leaveAdvice(NOW + 8 * MIN, NOW, 6, 3)).toEqual({ kind: 'miss' })
  })
})

describe('recommendDeparture (C5)', () => {
  const live = (tripId: string, min: number): CommuteDeparture => ({
    ...departure(tripId, min),
    source: 'live',
  })

  it('recommends the soonest train the rider can make', () => {
    const r = recommendDeparture([live('a', 12), live('b', 20)], NOW, 6, 3)
    expect(r?.departure.tripId).toBe('a')
    expect(r?.missed).toBe(0)
  })

  it('points at the next train when the soonest would be missed', () => {
    const r = recommendDeparture([live('a', 4), live('b', 20)], NOW, 6, 3)
    expect(r?.departure.tripId).toBe('b')
    expect(r?.missed).toBe(1)
    expect(r?.advice).toEqual({ kind: 'leave-in', minutes: 11 })
  })

  it('counts every train that is out of reach', () => {
    const r = recommendDeparture([live('a', 4), live('b', 8.5), live('c', 15)], NOW, 6, 3)
    expect(r?.departure.tripId).toBe('c')
    expect(r?.missed).toBe(2)
  })

  it('gives nothing when every listed train would be missed', () => {
    expect(recommendDeparture([live('a', 4)], NOW, 6, 3)).toBeNull()
  })
})

describe('chooseDepartures (C4: LIVE or SCHEDULED)', () => {
  it('uses live predictions whenever there are any, soonest first', () => {
    const result = chooseDepartures(
      [departure('l2', 9), departure('l1', 3)],
      [departure('s1', 1)],
      NOW,
    )
    expect(result.map((d) => [d.tripId, d.source])).toEqual([
      ['l1', 'live'],
      ['l2', 'live'],
    ])
  })

  it('falls back to the timetable only when there is no live prediction', () => {
    const result = chooseDepartures([departure('gone', -5)], [departure('s1', 4)], NOW)
    expect(result.map((d) => [d.tripId, d.source])).toEqual([['s1', 'scheduled']])
  })

  it('keeps a train leaving right now but drops ones that have gone', () => {
    const result = chooseDepartures([departure('now', -0.4), departure('gone', -1)], [], NOW)
    expect(result.map((d) => d.tripId)).toEqual(['now'])
  })

  it('limits how many are shown', () => {
    const many = [1, 2, 3, 4, 5].map((m) => departure(`t${m}`, m))
    expect(chooseDepartures(many, [], NOW, 3)).toHaveLength(3)
  })
})

describe('serviceDayQuery (the timetable day runs past midnight)', () => {
  it('uses today and the current Boston time during the day', () => {
    expect(serviceDayQuery(Date.parse('2026-11-27T23:38:00-05:00'))).toEqual({
      date: '2026-11-27',
      minTime: '23:38',
    })
  })

  it("asks for yesterday's timetable with the hour + 24 just after midnight", () => {
    expect(serviceDayQuery(Date.parse('2026-11-28T00:40:00-05:00'))).toEqual({
      date: '2026-11-27',
      minTime: '24:40',
    })
  })

  it('crosses a month boundary', () => {
    expect(serviceDayQuery(Date.parse('2026-12-01T02:05:00-05:00'))).toEqual({
      date: '2026-11-30',
      minTime: '26:05',
    })
  })

  it('switches to the new day at 3 a.m.', () => {
    expect(serviceDayQuery(Date.parse('2026-11-28T03:00:00-05:00')).date).toBe('2026-11-28')
  })

  it('uses Boston time on the night the clocks go back', () => {
    // 1:30 a.m. EDT on November 1, 2026, the night daylight saving time ends.
    expect(serviceDayQuery(Date.parse('2026-11-01T01:30:00-04:00'))).toEqual({
      date: '2026-10-31',
      minTime: '25:30',
    })
  })
})

describe('walkFromHere (walking time from the rider’s location)', () => {
  const kendall = { lat: 42.36249, lon: -71.08617 }

  it('measures straight-line distance', () => {
    // Kendall/MIT to Park Street is about 2.4 km as the crow flies.
    const park = { lat: 42.35639, lon: -71.0624 }
    expect(distanceMetres(kendall, park)).toBeGreaterThan(2000)
    expect(distanceMetres(kendall, park)).toBeLessThan(2200)
  })

  it('allows for streets and rounds up: 800 m away is a 13 min walk', () => {
    // 800 m north of Kendall: 800 x 1.3 / 80 = 13.
    const here = { lat: kendall.lat + 800 / 111_195, lon: kendall.lon }
    expect(walkFromHere(here, kendall)).toEqual({ kind: 'walk', minutes: 13 })
  })

  it('is at least 1 minute, even at the station', () => {
    expect(walkFromHere(kendall, kendall)).toEqual({ kind: 'walk', minutes: 1 })
  })

  it('gives no walking estimate beyond 3 km', () => {
    const far = { lat: kendall.lat + 0.05, lon: kendall.lon }
    expect(walkFromHere(far, kendall).kind).toBe('too-far')
  })
})

describe('parseScheduledDepartures', () => {
  // Shaped like the real /schedules response for Park Street checked on November 28.
  const doc = {
    data: [
      schedule('s1', '77909634', '2026-11-28T05:32:00-05:00', 0),
      schedule('s2', '77909821', '2026-11-28T05:36:00-05:00', 1),
      schedule('s3', '77909662', null, 0),
      schedule('s4', '77909634', '2026-11-28T05:32:00-05:00', 0),
    ],
    included: [{ type: 'trip', id: '77909634', attributes: { headsign: 'Alewife' } }],
  } as SchedulesDocument

  it('keeps boardable departures once each, with their headsign', () => {
    expect(parseScheduledDepartures(doc)).toEqual([
      {
        tripId: '77909634',
        line: 'Red',
        routeId: 'Red',
        branch: null,
        headsign: 'Alewife',
        at: Date.parse('2026-11-28T05:32:00-05:00'),
      },
    ])
  })
})

function schedule(id: string, trip: string, departure: string | null, pickup: number) {
  return {
    type: 'schedule',
    id,
    attributes: { arrival_time: departure, departure_time: departure, pickup_type: pickup },
    relationships: {
      route: { data: { type: 'route', id: 'Red' } },
      trip: { data: { type: 'trip', id: trip } },
    },
  }
}
