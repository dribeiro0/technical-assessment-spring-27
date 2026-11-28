import type { Commute } from './commute'
import { BRANCH_ONLY_STATIONS } from './lines'
import type { Network } from './network'

// The stretch of line a commute rides, cut out of the full line shapes, so the map can
// zoom to it and fade everything else (as the line filter does for a whole line).

type LatLon = [number, number]

export interface CommuteFocus {
  /** The ridden stretch, one path per matching line shape (Red can need two). */
  paths: LatLon[][]
  /** Stations on the stretch: these stay bright, every other station fades. */
  stationIds: Set<string>
}

/** A station further than this from a line shape is not on it (e.g. the other Red branch). */
const ON_LINE_M = 250
/** A station this close to the cut stretch is drawn as part of it. */
const ON_STRETCH_M = 120

/** Metres per degree, flattened around Boston: plenty accurate over a few kilometres. */
const M_PER_DEG_LAT = 111_195
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((42.36 * Math.PI) / 180)

function toXY([lat, lon]: LatLon): [number, number] {
  return [lon * M_PER_DEG_LON, lat * M_PER_DEG_LAT]
}

function fromXY([x, y]: [number, number]): LatLon {
  return [y / M_PER_DEG_LAT, x / M_PER_DEG_LON]
}

/** The closest point to `p` on the path: which segment, where on it, and how far away. */
function closestOnPath(path: readonly LatLon[], p: LatLon) {
  const [px, py] = toXY(p)
  let best = { segment: 0, point: path[0], distance: Infinity }
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = toXY(path[i])
    const [bx, by] = toXY(path[i + 1])
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    const t =
      lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
    const qx = ax + t * dx
    const qy = ay + t * dy
    const distance = Math.hypot(px - qx, py - qy)
    if (distance < best.distance) best = { segment: i, point: fromXY([qx, qy]), distance }
  }
  return best
}

/** The part of a path between two points on it, in path order, starting and ending exactly there. */
function cut(path: readonly LatLon[], from: LatLon, to: LatLon): LatLon[] {
  let a = closestOnPath(path, from)
  let b = closestOnPath(path, to)
  if (a.segment > b.segment) [a, b] = [b, a]
  return [a.point, ...path.slice(a.segment + 1, b.segment + 1), b.point]
}

/**
 * The stretch of the commute's route between its station and destination. With no
 * destination, from the station to the end of the line in the commute's direction:
 * line shapes run in direction 0, so direction 0 goes toward the last point.
 * Null when the stations or the route's shape are not loaded.
 */
export function commuteFocus(network: Network, commute: Commute): CommuteFocus | null {
  const station = network.stations.find((s) => s.id === commute.stationId)
  if (!station) return null
  const origin: LatLon = [station.lat, station.lon]
  const destStation = commute.destinationId
    ? network.stations.find((s) => s.id === commute.destinationId)
    : undefined
  const destination: LatLon | null = destStation ? [destStation.lat, destStation.lon] : null

  // Each shape ends at a terminus (direction 0 runs toward its last point). On the Red
  // Line that tells the two branches apart; see BRANCH_ONLY_STATIONS.
  const sameLine = network.stations.filter((s) => s.lines.some((l) => station.lines.includes(l)))
  const terminusOf = (points: readonly LatLon[]) => {
    const [lat, lon] = points.at(-1)!
    let best = { id: '', distance: Infinity }
    for (const s of sameLine) {
      const d = Math.hypot((s.lat - lat) * M_PER_DEG_LAT, (s.lon - lon) * M_PER_DEG_LON)
      if (d < best.distance) best = { id: s.id, distance: d }
    }
    return best.id
  }
  const serves = (terminus: string, stationId: string) =>
    !(stationId in BRANCH_ONLY_STATIONS) || BRANCH_ONLY_STATIONS[stationId] === terminus

  const stretches: { path: LatLon[]; terminus: string }[] = []
  const seen = new Set<string>()
  for (const shape of network.shapes) {
    if (shape.routeId !== commute.routeId || shape.points.length < 2) continue
    const terminus = terminusOf(shape.points)
    if (!serves(terminus, station.id)) continue
    if (closestOnPath(shape.points, origin).distance > ON_LINE_M) continue
    let path: LatLon[]
    if (destination && destStation) {
      if (!serves(terminus, destStation.id)) continue
      if (closestOnPath(shape.points, destination).distance > ON_LINE_M) continue
      path = cut(shape.points, origin, destination)
    } else {
      const end = commute.directionId === 0 ? shape.points.at(-1)! : shape.points[0]
      path = cut(shape.points, origin, end)
    }
    // Both Red branches share the trunk: the same stretch from each counts once.
    const key = `${path.length}|${path[0]}|${path.at(-1)}`
    if (seen.has(key)) continue
    seen.add(key)
    stretches.push({ path, terminus })
  }
  if (stretches.length === 0) return null

  const stationIds = new Set<string>()
  for (const s of sameLine) {
    const at: LatLon = [s.lat, s.lon]
    const onStretch = stretches.some(
      ({ path, terminus }) =>
        serves(terminus, s.id) && closestOnPath(path, at).distance <= ON_STRETCH_M,
    )
    if (onStretch) stationIds.add(s.id)
  }
  const paths = stretches.map((s) => s.path)
  return { paths, stationIds }
}
