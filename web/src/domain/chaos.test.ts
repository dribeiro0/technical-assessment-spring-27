import { describe, expect, it } from 'vitest'
import type { Baselines, HeadwayBaselineRow } from './baselines'
import {
  BAND_TEXT,
  SUSPENSION_FLOOR,
  bandOf,
  expectedWait,
  networkScore,
  routeScore,
  type LiveHeadways,
  type RouteInputs,
} from './chaos'
import type { Commute } from './commute'
import type { AlertEntity, LineAlert } from './lineStatus'
import { LINES } from './lines'

// Friday Nov 27, 2026, 8:30 a.m. Boston (13:30 UTC): weekday, hour 8.
const NOW = Date.parse('2026-11-27T13:30:00Z')

const headway = (over: Partial<HeadwayBaselineRow>): HeadwayBaselineRow => ({
  line: 'Red',
  direction_id: 0,
  day_type: 'weekday',
  hour: 8,
  samples: 900,
  median_seconds: 360,
  p90_seconds: 540,
  scheduled_median_seconds: 360,
  reliable_share: 0.8,
  mean_seconds: 380,
  wait_seconds: 200,
  ...over,
})

const baselines: Baselines = {
  source: {
    name: 'LAMP',
    fromDate: 20261003,
    toDate: 20261127,
    days: 56,
    events: 1,
    importedAt: 0,
  },
  headways: LINES.flatMap((l) => [0, 1].map((d) => headway({ line: l.id, direction_id: d }))),
  trains: LINES.map((l) => ({
    line: l.id,
    day_type: 'weekday' as const,
    hour: 8,
    typical_trains: l.id === 'Green' ? 40 : 20,
    days: 40,
  })),
}

/** Gaps that look like the baseline: ~6 min, fairly regular, expected wait ~3.3 min. */
const NORMAL = [300, 330, 360, 360, 390, 420, 330, 360, 390, 360, 300, 420, 360, 360]
/** Bunched trains: same mean, very uneven. */
const BUNCHED = [60, 660, 90, 630, 60, 660, 120, 600, 60, 660, 90, 630, 60, 660]

const live = (gaps: number[], open: number[] = []): LiveHeadways => ({
  asOf: NOW - 30_000,
  windowMinutes: 30,
  lines: LINES.flatMap((l) =>
    [0, 1].map((d) => ({ line: l.id, directionId: d as 0 | 1, gaps, open })),
  ),
})

const alert = (over: Partial<LineAlert>, entities: AlertEntity[] = []): LineAlert => ({
  id: 'a',
  header: 'Red Line delays',
  description: null,
  effect: 'DELAY',
  severity: 5,
  level: 'minor',
  lines: ['Red'],
  timing: 'active',
  start: null,
  end: null,
  entities,
  updatedAt: null,
  ...over,
})
const suspension = (stationId: string | null = null): LineAlert =>
  alert(
    { id: 's', effect: 'SUSPENSION', severity: 9, level: 'major', header: 'Red Line suspended' },
    [{ routeId: 'Red', stationId, directionId: null, ride: true }],
  )

const inputs = (over: Partial<RouteInputs> = {}): RouteInputs => ({
  line: 'Red',
  directionId: null,
  now: NOW,
  alerts: [],
  alertsAvailable: true,
  liveTrains: 20,
  vehiclesAt: NOW - 10_000,
  baselines,
  live: live(NORMAL),
  ...over,
})

const score = (over: Partial<RouteInputs> = {}) => routeScore(inputs(over), 'Red Line')

describe('expectedWait (03 section 10)', () => {
  it('is half the gap for regular service and more for uneven gaps', () => {
    expect(expectedWait([360, 360])).toBe(180)
    expect(expectedWait([60, 660])).toBeGreaterThan(expectedWait([360, 360]))
  })
})

describe('bandOf (03 section 7)', () => {
  it('uses the proposed bands', () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(bandOf)).toEqual([
      'smooth',
      'smooth',
      'minor',
      'minor',
      'moderate',
      'moderate',
      'high',
      'high',
      'critical',
      'critical',
    ])
  })
})

describe('route score: behaviour tests (03 section 9)', () => {
  it('regular service scores low', () => {
    const s = score()
    expect(s.band).toBe('smooth')
    expect(s.value).toBeLessThan(20)
  })

  it('severe bunching with no alert raises the route', () => {
    // Same 6-min mean gap, but uneven: expected wait 291 s against 200 s usual (+46%).
    const s = score({ live: live(BUNCHED) })
    expect(s.value!).toBeGreaterThan(score().value!)
    expect(s.band).not.toBe('smooth')
    expect(s.factors.find((f) => f.key === 'wait')!.value).toBeCloseTo(45.9, 0)
  })

  it('an entire route suspended is at least High, whatever else is measured', () => {
    const s = score({ alerts: [suspension()] })
    expect(s.value).toBeGreaterThanOrEqual(SUSPENSION_FLOOR)
    expect(s.band).toBe('high')
    expect(s.floor).toMatch(/suspension/)
  })

  it('a suspension holds the floor even when live gaps are missing (03 section 12)', () => {
    const s = score({ alerts: [suspension()], live: null, liveTrains: null })
    expect(s.value).toBe(SUSPENSION_FLOOR)
    expect(s.confidence).toBe('low')
  })

  it('several alerts for one incident score the same as one', () => {
    const one = score({ alerts: [alert({ id: 'x' })] })
    const three = score({ alerts: [alert({ id: 'x' }), alert({ id: 'y' }), alert({ id: 'z' })] })
    expect(three.value).toBe(one.value)
  })

  it('a station closure counts a quarter on the line, but fully at a commute station', () => {
    const closure = alert({ effect: 'STATION_CLOSURE', severity: 7 }, [
      { routeId: 'Red', stationId: 'place-knncl', directionId: null, ride: false },
    ])
    const line = score({ alerts: [closure] }).factors.find((f) => f.key === 'disruptions')!
    expect(line.value).toBe(56 * 0.25)
    const delay = score({ alerts: [alert({ severity: 7 })] }).factors.find(
      (f) => f.key === 'disruptions',
    )!
    expect(delay.value).toBe(56)
  })

  it('ten minor alerts do not outweigh one suspension', () => {
    const minors = score({
      alerts: Array.from({ length: 10 }, (_, k) => alert({ id: `m${k}`, severity: 7 })),
    })
    const suspended = score({ alerts: [suspension()] })
    expect(minors.value!).toBeLessThan(suspended.value!)
  })

  it('an alert that has ended while gaps persist is not yet smooth', () => {
    const s = score({ live: live([...BUNCHED], [1500, 1600]) })
    expect(s.band).not.toBe('smooth')
  })

  it('a stop already waiting far longer than usual counts as a long gap', () => {
    const without = score({ live: live(NORMAL) })
    const waiting = score({ live: live(NORMAL, [1800, 1800, 1800]) })
    expect(waiting.value!).toBeGreaterThan(without.value!)
    expect(waiting.factors.find((f) => f.key === 'wait')!.detail).toMatch(/still waiting/)
  })

  it('one stray gap does not swing the whole line (gaps capped at 3x usual p90)', () => {
    const stray = score({ live: live([...NORMAL, 5400]) })
    const wait = stray.factors.find((f) => f.key === 'wait')!
    // Uncapped, one 90-min gap among 15 would put the wait near 4x usual (W = 100).
    expect(wait.value!).toBeLessThan(100)
    expect(wait.value!).toBeGreaterThan(score().factors.find((f) => f.key === 'wait')!.value!)
  })

  it('fewer trains than usual raise availability', () => {
    const s = score({ liveTrains: 10 })
    expect(s.factors.find((f) => f.key === 'availability')!.value).toBe(100)
  })
})

describe('route score: missing data (03 section 6 and 12)', () => {
  it('with the alerts feed down there is no score, never "Smooth"', () => {
    const s = score({ alertsAvailable: false })
    expect(s.value).toBeNull()
    expect(s.band).toBeNull()
    expect(s.confidenceReason).toMatch(/Unknown/)
  })

  it('travel time is named as missing, so every score is provisional', () => {
    const s = score()
    expect(s.provisional).toBe(true)
    expect(s.limitations.join(' ')).toMatch(/excess travel time/)
    expect(s.factors.find((f) => f.key === 'travel')!.status).toBe('unavailable')
  })

  it('missing weight is not counted as good service: too little measured is unknown', () => {
    // Only disruptions (25%) and availability (10%) measured.
    const s = score({ live: null })
    expect(s.value).toBeNull()
    expect(s.confidenceReason).toMatch(/35%/)
  })

  it('a stopped collector is not read as good service', () => {
    const s = score({ live: { ...live(NORMAL), asOf: NOW - 20 * 60_000 } })
    expect(s.factors.find((f) => f.key === 'wait')!.status).toBe('unavailable')
    expect(s.factors.find((f) => f.key === 'wait')!.detail).toMatch(/not reported for 20 min/)
  })

  it('late at night, thin data gives unknown rather than a guess', () => {
    const s = score({ live: live([600, 900]), liveTrains: 2 })
    expect(s.value).toBeNull()
  })

  it('thin live data is used but marked partial and lowers confidence', () => {
    const s = score({ live: live(NORMAL.slice(0, 6)) })
    expect(s.factors.find((f) => f.key === 'wait')!.status).toBe('partial')
    expect(s.confidence).toBe('low')
  })

  it('every score carries what 03 section 7 requires', () => {
    const s = score()
    expect(s).toMatchObject({ scope: 'route', label: 'Red Line', modelVersion: 'C-0.1' })
    expect(s.factors.map((f) => f.key)).toEqual([
      'wait',
      'disruptions',
      'travel',
      'unpredictability',
      'availability',
    ])
    expect(s.observedAt).toBe(NOW - 10_000)
    expect(s.computedAt).toBe(NOW)
    expect(s.confidence).toBe('medium')
  })
})

describe('commute score: direction and place (03 section 5)', () => {
  const commute: Commute = {
    id: 'c',
    name: 'Work',
    stationId: 'place-cntsq',
    stationName: 'Central',
    routeId: 'Red',
    directionId: 1,
    destinationId: 'place-knncl',
    destinationName: 'Kendall/MIT',
    walkMin: 5,
    bufferMin: 2,
  }
  const stretch = new Set(['place-cntsq', 'place-knncl'])
  const commuteScore = (alerts: LineAlert[]) =>
    routeScore(inputs({ directionId: 1, alerts, commute: { commute, stretch } }), 'Work')

  it('a suspension elsewhere on the line counts as indirect, with no floor', () => {
    const s = commuteScore([suspension('place-alfcl')])
    expect(s.scope).toBe('commute')
    expect(s.floor).toBeNull()
    expect(s.value!).toBeLessThan(SUSPENSION_FLOOR)
  })

  it('a closure of the station the rider uses counts in full', () => {
    const closure = alert({ effect: 'STATION_CLOSURE', severity: 7 }, [
      { routeId: 'Red', stationId: 'place-knncl', directionId: null, ride: false },
    ])
    const s = commuteScore([closure])
    expect(s.factors.find((f) => f.key === 'disruptions')!.value).toBe(56)
  })

  it('a suspension on the trip itself holds the floor', () => {
    const s = commuteScore([suspension('place-knncl')])
    expect(s.value!).toBeGreaterThanOrEqual(SUSPENSION_FLOOR)
  })

  it('problems in the other direction do not raise the score', () => {
    const quiet = routeScore(inputs({ directionId: 1, commute: { commute, stretch } }), 'Work')
    const otherWay = routeScore(
      inputs({
        directionId: 1,
        commute: { commute, stretch },
        live: {
          ...live(NORMAL),
          lines: live(NORMAL).lines.map((l) => (l.directionId === 0 ? { ...l, gaps: BUNCHED } : l)),
        },
      }),
      'Work',
    )
    expect(otherWay.value).toBe(quiet.value)
  })
})

describe('network score (03 section 4)', () => {
  const routes = (over: Partial<RouteInputs> = {}) =>
    LINES.map((l) => routeScore(inputs({ line: l.id, ...over }), l.name))

  it('one suspended line makes that line high, not the whole network critical', () => {
    const lines = LINES.map((l) =>
      routeScore(inputs({ line: l.id, alerts: l.id === 'Red' ? [suspension()] : [] }), l.name),
    )
    const n = networkScore(lines, baselines, NOW)
    expect(lines[0].band).toBe('high')
    expect(n.value!).toBeLessThan(40)
    expect(n.scope).toBe('network')
  })

  it('weights lines by the trains they usually run', () => {
    const n = networkScore(routes(), baselines, NOW)
    expect(n.factors.find((f) => f.key === 'Green')!.weight).toBeCloseTo(40 / 100)
  })

  it('several major closures raise the whole network', () => {
    const lines = LINES.map((l) =>
      routeScore(
        inputs({
          line: l.id,
          alerts: [
            {
              ...suspension(),
              lines: [l.id],
              entities: [
                {
                  routeId: l.id === 'Green' ? 'Green-B' : l.id,
                  stationId: null,
                  directionId: null,
                  ride: true,
                },
              ],
            },
          ],
        }),
        l.name,
      ),
    )
    expect(networkScore(lines, baselines, NOW).value!).toBeGreaterThanOrEqual(SUSPENSION_FLOOR)
  })

  it('unknown lines are named and left out, never counted as smooth', () => {
    const n = networkScore(routes({ alertsAvailable: false }), baselines, NOW)
    expect(n.value).toBeNull()
    const partly = LINES.map((l) =>
      routeScore(inputs({ line: l.id, live: l.id === 'Blue' ? null : live(NORMAL) }), l.name),
    )
    const p = networkScore(partly, baselines, NOW)
    expect(p.value).not.toBeNull()
    expect(p.limitations[0]).toMatch(/Blue/)
  })

  it('names each band in words', () => {
    expect(BAND_TEXT.high).toBe('High chaos')
  })
})
