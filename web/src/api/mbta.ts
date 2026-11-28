import { IN_SCOPE_ROUTE_IDS, LINES } from '../domain/lines'
import type {
  AlertsDocument,
  PredictionsDocument,
  RoutePatternsDocument,
  RoutesDocument,
  SchedulesDocument,
  StopsDocument,
  VehiclesDocument,
} from './mbtaTypes'

// Every request the app makes to the MBTA V3 API lives in this file.
// Requests are anonymous: no API key is ever shipped to the browser (DEC-021).
// The anonymous limit is 20 requests per minute per network address.

// Overridable at build time (VITE_MBTA_BASE_URL) so tests can point a build at a local
// stand-in that fails on purpose. Production always uses the real MBTA API.
const BASE_URL: string = import.meta.env.VITE_MBTA_BASE_URL || 'https://api-v3.mbta.com'

/**
 * The MBTA does not expose its x-ratelimit-reset header to browsers (no
 * Access-Control-Expose-Headers), so after an HTTP 429 we wait one full
 * rate-limit window instead of reading the exact reset time.
 */
export const RATE_LIMIT_WAIT_MS = 60_000

export type MbtaErrorKind = 'network' | 'rate-limit' | 'http' | 'bad-response'

export class MbtaError extends Error {
  readonly kind: MbtaErrorKind
  readonly status: number | null
  /** For rate-limit errors: when it is safe to ask again (epoch ms). */
  readonly retryAt: number | null

  constructor(
    kind: MbtaErrorKind,
    message: string,
    status: number | null = null,
    retryAt: number | null = null,
  ) {
    super(message)
    this.name = 'MbtaError'
    this.kind = kind
    this.status = status
    this.retryAt = retryAt
  }
}

export function isRateLimit(error: unknown): error is MbtaError {
  return error instanceof MbtaError && error.kind === 'rate-limit'
}

/** A short, human explanation of a failed request. */
export function describeError(error: unknown): string {
  if (!(error instanceof MbtaError)) return 'Something went wrong loading MBTA data.'
  switch (error.kind) {
    case 'network':
      return 'Could not reach the MBTA. Check your connection.'
    case 'rate-limit':
      return 'The MBTA asked us to slow down. Waiting a minute before asking again.'
    case 'http':
      return `The MBTA returned an error (HTTP ${error.status}).`
    case 'bad-response':
      return 'The MBTA sent a response we could not read.'
  }
}

/**
 * One shared "wait until" for every MBTA request. The limit is per network address,
 * so once any request gets HTTP 429 all of them hold off until the wait is over,
 * instead of each query discovering the limit on its own.
 */
let rateLimitedUntil = 0

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (Date.now() < rateLimitedUntil) {
    throw new MbtaError('rate-limit', 'Rate limited', 429, rateLimitedUntil)
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      signal,
      headers: { Accept: 'application/vnd.api+json' },
    })
  } catch (error) {
    // A cancelled request is not a failure; let the caller see the abort as-is.
    if (signal?.aborted) throw error
    throw new MbtaError('network', 'Network request failed')
  }

  if (response.status === 429) {
    rateLimitedUntil = Date.now() + RATE_LIMIT_WAIT_MS
    throw new MbtaError('rate-limit', 'Rate limited', 429, rateLimitedUntil)
  }
  if (!response.ok) {
    throw new MbtaError('http', `HTTP ${response.status}`, response.status)
  }

  try {
    const body = (await response.json()) as T & { data?: unknown }
    if (!body || !Array.isArray(body.data)) throw new Error('Missing data array')
    return body
  } catch {
    throw new MbtaError('bad-response', 'Unreadable response', response.status)
  }
}

const routeFilter = IN_SCOPE_ROUTE_IDS.join(',')

/** Live vehicles on every in-scope route, with their trip (headsign) and stop (name). */
export function fetchVehicles(signal?: AbortSignal): Promise<VehiclesDocument> {
  return getJson(
    `/vehicles?filter[route]=${routeFilter}&include=trip,stop` +
      '&fields[vehicle]=label,latitude,longitude,bearing,current_status,direction_id,updated_at' +
      '&fields[trip]=headsign&fields[stop]=name',
    signal,
  )
}

/** One clean shape per route and direction ("canonical" patterns), for drawing the lines. */
export function fetchRoutePatterns(signal?: AbortSignal): Promise<RoutePatternsDocument> {
  return getJson(
    `/route_patterns?filter[route]=${routeFilter}&filter[canonical]=true` +
      '&include=representative_trip.shape&fields[shape]=polyline&fields[trip]=shape',
    signal,
  )
}

/** Stations on one line. Asked per line because a combined request loses which line each stop is on. */
export function fetchStops(
  routeIds: readonly string[],
  signal?: AbortSignal,
): Promise<StopsDocument> {
  return getJson(
    `/stops?filter[route]=${routeIds.join(',')}&fields[stop]=name,latitude,longitude`,
    signal,
  )
}

/**
 * Alerts on any in-scope route, active now or upcoming (Sprint 5): upcoming notices such
 * as weekend shutdowns are shown ahead of time. Still one request a minute.
 */
export function fetchAlerts(signal?: AbortSignal): Promise<AlertsDocument> {
  return getJson(
    `/alerts?filter[route]=${routeFilter}` +
      '&fields[alert]=header,description,effect,severity,lifecycle,informed_entity,active_period,updated_at',
    signal,
  )
}

/** Upcoming stops and arrival estimates for one trip, fetched when a train is selected. */
export function fetchTripPredictions(
  tripId: string,
  signal?: AbortSignal,
): Promise<PredictionsDocument> {
  return getJson(
    `/predictions?filter[trip]=${encodeURIComponent(tripId)}&include=stop` +
      '&fields[prediction]=arrival_time,departure_time,stop_sequence,schedule_relationship&fields[stop]=name,parent_station',
    signal,
  )
}

/** Trains expected at one station (all its platforms), with the headsign of each trip. */
export function fetchStationPredictions(
  stationId: string,
  signal?: AbortSignal,
): Promise<PredictionsDocument> {
  return getJson(
    `/predictions?filter[stop]=${encodeURIComponent(stationId)}&filter[route]=${routeFilter}&include=trip` +
      '&fields[prediction]=arrival_time,departure_time,schedule_relationship&fields[trip]=headsign',
    signal,
  )
}

/**
 * Subway routes that stop at one station, e.g. Kenmore -> Green-B, Green-C, Green-D.
 * Asked once when a station is picked in the commute form (the map only knows lines).
 */
export function fetchRoutesAtStation(stationId: string, signal?: AbortSignal) {
  return getJson<RoutesDocument>(
    `/routes?filter[stop]=${encodeURIComponent(stationId)}&filter[type]=0,1&fields[route]=type`,
    signal,
  )
}

/** Trains expected at one station on one route, going one way (My Commute). */
export function fetchCommutePredictions(
  stationId: string,
  routeId: string,
  directionId: 0 | 1,
  signal?: AbortSignal,
): Promise<PredictionsDocument> {
  return getJson(
    `/predictions?filter[stop]=${encodeURIComponent(stationId)}` +
      `&filter[route]=${encodeURIComponent(routeId)}&filter[direction_id]=${directionId}` +
      '&include=trip&fields[prediction]=arrival_time,departure_time,schedule_relationship' +
      '&fields[trip]=headsign',
    signal,
  )
}

/**
 * Timetable departures for the same station, route and direction, from a time onwards.
 * Asked only when there is no live prediction, so a normal day spends no request on it.
 * `date` and `minTime` come from serviceDayQuery (minTime can be past 24:00).
 */
export function fetchCommuteSchedules(
  stationId: string,
  routeId: string,
  directionId: 0 | 1,
  date: string,
  minTime: string,
  signal?: AbortSignal,
): Promise<SchedulesDocument> {
  return getJson(
    `/schedules?filter[stop]=${encodeURIComponent(stationId)}` +
      `&filter[route]=${encodeURIComponent(routeId)}&filter[direction_id]=${directionId}` +
      `&filter[date]=${date}&filter[min_time]=${minTime}&sort=departure_time&page[limit]=6` +
      '&include=trip&fields[schedule]=departure_time,pickup_type&fields[trip]=headsign',
    signal,
  )
}

export const LINE_ROUTE_GROUPS = LINES.map((line) => ({ line: line.id, routeIds: line.routeIds }))
