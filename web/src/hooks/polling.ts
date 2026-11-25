import type { Query } from '@tanstack/react-query'
import { isRateLimit } from '../api/mbta'

// Shared refresh rules for every live MBTA query.
//
// Request budget (DEC-023), against the anonymous limit of 20 per minute:
//   vehicles every 15 s = 4/min, alerts every 60 s = 1/min,
//   the selected train's predictions every 15 s = 4/min (only while one is selected),
//   manual refresh at most once per 5 s (vehicles only).
// Polling stops while the tab is hidden (TanStack Query's default).
export const VEHICLE_POLL_MS = 15_000
export const ALERT_POLL_MS = 60_000
export const PREDICTION_POLL_MS = 15_000
export const MANUAL_REFRESH_GAP_MS = 5_000

/** The parts of a query's state the polling rule needs. */
type QueryTiming = Pick<Query['state'], 'error' | 'errorUpdatedAt' | 'dataUpdatedAt'>

/** Builds a refetchInterval that stops when paused and waits out a rate limit. */
export function pollEvery(intervalMs: number, paused: boolean) {
  return (query: { state: QueryTiming }) => {
    if (paused) return false
    const { error, errorUpdatedAt, dataUpdatedAt } = query.state
    const latestFailed = error && errorUpdatedAt >= dataUpdatedAt
    if (latestFailed && isRateLimit(error) && error.retryAt) {
      return Math.max(1000, error.retryAt - Date.now())
    }
    return intervalMs
  }
}

/** Retry network hiccups twice, but never hammer a rate limit. */
export function retryUnlessRateLimited(failureCount: number, error: unknown) {
  return !isRateLimit(error) && failureCount < 2
}
