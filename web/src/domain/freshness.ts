// Timing rules from DEC-024, based on live data checked on November 24, 2026:
// half of vehicle updates were under 19 s old and 90% under 55 s, but trains
// waiting at terminals sometimes went 7 minutes without reporting.

/** After this, a vehicle is drawn faded. */
export const VEHICLE_AGING_AFTER_MS = 2 * 60_000
/** After this, a vehicle is dropped as a probable phantom. */
export const VEHICLE_EXPIRED_AFTER_MS = 10 * 60_000
/** After this long without a successful fetch, the whole feed counts as stale. */
export const FEED_STALE_AFTER_MS = 45_000

export type VehicleFreshness = 'live' | 'aging' | 'expired'

/** Age in ms. Never negative, even if the device clock runs slightly behind the MBTA's. */
export function ageMs(updatedAt: number, now: number): number {
  return Math.max(0, now - updatedAt)
}

export function vehicleFreshness(updatedAt: number, now: number): VehicleFreshness {
  const age = ageMs(updatedAt, now)
  if (age > VEHICLE_EXPIRED_AFTER_MS) return 'expired'
  if (age > VEHICLE_AGING_AFTER_MS) return 'aging'
  return 'live'
}

export function isFeedStale(lastSuccessAt: number, now: number): boolean {
  return ageMs(lastSuccessAt, now) > FEED_STALE_AFTER_MS
}

/** Short age for tight spaces: "8s", "4m", "1h". */
export function formatAge(updatedAt: number, now: number): string {
  const seconds = Math.floor(ageMs(updatedAt, now) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
}

/** Readable age: "8 s ago", "4 min ago". */
export function formatAgeLong(updatedAt: number, now: number): string {
  const seconds = Math.floor(ageMs(updatedAt, now) / 1000)
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}
