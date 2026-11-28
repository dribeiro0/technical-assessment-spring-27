import { describe, expect, it } from 'vitest'
import type { Commute } from './commute'
import { alertFocus, commuteFocus, endsBeforeDestination } from './commuteRoute'
import type { LineAlert } from './lineStatus'
import type { Network, Station } from './network'

// A made-up line running due south from A to E (direction 0 = southbound), with a fork
// after C: one branch to E (route "Red", shape 1) and one bending east to F (shape 2).
// Points are 0.01 degrees of latitude apart, about 1.1 km.
const station = (id: string, lat: number, lon = -71.06): Station => ({
  id,
  name: id,
  lat,
  lon,
  lines: ['Red'],
})
const A = station('A', 42.4)
const B = station('B', 42.39)
const C = station('C', 42.38)
const D = station('D', 42.37)
const E = station('E', 42.36)
const F = station('F', 42.37, -71.04)
const OTHER = station('OTHER', 42.38, -71.2)

const trunk: [number, number][] = [
  [42.4, -71.06],
  [42.39, -71.06],
  [42.38, -71.06],
]
const network: Network = {
  shapes: [
    { id: 's1', line: 'Red', routeId: 'Red', points: [...trunk, [42.37, -71.06], [42.36, -71.06]] },
    { id: 's2', line: 'Red', routeId: 'Red', points: [...trunk, [42.37, -71.04]] },
    {
      id: 'g',
      line: 'Green',
      routeId: 'Green-B',
      points: [
        [42.38, -71.2],
        [42.39, -71.2],
      ],
    },
  ],
  stations: [A, B, C, D, E, F, OTHER],
}

const commute = (over: Partial<Commute>): Commute => ({
  id: 'c',
  name: 'Test',
  stationId: 'B',
  stationName: 'B',
  routeId: 'Red',
  directionId: 0,
  destinationId: null,
  destinationName: null,
  walkMin: 5,
  bufferMin: 2,
  ...over,
})

const ends = (path: [number, number][]) => [path[0], path.at(-1)!] as const

describe('commuteFocus', () => {
  it('cuts out the stretch between the two stations', () => {
    const focus = commuteFocus(network, commute({ destinationId: 'D', destinationName: 'D' }))!
    expect(focus.paths).toHaveLength(1)
    const [from, to] = ends(focus.paths[0])
    expect(from[0]).toBeCloseTo(42.39, 5)
    expect(to[0]).toBeCloseTo(42.37, 5)
    expect([...focus.stationIds].sort()).toEqual(['B', 'C', 'D'])
  })

  it('works the same whichever way round the stations are', () => {
    const focus = commuteFocus(
      network,
      commute({ stationId: 'D', destinationId: 'B', destinationName: 'B', directionId: 1 }),
    )!
    expect([...focus.stationIds].sort()).toEqual(['B', 'C', 'D'])
  })

  it('picks the branch that passes the destination', () => {
    const focus = commuteFocus(network, commute({ destinationId: 'F', destinationName: 'F' }))!
    expect(focus.paths).toHaveLength(1)
    expect(focus.paths[0].at(-1)![1]).toBeCloseTo(-71.04, 5)
    expect(focus.stationIds.has('F')).toBe(true)
    expect(focus.stationIds.has('E')).toBe(false)
  })

  it('counts a stretch shared by both branches once', () => {
    const focus = commuteFocus(
      network,
      commute({ stationId: 'A', destinationId: 'C', destinationName: 'C' }),
    )!
    expect(focus.paths).toHaveLength(1)
  })

  it('without a destination, runs to the end of the line in the commute direction', () => {
    const south = commuteFocus(network, commute({ stationId: 'C', directionId: 0 }))!
    expect(south.paths).toHaveLength(2) // both branches continue south of the fork
    expect(south.stationIds.has('A')).toBe(false)
    expect(south.stationIds.has('E')).toBe(true)

    const north = commuteFocus(network, commute({ stationId: 'C', directionId: 1 }))!
    expect(north.stationIds.has('A')).toBe(true)
    expect(north.stationIds.has('E')).toBe(false)
  })

  it('keeps a station to the branch that stops there, even with tracks side by side', () => {
    // Like the real Red Line: after JFK/UMass the Braintree track runs right beside Savin
    // Hill (an Ashmont-branch station) without stopping. Both shapes pass the platform.
    const jfk = { ...station('place-jfk', 42.32), id: 'place-jfk' }
    const savin = { ...station('place-shmnl', 42.31), id: 'place-shmnl' }
    const ashmont = { ...station('place-asmnl', 42.28), id: 'place-asmnl' }
    const braintree = { ...station('place-brntn', 42.28, -71.0), id: 'place-brntn' }
    const red: Network = {
      shapes: [
        {
          id: 'to-ashmont',
          line: 'Red',
          routeId: 'Red',
          points: [
            [42.32, -71.06],
            [42.28, -71.06],
          ],
        },
        {
          id: 'to-braintree',
          line: 'Red',
          routeId: 'Red',
          points: [
            [42.32, -71.06],
            [42.31, -71.0601],
            [42.28, -71.0],
          ],
        },
      ],
      stations: [jfk, savin, ashmont, braintree],
    }
    const toBraintree = commuteFocus(
      red,
      commute({
        stationId: 'place-jfk',
        destinationId: 'place-brntn',
        destinationName: 'Braintree',
      }),
    )!
    expect(toBraintree.stationIds.has('place-shmnl')).toBe(false)
    expect(toBraintree.stationIds.has('place-brntn')).toBe(true)

    const toSavin = commuteFocus(
      red,
      commute({
        stationId: 'place-jfk',
        destinationId: 'place-shmnl',
        destinationName: 'Savin Hill',
      }),
    )!
    expect(toSavin.paths).toHaveLength(1)
    expect(toSavin.stationIds.has('place-shmnl')).toBe(true)
  })

  it('ignores other routes and gives nothing when the data is missing', () => {
    const focus = commuteFocus(network, commute({ destinationId: 'D', destinationName: 'D' }))!
    expect(focus.stationIds.has('OTHER')).toBe(false)
    expect(commuteFocus(network, commute({ stationId: 'nowhere' }))).toBeNull()
    expect(commuteFocus({ shapes: [], stations: network.stations }, commute({}))).toBeNull()
  })
})

describe('endsBeforeDestination (short trips)', () => {
  // The made-up line runs A -> E southbound (direction 0), forking to F after C.
  const toE = commute({ stationId: 'A', destinationId: 'E', destinationName: 'E' })

  it('drops a train that ends before the destination', () => {
    expect(endsBeforeDestination(network, toE, 'C')).toBe(true)
  })

  it('keeps trains that reach or pass the destination', () => {
    expect(endsBeforeDestination(network, toE, 'E')).toBe(false)
    expect(
      endsBeforeDestination(network, commute({ destinationId: 'D', destinationName: 'D' }), 'E'),
    ).toBe(false)
  })

  it('works northbound too', () => {
    const north = commute({
      stationId: 'E',
      directionId: 1,
      destinationId: 'A',
      destinationName: 'A',
    })
    expect(endsBeforeDestination(network, north, 'C')).toBe(true)
    expect(endsBeforeDestination(network, north, 'A')).toBe(false)
  })

  it('counts the train when it cannot tell', () => {
    expect(endsBeforeDestination(network, toE, 'Somewhere else')).toBe(false)
    expect(endsBeforeDestination(network, toE, null)).toBe(false)
    expect(endsBeforeDestination(network, commute({}), 'C')).toBe(false) // no destination
  })
})

describe('alertFocus (what an alert lights up)', () => {
  const alert = (entities: LineAlert['entities']): LineAlert => ({
    id: 'a',
    header: 'h',
    description: null,
    effect: 'X',
    severity: 7,
    level: 'major',
    lines: ['Red'],
    timing: 'active',
    start: null,
    end: null,
    entities,
    updatedAt: null,
  })
  const e = (stationId: string | null, ride: boolean) => ({
    routeId: 'Red',
    stationId,
    directionId: null,
    ride,
  })

  it('a closure lights up its stations only', () => {
    const focus = alertFocus(network, alert([e('C', false)]))!
    expect([...focus.stationIds]).toEqual(['C'])
    expect(focus.paths).toHaveLength(0)
  })

  it('a suspension lights up the track between its first and last station', () => {
    const focus = alertFocus(network, alert([e('B', true), e('C', true), e('D', true)]))!
    // The whole B -> D stretch is lit (the F branch shares B -> C, so that part can be
    // drawn twice, on the same track), and nothing strays onto the F branch.
    const spans = focus.paths.map((p) => [p[0][0], p.at(-1)![0]])
    expect(
      spans.some(([from, to]) => Math.abs(from - 42.39) < 1e-5 && Math.abs(to - 42.37) < 1e-5),
    ).toBe(true)
    expect(focus.paths.flat().every(([, lon]) => Math.abs(lon + 71.06) < 1e-5)).toBe(true)
  })

  it('a route-wide suspension lights up the whole route', () => {
    const focus = alertFocus(network, alert([e(null, true)]))!
    expect(focus.paths).toHaveLength(2) // both branches
  })

  it('gives nothing when none of its places are on the map', () => {
    expect(alertFocus(network, alert([e('nowhere', false)]))).toBeNull()
  })
})
