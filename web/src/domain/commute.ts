import type { Resource, ScheduleAttributes, SchedulesDocument, TripAttributes } from '../api/mbtaTypes'
import type { Departure } from './departures'
import { branchForRoute, lineForRoute } from './lines'

// My Commute (Sprint 4, planning file 06): one saved stop and direction per commute,
// with official departures and a "when to leave" recommendation.

/** A commute saved on this device. No account, nothing sent anywhere (09 privacy). */
export interface Commute {
  id: string
  /** The rider's own name for it, e.g. "Work". */
  name: string
  /** Parent station the rider boards at, e.g. "place-knncl". */
  stationId: string
  stationName: string
  /** One route, e.g. "Red" or "Green-B". */
  routeId: string
  directionId: 0 | 1
  /** Optional stop the rider gets off at. Shown only in Sprint 4 (arrival there is Sprint 8). */
  destinationId: string | null
  destinationName: string | null
  /** Minutes from the door to the platform. */
  walkMin: number
  /** Extra minutes of safety margin. */
  bufferMin: number
}

export const STORAGE_KEY = 'enroute.commutes.v1'
export const MAX_COMMUTES = 10
export const MAX_WALK_MIN = 60
export const MAX_BUFFER_MIN = 30
const MAX_NAME_LENGTH = 40

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isMinutes(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
}

/**
 * Checks one stored commute. Anything in browser storage may be old, edited by hand or
 * corrupt, so every field is checked rather than trusted; a bad entry is dropped, not fixed.
 */
function toCommute(raw: unknown): Commute | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (!isText(c.id) || !isText(c.name) || !isText(c.stationId) || !isText(c.stationName)) {
    return null
  }
  if (!isText(c.routeId) || !lineForRoute(c.routeId)) return null
  if (c.directionId !== 0 && c.directionId !== 1) return null
  const hasDestination = isText(c.destinationId) && isText(c.destinationName)
  if (!isMinutes(c.walkMin, MAX_WALK_MIN) || !isMinutes(c.bufferMin, MAX_BUFFER_MIN)) return null
  return {
    id: c.id,
    name: c.name.slice(0, MAX_NAME_LENGTH),
    stationId: c.stationId,
    stationName: c.stationName,
    routeId: c.routeId,
    directionId: c.directionId,
    destinationId: hasDestination ? (c.destinationId as string) : null,
    destinationName: hasDestination ? (c.destinationName as string) : null,
    walkMin: c.walkMin,
    bufferMin: c.bufferMin,
  }
}

/** Reads the stored list. Missing, unreadable or malformed storage gives an empty list. */
export function parseCommutes(stored: string | null): Commute[] {
  if (!stored) return []
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const commutes: Commute[] = []
    for (const item of parsed) {
      const commute = toCommute(item)
      if (!commute || seen.has(commute.id)) continue
      seen.add(commute.id)
      commutes.push(commute)
    }
    return commutes.slice(0, MAX_COMMUTES)
  } catch {
    return []
  }
}

export function serializeCommutes(commutes: readonly Commute[]): string {
  return JSON.stringify(commutes)
}

/** Builds a commute from the form, or explains what is wrong with it. */
export function createCommute(
  input: Omit<Commute, 'id'>,
  id: string,
): { ok: true; commute: Commute } | { ok: false; error: string } {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Give the commute a name.' }
  if (input.destinationId && input.destinationId === input.stationId) {
    return { ok: false, error: 'The destination must be a different station.' }
  }
  const commute = toCommute({ ...input, name, id })
  if (!commute) return { ok: false, error: 'Some details are missing or out of range.' }
  return { ok: true, commute }
}

/**
 * The same journey the other way. With a destination, the two stations swap
 * (Kendall -> Park Street becomes Park Street -> Kendall); without one, only the
 * direction flips. Walk time stays: it belongs to wherever the rider starts.
 */
export function reverseCommute(commute: Commute): Commute {
  const directionId = commute.directionId === 0 ? 1 : 0
  if (!commute.destinationId || !commute.destinationName) return { ...commute, directionId }
  return {
    ...commute,
    directionId,
    stationId: commute.destinationId,
    stationName: commute.destinationName,
    destinationId: commute.stationId,
    destinationName: commute.stationName,
  }
}

/** A departure shown on a commute, with where its time comes from. */
export interface CommuteDeparture extends Departure {
  /** "live" = official real-time prediction; "scheduled" = the timetable. */
  source: 'live' | 'scheduled'
}

/**
 * Turns /schedules for one station, route and direction (with include=trip) into
 * departures. Stops where riders cannot board (pickup_type 1, e.g. the last stop) and
 * entries without a departure time are left out.
 */
export function parseScheduledDepartures(doc: SchedulesDocument): Departure[] {
  const headsigns = new Map<string, string>()
  for (const r of doc.included ?? []) {
    if (r.type !== 'trip') continue
    const headsign = (r as Resource<TripAttributes>).attributes?.headsign
    if (headsign) headsigns.set(r.id, headsign)
  }
  const seen = new Set<string>()
  const departures: Departure[] = []
  for (const s of doc.data ?? []) {
    const a: ScheduleAttributes = s.attributes ?? {}
    if (a.pickup_type === 1 || !a.departure_time) continue
    const routeId = s.relationships?.route?.data?.id ?? null
    const line = lineForRoute(routeId)
    const tripId = s.relationships?.trip?.data?.id
    if (!line || !routeId || !tripId || seen.has(tripId)) continue
    const at = Date.parse(a.departure_time)
    if (!Number.isFinite(at)) continue
    seen.add(tripId)
    departures.push({
      tripId,
      line,
      routeId,
      branch: branchForRoute(routeId),
      headsign: headsigns.get(tripId) ?? 'Destination unknown',
      at,
    })
  }
  return departures
}

/** How long ago a departure may be and still be listed ("leaving now"). */
const JUST_LEFT_MS = 30_000

/**
 * The next departures to show. Live predictions win whenever there are any. The
 * timetable is used only when there are none (early morning, or a failed feed), because
 * live subway trips often carry different IDs from timetable trips and mixing the two
 * lists would show the same train twice.
 */
export function chooseDepartures(
  live: readonly Departure[],
  scheduled: readonly Departure[],
  now: number,
  count = 3,
): CommuteDeparture[] {
  const ahead = (list: readonly Departure[]) =>
    list.filter((d) => d.at >= now - JUST_LEFT_MS).sort((a, b) => a.at - b.at)
  const liveAhead = ahead(live)
  if (liveAhead.length > 0) {
    return liveAhead.slice(0, count).map((d) => ({ ...d, source: 'live' as const }))
  }
  return ahead(scheduled)
    .slice(0, count)
    .map((d) => ({ ...d, source: 'scheduled' as const }))
}

export type LeaveAdvice =
  | { kind: 'leave-in'; minutes: number }
  | { kind: 'leave-now' }
  | { kind: 'miss' }

/**
 * When to leave for one departure: T_leave = T_departure - walk - buffer (06, section 3).
 * Minutes are rounded down: telling a rider 7 when it is really 6.5 would make them late.
 */
export function leaveAdvice(
  departureAt: number,
  now: number,
  walkMin: number,
  bufferMin: number,
): LeaveAdvice {
  const spareMs = departureAt - now - (walkMin + bufferMin) * 60_000
  if (spareMs < 0) return { kind: 'miss' }
  const minutes = Math.floor(spareMs / 60_000)
  return minutes < 1 ? { kind: 'leave-now' } : { kind: 'leave-in', minutes }
}

/**
 * The departure to recommend: the first one the rider can still make. When the soonest
 * would be missed, the rider is told so and pointed at this one instead.
 */
export function recommendDeparture(
  departures: readonly CommuteDeparture[],
  now: number,
  walkMin: number,
  bufferMin: number,
): { departure: CommuteDeparture; advice: LeaveAdvice; missedEarlier: boolean } | null {
  for (let i = 0; i < departures.length; i++) {
    const advice = leaveAdvice(departures[i].at, now, walkMin, bufferMin)
    if (advice.kind !== 'miss') return { departure: departures[i], advice, missedEarlier: i > 0 }
  }
  return null
}
