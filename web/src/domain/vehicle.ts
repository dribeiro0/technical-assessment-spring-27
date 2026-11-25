import type { LineId } from './lines'

/** What the vehicle is doing relative to its stop, from the feed's current_status. */
export type VehicleStatus = 'stopped' | 'incoming' | 'in-transit' | 'unknown'

/**
 * The app's own model of a live vehicle. Screens only ever see this shape;
 * the raw MBTA JSON stays inside api/ and domain/normalize.ts.
 */
export interface Vehicle {
  /** MBTA vehicle ID, e.g. "R-548CD8D6". */
  id: string
  /** Car number(s) shown on the map tag, e.g. "1833". Falls back to the ID. */
  label: string
  line: LineId
  /** The MBTA route, e.g. "Green-C". */
  routeId: string
  /** Green Line branch letter, otherwise null. */
  branch: string | null
  lat: number
  lon: number
  /** Degrees clockwise from north, or null when unknown. */
  bearing: number | null
  status: VehicleStatus
  /** The stop the status refers to, or null when the feed doesn't say. */
  stopName: string | null
  /** Where the trip is headed, e.g. "Alewife". */
  headsign: string | null
  /** The MBTA trip this vehicle is running, used to fetch its upcoming stops. */
  tripId: string | null
  directionId: 0 | 1 | null
  /** When the vehicle last reported, in epoch milliseconds. */
  updatedAt: number
}
