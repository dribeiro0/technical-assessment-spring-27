import type {
  Resource,
  StopAttributes,
  TripAttributes,
  VehicleAttributes,
  VehiclesDocument,
} from '../api/mbtaTypes'
import { LINES, branchForRoute, lineForRoute } from './lines'
import type { Vehicle, VehicleStatus } from './vehicle'

const STATUS_BY_FEED_VALUE: Record<string, VehicleStatus> = {
  STOPPED_AT: 'stopped',
  INCOMING_AT: 'incoming',
  IN_TRANSIT_TO: 'in-transit',
}

const LINE_ORDER = new Map(LINES.map((line, index) => [line.id, index]))

function isUsableCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  )
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Turns the raw /vehicles response (requested with include=trip,stop) into Vehicles.
 *
 * Inclusion rules, so counts can be reproduced:
 * - only routes on an in-scope line (Mattapan and anything else are dropped)
 * - only vehicles with usable coordinates and a valid updated_at time
 * - one record per vehicle ID; if the feed repeats an ID, the newest report wins
 *
 * Freshness (aging/expired) is applied later against the current time, not here.
 */
export function normalizeVehicles(doc: VehiclesDocument): Vehicle[] {
  const included = new Map<string, Resource<unknown>>()
  for (const resource of doc.included ?? []) {
    included.set(`${resource.type}:${resource.id}`, resource)
  }

  const byId = new Map<string, Vehicle>()

  for (const raw of doc.data ?? []) {
    const attrs: VehicleAttributes = raw.attributes ?? {}
    const routeId = raw.relationships?.route?.data?.id ?? null
    const line = lineForRoute(routeId)
    if (!line || !routeId) continue
    if (!isUsableCoordinate(attrs.latitude, attrs.longitude)) continue

    const updatedAt = attrs.updated_at ? Date.parse(attrs.updated_at) : NaN
    if (!Number.isFinite(updatedAt)) continue

    const tripRef = raw.relationships?.trip?.data
    const stopRef = raw.relationships?.stop?.data
    const trip = tripRef
      ? (included.get(`trip:${tripRef.id}`) as Resource<TripAttributes> | undefined)
      : undefined
    const stop = stopRef
      ? (included.get(`stop:${stopRef.id}`) as Resource<StopAttributes> | undefined)
      : undefined

    const directionId =
      attrs.direction_id === 0 || attrs.direction_id === 1 ? attrs.direction_id : null
    const bearing =
      typeof attrs.bearing === 'number' && Number.isFinite(attrs.bearing) ? attrs.bearing : null

    const vehicle: Vehicle = {
      id: raw.id,
      label: textOrNull(attrs.label) ?? raw.id,
      line,
      routeId,
      branch: branchForRoute(routeId),
      lat: attrs.latitude as number,
      lon: attrs.longitude as number,
      bearing,
      status: STATUS_BY_FEED_VALUE[attrs.current_status ?? ''] ?? 'unknown',
      stopName: textOrNull(stop?.attributes?.name),
      headsign: textOrNull(trip?.attributes?.headsign),
      directionId,
      updatedAt,
    }

    const existing = byId.get(vehicle.id)
    if (!existing || vehicle.updatedAt > existing.updatedAt) byId.set(vehicle.id, vehicle)
  }

  return [...byId.values()].sort(
    (a, b) =>
      (LINE_ORDER.get(a.line) ?? 0) - (LINE_ORDER.get(b.line) ?? 0) ||
      a.routeId.localeCompare(b.routeId) ||
      a.label.localeCompare(b.label, undefined, { numeric: true }),
  )
}
