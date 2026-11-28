import type { Commute } from './commute'
import type { LineAlert } from './lineStatus'

/**
 * How an official alert relates to a saved commute (planning file 05, section 3):
 * - direct: it affects this trip
 * - indirect: same route, somewhere the trip doesn't go (possible knock-on delays)
 * - unknown: same route, but the trip's stretch is not known yet; never shown as "none"
 * - none: a different route
 */
export type Relevance = 'direct' | 'indirect' | 'unknown' | 'none'

/**
 * `stretch` is the set of stations the commute rides through (commuteFocus), or null
 * while the line data is still loading.
 *
 * A suspension (trains not running) on the stretch, in the commute's direction, affects
 * the trip. A station closure affects it only at the stations the rider uses, boarding or
 * getting off: a closed station mid-trip is one the train runs through.
 */
export function alertRelevance(
  alert: LineAlert,
  commute: Commute,
  stretch: ReadonlySet<string> | null,
): Relevance {
  const onRoute = alert.entities.filter((e) => e.routeId === commute.routeId)
  if (onRoute.length === 0) return 'none'

  const ends = new Set([commute.stationId, commute.destinationId].filter((id) => id !== null))
  let unknown = false
  for (const e of onRoute) {
    if (e.directionId !== null && e.directionId !== commute.directionId) continue
    if (e.stationId === null) return 'direct' // the whole route
    if (ends.has(e.stationId)) return 'direct'
    if (e.ride) {
      if (stretch === null) unknown = true
      else if (stretch.has(e.stationId)) return 'direct'
    }
  }
  return unknown ? 'unknown' : 'indirect'
}
