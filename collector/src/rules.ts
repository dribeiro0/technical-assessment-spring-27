// The collector's rules (Sprint 6, planning files 07 and 08), as plain functions with no
// database and no network, so each can be tested on its own.

/** Routes recorded: the same subway lines as the site. Mattapan joins in Sprint 9. */
export const ROUTES = ['Red', 'Orange', 'Blue', 'Green-B', 'Green-C', 'Green-D', 'Green-E']

/** The collector is scheduled every minute. */
export const RUN_EVERY_MS = 60_000
/**
 * Longer than this since the last successful run is a gap. One missed run is tolerated
 * (scheduled runs can drift by seconds); two or more in a row is recorded.
 */
export const GAP_AFTER_MS = 2.5 * RUN_EVERY_MS
/** Raw positions are detailed and large: kept 14 days (07 section 6). Events stay. */
export const RAW_RETENTION_DAYS = 14

/** One vehicle position as stored: what the MBTA said, and when we heard it. */
export interface VehicleObservation {
  vehicleId: string
  /** Source time: when the MBTA says the vehicle reported (epoch ms). */
  updatedAt: number
  /** Retrieval time: when the collector received it (epoch ms). */
  retrievedAt: number
  routeId: string
  directionId: number | null
  tripId: string | null
  stopId: string | null
  lat: number
  lon: number
  bearing: number | null
  status: string | null
}

/** One version of an alert: a new row whenever the MBTA updates it. */
export interface AlertVersion {
  alertId: string
  updatedAt: number
  retrievedAt: number
  effect: string | null
  severity: number | null
  lifecycle: string | null
  header: string | null
  routes: string
}

interface Resource {
  id: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, { data?: { id?: string } | null } | undefined>
}

function time(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const str = (value: unknown) => (typeof value === 'string' && value ? value : null)

/**
 * Raw /vehicles response -> observations. Only in-scope routes with coordinates and a
 * valid source time are kept: a record without them cannot be placed in history.
 */
export function vehicleObservations(doc: { data?: Resource[] }, retrievedAt: number): VehicleObservation[] {
  const out: VehicleObservation[] = []
  for (const v of doc.data ?? []) {
    const a = v.attributes ?? {}
    const routeId = v.relationships?.route?.data?.id ?? null
    const updatedAt = time(a.updated_at)
    const lat = num(a.latitude)
    const lon = num(a.longitude)
    if (!routeId || !ROUTES.includes(routeId) || updatedAt === null || lat === null || lon === null) {
      continue
    }
    out.push({
      vehicleId: v.id,
      updatedAt,
      retrievedAt,
      routeId,
      directionId: num(a.direction_id),
      tripId: v.relationships?.trip?.data?.id ?? null,
      stopId: v.relationships?.stop?.data?.id ?? null,
      lat,
      lon,
      bearing: num(a.bearing),
      status: str(a.current_status),
    })
  }
  return out
}

/** Raw /alerts response -> alert versions, one per alert and update time. */
export function alertVersions(doc: { data?: Resource[] }, retrievedAt: number): AlertVersion[] {
  const out: AlertVersion[] = []
  for (const r of doc.data ?? []) {
    const a = r.attributes ?? {}
    const updatedAt = time(a.updated_at)
    if (updatedAt === null) continue
    const entities = Array.isArray(a.informed_entity) ? (a.informed_entity as { route?: unknown }[]) : []
    const routes = [...new Set(entities.map((e) => str(e.route)).filter((x): x is string => !!x))]
    out.push({
      alertId: r.id,
      updatedAt,
      retrievedAt,
      effect: str(a.effect),
      severity: num(a.severity),
      lifecycle: str(a.lifecycle),
      header: str(a.header),
      routes: routes.join(','),
    })
  }
  return out
}

/**
 * The same vehicle with the same source time is the same observation (07 section 5):
 * stored once, however often it is fetched or replayed.
 */
export function observationKey(o: Pick<VehicleObservation, 'vehicleId' | 'updatedAt'>): string {
  return `${o.vehicleId}@${o.updatedAt}`
}

/** Collapses repeats within one batch (the database also refuses repeats across batches). */
export function dedupe(observations: readonly VehicleObservation[]): VehicleObservation[] {
  const seen = new Map<string, VehicleObservation>()
  for (const o of observations) if (!seen.has(observationKey(o))) seen.set(observationKey(o), o)
  return [...seen.values()]
}

/**
 * Whether an incoming report may replace the stored current state. An older source time
 * never overwrites a newer one; it stays in raw history only (07 section 5).
 */
export function replacesCurrent(storedUpdatedAt: number | null, incomingUpdatedAt: number): boolean {
  return storedUpdatedAt === null || incomingUpdatedAt > storedUpdatedAt
}

export interface Gap {
  start: number
  end: number
}

/**
 * The gap to record when a run succeeds: from the previous success to now, if that is
 * longer than one missed run. Null on the very first run, or when nothing was missed.
 * The gap is recorded once, by the run that ends it, so a long outage is one event.
 */
export function gapSince(lastSuccessAt: number | null, now: number): Gap | null {
  if (lastSuccessAt === null) return null
  return now - lastSuccessAt > GAP_AFTER_MS ? { start: lastSuccessAt, end: now } : null
}

/** Raw rows retrieved before this time are deleted. */
export function rawCutoff(now: number, days = RAW_RETENTION_DAYS): number {
  return now - days * 24 * 3600_000
}
