import type { LineId } from './lines'

// "Is now worse than usual?" (Sprint 7, DEC-059): compares live figures with baselines
// built from public MBTA history (MBTA LAMP), which the collector serves.

export type DayType = 'weekday' | 'saturday' | 'sunday'

export interface TrainBaselineRow {
  line: string
  day_type: DayType
  hour: number
  typical_trains: number
  days: number
}

export interface HeadwayBaselineRow {
  line: string
  direction_id: number
  day_type: DayType
  hour: number
  samples: number
  median_seconds: number
  p90_seconds: number
  scheduled_median_seconds: number
  reliable_share: number
  /** Mean gap; null for baselines imported before step e. */
  mean_seconds: number | null
  /** Expected wait for a rider arriving at random, E[H²]/(2E[H]) (03 section 10). */
  wait_seconds: number | null
}

export interface Baselines {
  source: {
    name: string
    fromDate: number
    toDate: number
    days: number
    events: number
    importedAt: number
  }
  headways: HeadwayBaselineRow[]
  trains: TrainBaselineRow[]
}

/** An hour with fewer gaps than this is too thin to call reliable or not (B5). */
export const MIN_RELIABILITY_SAMPLES = 50
/** Below this many typical trains, "fewer than usual" is end-of-service noise (B4). */
export const MIN_TRAINS_TO_COMPARE = 4
/** A typical figure resting on fewer days than this is not shown (B4). */
export const MIN_BASELINE_DAYS = 3
/** Before this hour (Boston), trains still belong to the previous day's service. */
const SERVICE_DAY_START_HOUR = 3

const bostonParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
})

/**
 * The MBTA service day type and the Boston clock hour for a moment. At 1 a.m. on a
 * Saturday the trains running are Friday's service, and the baselines file them that way.
 */
export function serviceSlot(now: number): { dayType: DayType; hour: number } {
  const parts = bostonParts.formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let weekday = days.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Mon')
  if (hour < SERVICE_DAY_START_HOUR) weekday = (weekday + 6) % 7
  const dayType: DayType = weekday === 6 ? 'saturday' : weekday === 0 ? 'sunday' : 'weekday'
  return { dayType, hour }
}

export const DAY_TYPE_TEXT: Record<DayType, string> = {
  weekday: 'weekdays',
  saturday: 'Saturdays',
  sunday: 'Sundays',
}

/**
 * How many trains a line usually has running at this hour on this kind of day, or null
 * when there is no figure or it rests on too few days. Never a guess.
 */
export function usualTrains(
  baselines: Baselines,
  line: LineId,
  now: number,
): { typical: number; days: number; dayType: DayType; hour: number } | null {
  const { dayType, hour } = serviceSlot(now)
  const row = baselines.trains.find(
    (t) => t.line === line && t.day_type === dayType && t.hour === hour,
  )
  if (!row || row.days < MIN_BASELINE_DAYS) return null
  return { typical: row.typical_trains, days: row.days, dayType, hour }
}

/**
 * Reliability by hour for one line and day type: the share of gaps within 2 minutes of
 * schedule, both directions together, weighted by how many gaps each direction had.
 * Hours with fewer than 50 gaps are left out: too few to measure.
 */
export function reliabilityByHour(
  baselines: Baselines,
  line: LineId,
  dayType: DayType,
): { hour: number; share: number; samples: number }[] {
  const byHour = new Map<number, { reliable: number; samples: number }>()
  for (const h of baselines.headways) {
    if (h.line !== line || h.day_type !== dayType) continue
    const slot = byHour.get(h.hour) ?? byHour.set(h.hour, { reliable: 0, samples: 0 }).get(h.hour)!
    slot.reliable += h.reliable_share * h.samples
    slot.samples += h.samples
  }
  return (
    [...byHour.entries()]
      // A handful of gaps (the first trains of the day) can swing from 0% to 100%.
      .filter(([, s]) => s.samples >= MIN_RELIABILITY_SAMPLES)
      .map(([hour, s]) => ({ hour, share: s.reliable / s.samples, samples: s.samples }))
      .sort((a, b) => serviceOrder(a.hour) - serviceOrder(b.hour))
  )
}

/** Hours in service-day order: 3 a.m. first, the after-midnight hours last. */
export function serviceOrder(hour: number): number {
  return hour < SERVICE_DAY_START_HOUR ? hour + 24 : hour
}

/** "Oct 3 – Nov 27" for a YYYYMMDD range. */
export function dateRangeText(from: number, to: number): string {
  const fmt = (d: number) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      Date.UTC(Math.floor(d / 10000), Math.floor((d % 10000) / 100) - 1, d % 100),
    )
  return `${fmt(from)} – ${fmt(to)}`
}
