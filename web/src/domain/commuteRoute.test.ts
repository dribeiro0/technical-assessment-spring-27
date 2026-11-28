import { describe, expect, it } from 'vitest'
import type { Commute } from './commute'
import { commuteFocus } from './commuteRoute'
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
