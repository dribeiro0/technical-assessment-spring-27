import { useQuery, type Query } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { describeError, fetchAlerts, fetchVehicles, isRateLimit, MbtaError } from '../api/mbta'
import { isFeedStale, vehicleFreshness } from '../domain/freshness'
import { lineStatuses, relevantAlerts } from '../domain/lineStatus'
import { normalizeVehicles } from '../domain/normalize'
import { LiveDataContext, type FeedStatus, type LiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'

// Request budget (DEC-023), against the anonymous limit of 20 per minute:
//   vehicles every 15 s = 4/min, alerts every 60 s = 1/min,
//   manual refresh at most once per 5 s (vehicles only).
// Polling stops while the tab is hidden (TanStack Query's default).
export const VEHICLE_POLL_MS = 15_000
export const ALERT_POLL_MS = 60_000
export const MANUAL_REFRESH_GAP_MS = 5_000

/** The parts of a query's state the polling rule needs. */
type QueryTiming = Pick<Query['state'], 'error' | 'errorUpdatedAt' | 'dataUpdatedAt'>

/** Builds a refetchInterval that stops when paused and waits out a rate limit. */
function pollEvery(intervalMs: number, paused: boolean) {
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
function retryUnlessRateLimited(failureCount: number, error: unknown) {
  return !isRateLimit(error) && failureCount < 2
}

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false)
  // Freshness only needs re-checking every few seconds; labels that tick each
  // second use their own useNow(1000).
  const now = useNow(5000)

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: async ({ signal }) => normalizeVehicles(await fetchVehicles(signal)),
    refetchInterval: pollEvery(VEHICLE_POLL_MS, paused),
    retry: retryUnlessRateLimited,
  })

  const alertsQuery = useQuery({
    queryKey: ['alerts'],
    queryFn: async ({ signal }) => relevantAlerts(await fetchAlerts(signal)),
    refetchInterval: pollEvery(ALERT_POLL_MS, paused),
    retry: retryUnlessRateLimited,
  })

  // Manual refresh throttle.
  const lastManualRef = useRef(0)
  const [throttled, setThrottled] = useState(false)
  useEffect(() => {
    if (!throttled) return
    const id = window.setTimeout(() => setThrottled(false), MANUAL_REFRESH_GAP_MS)
    return () => window.clearTimeout(id)
  }, [throttled])

  const { error, errorUpdatedAt, dataUpdatedAt, data, isFetching } = vehiclesQuery
  const latestFailed = Boolean(error) && errorUpdatedAt >= dataUpdatedAt
  const rateLimited = latestFailed && isRateLimit(error)
  const retryAt = rateLimited && error instanceof MbtaError ? error.retryAt : null
  const stillWaiting = rateLimited && retryAt !== null && retryAt > now

  const refetchVehicles = vehiclesQuery.refetch
  const refresh = useCallback(() => {
    const t = Date.now()
    if (t - lastManualRef.current < MANUAL_REFRESH_GAP_MS || stillWaiting) return
    lastManualRef.current = t
    setThrottled(true)
    void refetchVehicles()
  }, [refetchVehicles, stillWaiting])

  const value = useMemo<LiveData>(() => {
    const lastSuccessAt = data ? dataUpdatedAt : null
    let status: FeedStatus
    if (!data) status = error && !isFetching ? 'error' : 'loading'
    else if (paused) status = 'paused'
    else if (stillWaiting) status = 'rate-limited'
    else if (lastSuccessAt !== null && isFeedStale(lastSuccessAt, now)) status = 'stale'
    else if (latestFailed) status = 'refresh-failed'
    else status = 'live'

    const vehicles = (data ?? []).filter((v) => vehicleFreshness(v.updatedAt, now) !== 'expired')
    const alerts = alertsQuery.data ?? []

    return {
      vehicles,
      status,
      lastSuccessAt,
      errorMessage: latestFailed ? describeError(error) : null,
      retryAt: stillWaiting ? retryAt : null,
      isFetching,
      refresh,
      canRefresh: !throttled && !stillWaiting && !isFetching,
      paused,
      setPaused,
      alerts,
      lineStatus: alertsQuery.data ? lineStatuses(alerts) : null,
    }
  }, [
    data,
    dataUpdatedAt,
    error,
    isFetching,
    paused,
    stillWaiting,
    latestFailed,
    retryAt,
    now,
    refresh,
    throttled,
    alertsQuery.data,
  ])

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>
}
