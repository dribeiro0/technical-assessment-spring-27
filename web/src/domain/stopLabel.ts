import type { Vehicle, VehicleStatus } from './vehicle'

// Accepted wording (00_master_plan.txt section 5, DEC-019). The feed tells us the
// stop a vehicle is at or heading to; we never guess one it doesn't give.
export const NEXT_STOP_UNAVAILABLE = 'Next stop unavailable'

/** "At JFK/UMass", "Approaching Park Street" or "Next stop unavailable". */
export function stopLabel(vehicle: Pick<Vehicle, 'status' | 'stopName'>): string {
  if (!vehicle.stopName) return NEXT_STOP_UNAVAILABLE
  switch (vehicle.status) {
    case 'stopped':
      return `At ${vehicle.stopName}`
    case 'incoming':
    case 'in-transit':
      return `Approaching ${vehicle.stopName}`
    default:
      return NEXT_STOP_UNAVAILABLE
  }
}

const STATUS_TEXT: Record<VehicleStatus, string> = {
  stopped: 'Stopped at station',
  incoming: 'Arriving',
  'in-transit': 'In transit',
  unknown: 'Status unknown',
}

export function statusText(status: VehicleStatus): string {
  return STATUS_TEXT[status]
}

/**
 * How riders identify a train: by where it's going, not by its car number.
 * "Alewife", or "C · Cleveland Circle" on the Green Line where the branch matters.
 */
export function destinationLabel(vehicle: Pick<Vehicle, 'headsign' | 'branch'>): string {
  const branch = vehicle.branch ? `${vehicle.branch} · ` : ''
  if (vehicle.headsign) return `${branch}${vehicle.headsign}`
  return vehicle.branch ? `${vehicle.branch} branch` : 'Destination unknown'
}

/** "toward Alewife", or a clear fallback when the trip has no headsign. */
export function directionText(headsign: string | null): string {
  return headsign ? `toward ${headsign}` : 'Direction unavailable'
}
