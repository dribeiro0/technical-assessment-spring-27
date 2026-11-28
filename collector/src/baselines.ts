// Baselines from public MBTA history (Sprint 7, DEC-059): what is normal per line, day
// type and hour, built from MBTA LAMP's daily subway files. Plain functions, no I/O.

/** The lines the site shows. Mattapan joins in Sprint 9. */
export const LINES = ['Red', 'Orange', 'Blue', 'Green'] as const
export type Line = (typeof LINES)[number]
export type DayType = 'weekday' | 'saturday' | 'sunday'

/** A gap counts as reliable when it is at most this much longer than scheduled (B3). */
export const RELIABLE_SLACK_SECONDS = 120
/** Gaps longer than this are overnight breaks or data errors, not service. */
const MAX_HEADWAY_SECONDS = 2 * 3600
/** The minute window used to count trains running "at" an hour, like a live snapshot. */
const SNAPSHOT_FROM_MINUTE = 25
const SNAPSHOT_TO_MINUTE = 35

/** One train's stop at one station, reduced to what the baselines need. */
export interface StopEvent {
  line: Line
  directionId: 0 | 1
  vehicleId: string
  tripId: string
  /** Service date as YYYYMMDD. */
  serviceDate: number
  /** When the train stopped (epoch seconds). */
  at: number
  /** Seconds since the previous train on the same trunk at this stop, or null. */
  headway: number | null
  scheduledHeadway: number | null
}

export interface HeadwayBaseline {
  line: Line
  directionId: 0 | 1
  dayType: DayType
  hour: number
  /** How many gaps the figures rest on. */
  samples: number
  medianSeconds: number
  p90Seconds: number
  scheduledMedianSeconds: number
  /** Share of gaps no more than 2 minutes longer than scheduled (EnRoute's own measure). */
  reliableShare: number
}

export interface TrainBaseline {
  line: Line
  dayType: DayType
  hour: number
  /** Median trains running mid-hour across the days in the range. */
  typicalTrains: number
  /** How many days the figure rests on. */
  days: number
}

const LINE_SET = new Set<string>(LINES)

/** A raw LAMP row (subway-on-time-performance-v1) -> a stop event, or null to skip it. */
export function toStopEvent(row: Record<string, unknown>): StopEvent | null {
  const line = row.trunk_route_id
  const tripId = row.trip_id
  const at = row.stop_timestamp
  if (typeof line !== 'string' || !LINE_SET.has(line)) return null
  // Non-revenue moves carry no passengers and would skew the figures.
  if (typeof tripId !== 'string' || tripId.startsWith('NONREV')) return null
  if (at === null || at === undefined) return null
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    line: line as Line,
    directionId: row.direction_id === true || Number(row.direction_id) === 1 ? 1 : 0,
    vehicleId: String(row.vehicle_id ?? ''),
    tripId,
    serviceDate: Number(row.service_date),
    at: Number(at),
    headway: num(row.headway_trunk_seconds),
    scheduledHeadway: num(row.scheduled_headway_trunk),
  }
}

/** Weekday, Saturday or Sunday for a YYYYMMDD service date. */
export function dayType(serviceDate: number): DayType {
  const y = Math.floor(serviceDate / 10000)
  const m = Math.floor((serviceDate % 10000) / 100)
  const d = serviceDate % 100
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return weekday === 6 ? 'saturday' : weekday === 0 ? 'sunday' : 'weekday'
}

const bostonClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

/** Boston hour and minute of an epoch-seconds time. */
export function bostonTime(epochSeconds: number): { hour: number; minute: number } {
  const parts = bostonClock.formatToParts(epochSeconds * 1000)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { hour: get('hour'), minute: get('minute') }
}

/** The value at a fraction through a sorted list (0.5 is the median). */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/**
 * Headway figures per line, direction, day type and hour: typical and 90th-percentile
 * gap, the scheduled gap, and how often the real gap stayed within 2 minutes of schedule.
 */
export function headwayBaselines(events: Iterable<StopEvent>): HeadwayBaseline[] {
  const groups = new Map<string, { actual: number[]; scheduled: number[]; reliable: number }>()
  for (const e of events) {
    if (e.headway === null || e.scheduledHeadway === null) continue
    if (e.headway <= 0 || e.headway > MAX_HEADWAY_SECONDS || e.scheduledHeadway <= 0) continue
    const { hour } = bostonTime(e.at)
    const key = `${e.line}|${e.directionId}|${dayType(e.serviceDate)}|${hour}`
    const g = groups.get(key) ?? groups.set(key, { actual: [], scheduled: [], reliable: 0 }).get(key)!
    g.actual.push(e.headway)
    g.scheduled.push(e.scheduledHeadway)
    if (e.headway <= e.scheduledHeadway + RELIABLE_SLACK_SECONDS) g.reliable++
  }
  const out: HeadwayBaseline[] = []
  for (const [key, g] of groups) {
    const [line, dir, type, hour] = key.split('|')
    const actual = g.actual.sort((a, b) => a - b)
    const scheduled = g.scheduled.sort((a, b) => a - b)
    out.push({
      line: line as Line,
      directionId: Number(dir) as 0 | 1,
      dayType: type as DayType,
      hour: Number(hour),
      samples: actual.length,
      medianSeconds: Math.round(quantile(actual, 0.5)),
      p90Seconds: Math.round(quantile(actual, 0.9)),
      scheduledMedianSeconds: Math.round(quantile(scheduled, 0.5)),
      reliableShare: g.reliable / actual.length,
    })
  }
  return out
}

/**
 * Typical trains running per line, day type and hour: on each day, the distinct trains
 * that stopped somewhere between :25 and :35 (a mid-hour snapshot, comparable to the
 * live count); then the median of those counts across days of the same type.
 */
export function trainBaselines(events: Iterable<StopEvent>): TrainBaseline[] {
  const perDay = new Map<string, Set<string>>()
  for (const e of events) {
    const { hour, minute } = bostonTime(e.at)
    if (minute < SNAPSHOT_FROM_MINUTE || minute >= SNAPSHOT_TO_MINUTE) continue
    const key = `${e.line}|${e.serviceDate}|${hour}`
    const set = perDay.get(key) ?? perDay.set(key, new Set()).get(key)!
    set.add(e.vehicleId)
  }
  const perType = new Map<string, number[]>()
  for (const [key, vehicles] of perDay) {
    const [line, date, hour] = key.split('|')
    const typeKey = `${line}|${dayType(Number(date))}|${hour}`
    const counts = perType.get(typeKey) ?? perType.set(typeKey, []).get(typeKey)!
    counts.push(vehicles.size)
  }
  const out: TrainBaseline[] = []
  for (const [key, counts] of perType) {
    const [line, type, hour] = key.split('|')
    out.push({
      line: line as Line,
      dayType: type as DayType,
      hour: Number(hour),
      typicalTrains: Math.round(quantile(counts.sort((a, b) => a - b), 0.5)),
      days: counts.length,
    })
  }
  return out
}
