import type { PredictionsDocument, Resource, TripAttributes } from '../api/mbtaTypes'
import { LINES, branchForRoute, lineForRoute, type LineId } from './lines'

/** One train expected to leave a station. */
export interface Departure {
  tripId: string
  line: LineId
  routeId: string
  branch: string | null
  headsign: string
  /** When it is expected to leave, in epoch ms. */
  at: number
}

/** Departures that go the same way: same route and destination. */
export interface DepartureGroup {
  key: string
  line: LineId
  routeId: string
  branch: string | null
  headsign: string
  /** The soonest departures first. */
  times: number[]
}

const NOT_SERVED = new Set(['SKIPPED', 'CANCELLED'])
const LINE_ORDER = new Map(LINES.map((l, i) => [l.id, i]))

/**
 * Turns the /predictions response for one station (requested with include=trip) into
 * departures a rider could board there.
 * - Only in-scope lines.
 * - Only predictions with a departure time: an arrival with no departure is a train
 *   ending its trip here, which nobody can board.
 * - One entry per train. The MBTA can repeat a prediction, and it reports each car of a
 *   Green Line train as its own trip with the same platform and departure time, so
 *   departures from the same platform at the same moment count as one train.
 */
export function parseDepartures(doc: PredictionsDocument): Departure[] {
  const headsigns = new Map<string, string>()
  for (const r of doc.included ?? []) {
    if (r.type !== 'trip') continue
    const headsign = (r as Resource<TripAttributes>).attributes?.headsign
    if (headsign) headsigns.set(r.id, headsign)
  }

  const byTrain = new Map<string, Departure>()
  const seenTrips = new Set<string>()
  for (const p of doc.data ?? []) {
    const a = p.attributes ?? {}
    if (NOT_SERVED.has(a.schedule_relationship ?? '')) continue
    const routeId = p.relationships?.route?.data?.id ?? null
    const line = lineForRoute(routeId)
    const tripId = p.relationships?.trip?.data?.id
    if (!line || !routeId || !tripId || !a.departure_time) continue
    const at = Date.parse(a.departure_time)
    if (!Number.isFinite(at) || seenTrips.has(tripId)) continue
    seenTrips.add(tripId)
    const platform = p.relationships?.stop?.data?.id ?? routeId
    const trainKey = `${platform}|${at}`
    if (byTrain.has(trainKey)) continue
    byTrain.set(trainKey, {
      tripId,
      line,
      routeId,
      branch: branchForRoute(routeId),
      headsign: headsigns.get(tripId) ?? 'Destination unknown',
      at,
    })
  }
  return [...byTrain.values()]
}

/**
 * Groups departures by route and destination for the station card, keeping the next
 * few of each and dropping any that left more than 30 s ago.
 * Groups are ordered by line, then route, then whichever leaves first.
 */
export function groupDepartures(
  departures: readonly Departure[],
  now: number,
  perGroup = 3,
): DepartureGroup[] {
  const groups = new Map<string, DepartureGroup>()
  for (const d of departures) {
    if (d.at < now - 30_000) continue
    const key = `${d.routeId}|${d.headsign}`
    const group =
      groups.get(key) ??
      groups
        .set(key, {
          key,
          line: d.line,
          routeId: d.routeId,
          branch: d.branch,
          headsign: d.headsign,
          times: [],
        })
        .get(key)!
    group.times.push(d.at)
  }
  for (const g of groups.values()) g.times = g.times.sort((a, b) => a - b).slice(0, perGroup)
  return [...groups.values()].sort(
    (a, b) =>
      (LINE_ORDER.get(a.line) ?? 0) - (LINE_ORDER.get(b.line) ?? 0) ||
      a.routeId.localeCompare(b.routeId) ||
      a.times[0] - b.times[0],
  )
}
