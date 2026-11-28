import { describe, expect, it } from 'vitest'
import { waitFigures } from './baselines'
import { LIVE_WINDOW_MS, lineOf, liveGaps, type FirstSeen } from './live'

const NOW = Date.parse('2026-11-28T15:00:00Z')
const min = 60_000
const seen = (over: Partial<FirstSeen>): FirstSeen => ({
  line: 'Red',
  directionId: 0,
  stopId: '70061',
  tripId: 't',
  at: NOW,
  ...over,
})

/**
 * Each trip also seen a minute earlier at its origin terminal, as real trips are. A
 * terminal track id, so the origin rows never form gaps of their own.
 */
const trips = (rows: FirstSeen[]): FirstSeen[] => [
  ...rows.map((r) => ({ ...r, stopId: 'Terminal-01', at: r.at - min })),
  ...rows,
]

describe('waitFigures (03 section 10)', () => {
  it('regular service: the wait is half the gap', () => {
    expect(waitFigures([360, 360, 360])).toEqual({ mean: 360, wait: 180 })
  })
  it('uneven gaps with the same mean make the wait longer', () => {
    // Mean 6 min either way; 2 + 10 min gaps -> E[H²]/2E[H] = (4+100)/(2*12) = 4.33 min.
    const { mean, wait } = waitFigures([120, 600])
    expect(mean).toBe(360)
    expect(wait).toBeCloseTo((120 ** 2 + 600 ** 2) / (2 * 720))
    expect(wait).toBeGreaterThan(180)
  })
  it('caps each gap before squaring, so one stray gap cannot dominate', () => {
    const gaps = [...Array(20).fill(360), 5400]
    expect(waitFigures(gaps).wait).toBeGreaterThan(2 * waitFigures(gaps, 1080).wait)
    expect(waitFigures(gaps, 1080).wait).toBeGreaterThan(180)
  })
  it('no gaps: no figure, never zero', () => {
    expect(waitFigures([]).wait).toBeNaN()
  })
})

describe('lineOf', () => {
  it('combines the Green branches and ignores other routes', () => {
    expect(lineOf('Green-D')).toBe('Green')
    expect(lineOf('Red')).toBe('Red')
    expect(lineOf('Mattapan')).toBeNull()
  })
})

describe('liveGaps', () => {
  it('measures gaps between consecutive trains at each stop', () => {
    const [red] = liveGaps(
      trips([
        seen({ tripId: 'a', at: NOW - 20 * min }),
        seen({ tripId: 'b', at: NOW - 12 * min }),
        seen({ tripId: 'c', at: NOW - 5 * min }),
      ]),
      NOW,
    )
    expect(red).toMatchObject({ line: 'Red', directionId: 0, gaps: [480, 420], open: [300] })
  })

  it('keeps only gaps that ended inside the window, but sees their start before it', () => {
    const [red] = liveGaps(
      trips([
        seen({ tripId: 'a', at: NOW - 90 * min }),
        seen({ tripId: 'b', at: NOW - 40 * min }), // gap ended before the window: dropped
        seen({ tripId: 'c', at: NOW - 10 * min }), // 30-min gap, started before the window
      ]),
      NOW,
    )
    expect(NOW - 10 * min).toBeGreaterThan(NOW - LIVE_WINDOW_MS)
    expect(red.gaps).toEqual([1800])
  })

  it('treats Green branches at a shared stop as one stream, as LAMP does', () => {
    const [green] = liveGaps(
      trips([
        seen({ line: 'Green', stopId: '70200', tripId: 'b1', at: NOW - 9 * min }),
        seen({ line: 'Green', stopId: '70200', tripId: 'd1', at: NOW - 6 * min }),
      ]),
      NOW,
    )
    expect(green.gaps).toEqual([180])
  })

  it('keeps directions and stops apart', () => {
    const groups = liveGaps(
      trips([
        seen({ tripId: 'a', at: NOW - 10 * min }),
        seen({ tripId: 'b', directionId: 1, at: NOW - 8 * min }),
        seen({ tripId: 'c', stopId: '70063', at: NOW - 6 * min }),
      ]),
      NOW,
    )
    expect(groups.map((g) => [g.directionId, g.gaps.length, g.open.length])).toEqual([
      [0, 0, 2],
      [1, 0, 1],
    ])
  })

  it('drops gaps longer than an overnight break, like the baselines', () => {
    const [red] = liveGaps(
      trips([seen({ tripId: 'a', at: NOW - 200 * min }), seen({ tripId: 'b', at: NOW - 2 * min })]),
      NOW,
    )
    expect(red.gaps).toEqual([])
    expect(red.open).toEqual([120])
  })

  it("leaves out each trip's origin stop, where trains wait on layover", () => {
    // Both trips start at 70036; their first reports there are 30 min apart, but they left
    // 6 min apart, as the next stop shows.
    const groups = liveGaps(
      [
        seen({ tripId: 'a', stopId: '70036', at: NOW - 40 * min }),
        seen({ tripId: 'a', stopId: '70038', at: NOW - 12 * min }),
        seen({ tripId: 'b', stopId: '70036', at: NOW - 10 * min }),
        seen({ tripId: 'b', stopId: '70038', at: NOW - 6 * min }),
      ],
      NOW,
    )
    expect(groups[0].gaps).toEqual([360])
  })

  it('leaves out terminal tracks, which each see every other train', () => {
    const groups = liveGaps(
      trips([
        seen({ tripId: 'a', stopId: 'Alewife-01', at: NOW - 20 * min }),
        seen({ tripId: 'b', stopId: 'Alewife-01', at: NOW - 4 * min }),
      ]),
      NOW,
    )
    // A 16-min "gap" on one track; nothing is measured there, not even an open gap.
    expect(groups).toEqual([])
  })
})
