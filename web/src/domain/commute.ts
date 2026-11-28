import type {
  Resource,
  ScheduleAttributes,
  SchedulesDocument,
  TripAttributes,
} from '../api/mbtaTypes'
import type { Departure } from './departures'
import {
  BRANCH_ONLY_STATIONS,
  BRANCH_TERMINUS_HEADSIGN,
  branchForRoute,
  directionDestination,
  lineForRoute,
} from './lines'

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

/** Before this hour (Boston time), trains still belong to the previous day's timetable. */
const SERVICE_DAY_START_HOUR = 3

/**
 * The timetable day and earliest time to ask /schedules for, in Boston time.
 * MBTA service days run past midnight: a train at 12:40 a.m. Saturday is in Friday's
 * timetable as 24:40. So before 3 a.m. this asks for the previous day with the hour + 24,
 * or late-night riders would be told there are no trains while trains are still running.
 */
export function serviceDayQuery(now: number): { date: string; minTime: string } {
  const parts = bostonParts(now)
  if (parts.hour >= SERVICE_DAY_START_HOUR) {
    return { date: parts.date, minTime: `${pad(parts.hour)}:${pad(parts.minute)}` }
  }
  // Noon on the previous calendar day is safely inside that day whatever the clocks do.
  const previous = bostonParts(Date.parse(`${parts.date}T12:00:00Z`) - 24 * 3600_000)
  return { date: previous.date, minTime: `${pad(parts.hour + 24)}:${pad(parts.minute)}` }
}

const bostonFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function bostonParts(at: number): { date: string; hour: number; minute: number } {
  const get = (type: string) =>
    bostonFormat.formatToParts(at).find((p) => p.type === type)?.value ?? '00'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** A normal walking pace: 80 m a minute is about 4.8 km/h. */
export const WALK_METRES_PER_MIN = 80
/** Streets are not straight lines; a walk is typically about 30% longer than the crow flies. */
export const WALK_DETOUR = 1.3
/** Further than this, nobody walks to the station, so no walking estimate is given. */
export const MAX_WALK_ESTIMATE_M = 3000

export interface Point {
  lat: number
  lon: number
}

/** Straight-line distance in metres between two points (haversine formula). */
export function distanceMetres(a: Point, b: Point): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type WalkEstimate = { kind: 'walk'; minutes: number } | { kind: 'too-far'; metres: number }

/**
 * Minutes to walk from the rider's position to the station. An estimate from the
 * straight-line distance, not a route: working out a real walking route would mean
 * sending the rider's location to a mapping service, and it never leaves the browser.
 * Rounded up, like the leave-time advice, so the rider is never late.
 */
export function walkFromHere(here: Point, station: Point): WalkEstimate {
  const metres = distanceMetres(here, station)
  if (metres > MAX_WALK_ESTIMATE_M) return { kind: 'too-far', metres }
  return {
    kind: 'walk',
    minutes: Math.max(1, Math.ceil((metres * WALK_DETOUR) / WALK_METRES_PER_MIN)),
  }
}

/**
 * Whether a train with this headsign gets the rider to their destination. Matters where a
 * line splits: an Ashmont train never reaches Quincy Center, though both leave Kendall
 * southbound on the Red Line. Without a destination, or before a split, every train counts.
 */
export function reachesDestination(headsign: string | null, commute: Commute): boolean {
  if (!commute.destinationId) return true
  const terminus = BRANCH_ONLY_STATIONS[commute.destinationId]
  // Branch-only stations are south of the split, so only southbound (direction 0) trains
  // can miss them; northbound, every train from a branch runs up the shared trunk.
  if (!terminus || commute.directionId !== 0) return true
  return headsign === BRANCH_TERMINUS_HEADSIGN[terminus]
}

/**
 * Where the commute's trains are headed, for labels: the branch terminus when the
 * destination decides it ("Braintree" for Quincy Center), else the direction's usual
 * label ("Ashmont/Braintree").
 */
export function commuteToward(commute: Commute): string {
  const terminus =
    commute.destinationId && commute.directionId === 0
      ? BRANCH_ONLY_STATIONS[commute.destinationId]
      : undefined
  return terminus
    ? BRANCH_TERMINUS_HEADSIGN[terminus]
    : directionDestination(commute.routeId, commute.directionId)
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
  { kind: 'leave-in'; minutes: number } | { kind: 'leave-now' } | { kind: 'miss' }

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
 * would be missed, `missed` says how many are out of reach, so the rider is told so.
 */
export function recommendDeparture(
  departures: readonly CommuteDeparture[],
  now: number,
  walkMin: number,
  bufferMin: number,
): { departure: CommuteDeparture; advice: LeaveAdvice; missed: number } | null {
  for (let i = 0; i < departures.length; i++) {
    const advice = leaveAdvice(departures[i].at, now, walkMin, bufferMin)
    if (advice.kind !== 'miss') return { departure: departures[i], advice, missed: i }
  }
  return null
}
