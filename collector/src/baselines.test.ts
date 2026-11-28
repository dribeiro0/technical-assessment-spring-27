import { describe, expect, it } from 'vitest'
import {
  bostonTime,
  dayType,
  headwayBaselines,
  quantile,
  toStopEvent,
  trainBaselines,
  type StopEvent,
} from './baselines'

// 2026-11-27 (a Friday) 8:30 a.m. Boston = 13:30 UTC.
const FRI_0830 = Date.parse('2026-11-27T13:30:00Z') / 1000
const SAT_0830 = Date.parse('2026-11-28T13:30:00Z') / 1000

const event = (over: Partial<StopEvent>): StopEvent => ({
  line: 'Red',
  directionId: 0,
  vehicleId: 'v1',
  tripId: 't1',
  serviceDate: 20261127,
  at: FRI_0830,
  headway: 400,
  scheduledHeadway: 360,
  stopId: '70061',
  origin: false,
  ...over,
})

describe('toStopEvent', () => {
  const row = {
    trunk_route_id: 'Red',
    trip_id: '77909634',
    stop_timestamp: 1795775620n,
    direction_id: true,
    vehicle_id: 'R-1',
    service_date: 20261127,
    headway_trunk_seconds: 782,
    scheduled_headway_trunk: 720,
    stop_id: '70063',
    stop_sequence: 2,
  }

  it('reads a LAMP row, including BigInt times and boolean directions', () => {
    expect(toStopEvent(row)).toEqual({
      line: 'Red',
      directionId: 1,
      vehicleId: 'R-1',
      tripId: '77909634',
      serviceDate: 20261127,
      at: 1795775620,
      headway: 782,
      scheduledHeadway: 720,
      stopId: '70063',
      origin: false,
    })
    expect(toStopEvent({ ...row, stop_sequence: 1 })?.origin).toBe(true)
  })

  it('skips non-revenue moves, Mattapan and rows without a stop time', () => {
    expect(toStopEvent({ ...row, trip_id: 'NONREV-1580844969' })).toBeNull()
    expect(toStopEvent({ ...row, trunk_route_id: 'Mattapan' })).toBeNull()
    expect(toStopEvent({ ...row, stop_timestamp: null })).toBeNull()
  })
})

describe('time helpers', () => {
  it('knows weekdays, Saturdays and Sundays', () => {
    expect(dayType(20261127)).toBe('weekday')
    expect(dayType(20261128)).toBe('saturday')
    expect(dayType(20261129)).toBe('sunday')
  })

  it('uses Boston time', () => {
    expect(bostonTime(FRI_0830)).toEqual({ hour: 8, minute: 30 })
  })

  it('interpolates quantiles', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([10], 0.9)).toBe(10)
  })
})

describe('headwayBaselines (B1, B3)', () => {
  it('summarises gaps and how often they stayed within 2 minutes of schedule', () => {
    const rows = headwayBaselines([
      event({ headway: 300, scheduledHeadway: 360 }), // early: reliable
      event({ headway: 480, scheduledHeadway: 360 }), // exactly 2 min late: reliable
      event({ headway: 600, scheduledHeadway: 360 }), // 4 min late: not
      event({ headway: 420, scheduledHeadway: 360 }),
    ])
    expect(rows).toEqual([
      {
        line: 'Red',
        directionId: 0,
        dayType: 'weekday',
        hour: 8,
        samples: 4,
        medianSeconds: 450,
        p90Seconds: 564,
        scheduledMedianSeconds: 360,
        reliableShare: 0.75,
        // Sum 1800 over 4 gaps; squares 856,800 / (2 x 1800) = 238 s expected wait.
        meanSeconds: 450,
        waitSeconds: 238,
      },
    ])
  })

  it('keeps directions, day types and hours apart and drops impossible gaps', () => {
    const rows = headwayBaselines([
      event({}),
      event({ directionId: 1 }),
      event({ serviceDate: 20261128, at: SAT_0830 }),
      event({ headway: 3 * 3600 }), // overnight break, not service
      event({ headway: null }),
    ])
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.samples)).toEqual([1, 1, 1])
  })
})

describe('headwayBaselines: same stops as the live gaps (DEC-062)', () => {
  it("leaves out terminal tracks and each trip's origin stop", () => {
    const rows = headwayBaselines([
      event({ headway: 400 }),
      event({ headway: 2400, stopId: 'Alewife-01' }), // one track sees every other train
      event({ headway: 2200, origin: true }), // layover at the first stop
    ])
    expect(rows[0].samples).toBe(1)
    expect(rows[0].medianSeconds).toBe(400)
  })

  it('still counts trains at terminals: train baselines are unchanged', () => {
    const rows = trainBaselines([
      event({ vehicleId: 'a', stopId: 'Alewife-01', origin: true }),
      event({ vehicleId: 'b' }),
    ])
    expect(rows[0].typicalTrains).toBe(2)
  })
})

describe('trainBaselines (B1)', () => {
  it('counts distinct trains mid-hour, then takes the median across days', () => {
    const rows = trainBaselines([
      // Friday: three trains seen between :25 and :35 (one twice), one at :50 (ignored)
      event({ vehicleId: 'a' }),
      event({ vehicleId: 'a', at: FRI_0830 + 60 }),
      event({ vehicleId: 'b' }),
      event({ vehicleId: 'c' }),
      event({ vehicleId: 'd', at: FRI_0830 + 20 * 60 }),
      // Thursday and Wednesday at 8:30: 5 and 1 trains
      ...['a', 'b', 'c', 'd', 'e'].map((v) =>
        event({ vehicleId: v, serviceDate: 20261126, at: FRI_0830 - 86400 }),
      ),
      event({ vehicleId: 'a', serviceDate: 20261125, at: FRI_0830 - 2 * 86400 }),
    ])
    expect(rows).toEqual([{ line: 'Red', dayType: 'weekday', hour: 8, typicalTrains: 3, days: 3 }])
  })
})
