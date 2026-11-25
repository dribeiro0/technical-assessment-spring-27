import type { PredictionsDocument, Resource, StopAttributes } from '../api/mbtaTypes'
import type { VehicleStatus } from './vehicle'

/** One stop still ahead of a train, with the MBTA's estimate of when it gets there. */
export interface UpcomingStop {
  id: string
  name: string
  /** Estimated arrival (or departure, for the first stop) in epoch ms; null if the MBTA gives none. */
  at: number | null
}

/** Stops the train won't serve: not shown on the strip. */
const NOT_SERVED = new Set(['SKIPPED', 'CANCELLED'])

/**
 * Turns the /predictions response for one trip (requested with include=stop) into the
 * stops still ahead, in order. The last entry is the trip's destination.
 */
export function upcomingStops(doc: PredictionsDocument): UpcomingStop[] {
  const names = new Map<string, string>()
  for (const r of doc.included ?? []) {
    if (r.type !== 'stop') continue
    const name = (r as Resource<StopAttributes>).attributes?.name
    if (name) names.set(r.id, name)
  }

  return (doc.data ?? [])
    .filter((p) => !NOT_SERVED.has(p.attributes?.schedule_relationship ?? ''))
    .map((p) => {
      const stopId = p.relationships?.stop?.data?.id ?? ''
      const time = p.attributes?.arrival_time ?? p.attributes?.departure_time ?? null
      const at = time ? Date.parse(time) : NaN
      return {
        id: stopId,
        name: names.get(stopId) ?? '',
        at: Number.isFinite(at) ? at : null,
        sequence: p.attributes?.stop_sequence ?? 0,
      }
    })
    .filter((s) => s.id && s.name)
    .sort((a, b) => a.sequence - b.sequence)
    .map(({ id, name, at }) => ({ id, name, at }))
}

/** "1", "4", or "Now" when the train is under a minute away. Rounds to the nearest minute. */
export function minutesAway(at: number, now: number): { value: string; unit: string } {
  const seconds = (at - now) / 1000
  if (seconds < 60) return { value: 'Now', unit: '' }
  return { value: String(Math.round(seconds / 60)), unit: 'min' }
}

/** Predictions can lag behind a train; drop stops whose time is more than a minute past. */
export function stillAhead(stops: readonly UpcomingStop[], now: number): UpcomingStop[] {
  return stops.filter((s) => s.at === null || s.at > now - 60_000)
}

/** Short label under a stop on the strip: "4 min", "now", or "" when there's no estimate. */
export function shortEta(at: number | null, now: number): string {
  if (at === null) return ''
  const { value, unit } = minutesAway(at, now)
  return unit ? `${value} ${unit}` : 'now'
}

export interface StripStop extends UpcomingStop {
  /** True for the first stop after a gap of hidden stops (draw "…" before it). */
  afterGap: boolean
}

/**
 * The stops to draw on the card's strip: the next `count` stops, plus the destination
 * if it's further away, marked so a "…" gap can be drawn before it.
 */
export function stripStops(stops: readonly UpcomingStop[], count = 4): StripStop[] {
  if (stops.length <= count + 1) return stops.map((s) => ({ ...s, afterGap: false }))
  const head = stops.slice(0, count).map((s) => ({ ...s, afterGap: false }))
  return [...head, { ...stops[stops.length - 1], afterGap: true }]
}

/**
 * How far along the line from the train to its next stop the red fill reaches (0-1).
 * The feed only says whether the train is stopped, arriving or still travelling, so this
 * is a rough position, never a precise one.
 */
export function progressToNextStop(status: VehicleStatus): number {
  switch (status) {
    case 'stopped':
      return 1
    case 'incoming':
      return 0.8
    case 'in-transit':
      return 0.4
    default:
      return 0
  }
}
