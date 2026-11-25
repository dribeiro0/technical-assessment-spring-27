import { IN_SCOPE_ROUTE_IDS, LINES } from '../domain/lines'
import type {
  AlertsDocument,
  RoutePatternsDocument,
  StopsDocument,
  VehiclesDocument,
} from './mbtaTypes'

// Every request the app makes to the MBTA V3 API lives in this file.
// Requests are anonymous: no API key is ever shipped to the browser (DEC-021).
// The anonymous limit is 20 requests per minute per network address.

const BASE_URL = 'https://api-v3.mbta.com'

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

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
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
    throw new MbtaError('rate-limit', 'Rate limited', 429, Date.now() + RATE_LIMIT_WAIT_MS)
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

/** Alerts active right now on any in-scope route. */
export function fetchAlerts(signal?: AbortSignal): Promise<AlertsDocument> {
  return getJson(
    `/alerts?filter[route]=${routeFilter}&filter[datetime]=NOW` +
      '&fields[alert]=header,effect,severity,lifecycle,informed_entity,updated_at',
    signal,
  )
}

export const LINE_ROUTE_GROUPS = LINES.map((line) => ({ line: line.id, routeIds: line.routeIds }))
