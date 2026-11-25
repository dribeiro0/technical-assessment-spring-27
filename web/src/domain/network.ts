import type {
  Resource,
  RoutePatternsDocument,
  ShapeAttributes,
  StopsDocument,
} from '../api/mbtaTypes'
import { LINES, lineForRoute, type LineId } from './lines'
import { decodePolyline } from './polyline'

export interface RouteShape {
  id: string
  line: LineId
  routeId: string
  points: [number, number][]
}

export interface Station {
  id: string
  name: string
  lat: number
  lon: number
  /** Lines serving this station; more than one at transfer stations like Park Street. */
  lines: LineId[]
}

export interface Network {
  shapes: RouteShape[]
  stations: Station[]
}

/**
 * Builds the static map layer: line paths and stations.
 * Only direction 0 of each canonical pattern is drawn, so each track appears once.
 * The Red Line has two direction-0 patterns (Ashmont and Braintree branches).
 */
export function buildNetwork(
  patterns: RoutePatternsDocument,
  stopsByLine: { line: LineId; doc: StopsDocument }[],
): Network {
  const included = new Map<string, Resource<unknown>>()
  for (const r of patterns.included ?? []) included.set(`${r.type}:${r.id}`, r)

  const shapes: RouteShape[] = []
  for (const pattern of patterns.data ?? []) {
    const attrs = (pattern.attributes ?? {}) as { direction_id?: number }
    if (attrs.direction_id !== 0) continue
    const routeId = pattern.relationships?.route?.data?.id ?? null
    const line = lineForRoute(routeId)
    if (!line || !routeId) continue

    const tripId = pattern.relationships?.representative_trip?.data?.id
    const trip = tripId ? included.get(`trip:${tripId}`) : undefined
    const shapeId = trip?.relationships?.shape?.data?.id
    const shape = shapeId
      ? (included.get(`shape:${shapeId}`) as Resource<ShapeAttributes> | undefined)
      : undefined
    const encoded = shape?.attributes?.polyline
    if (!encoded) continue

    const points = decodePolyline(encoded)
    if (points.length > 1) shapes.push({ id: pattern.id, line, routeId, points })
  }

  const stations = new Map<string, Station>()
  const lineOrder = LINES.map((l) => l.id)
  for (const { line, doc } of stopsByLine) {
    for (const stop of doc.data ?? []) {
      const { name, latitude, longitude } = stop.attributes ?? {}
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || !name) continue
      const existing = stations.get(stop.id)
      if (existing) {
        if (!existing.lines.includes(line)) {
          existing.lines.push(line)
          existing.lines.sort((a, b) => lineOrder.indexOf(a) - lineOrder.indexOf(b))
        }
      } else {
        stations.set(stop.id, { id: stop.id, name, lat: latitude, lon: longitude, lines: [line] })
      }
    }
  }

  return { shapes, stations: [...stations.values()] }
}
