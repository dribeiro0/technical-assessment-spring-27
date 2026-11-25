import { createContext, useContext } from 'react'
import type { LineAlert, LineStatus } from '../domain/lineStatus'
import type { LineId } from '../domain/lines'
import type { Vehicle } from '../domain/vehicle'

/**
 * The state of the live vehicle feed, from the rider's point of view.
 * - loading: first load, no data yet
 * - error: first load failed, nothing to show (error panel with Retry)
 * - live: data is fresh
 * - refresh-failed: the latest refresh failed; last good data still shown
 * - stale: no successful fetch for 45 s (DEC-024)
 * - rate-limited: HTTP 429; waiting a minute before asking again
 * - paused: the rider paused auto-refresh
 */
export type FeedStatus =
  'loading' | 'error' | 'live' | 'refresh-failed' | 'stale' | 'rate-limited' | 'paused'

export interface LiveData {
  /** Every shown vehicle (expired ones removed), on all lines. Filtering happens in views. */
  vehicles: Vehicle[]
  status: FeedStatus
  /** When the last successful vehicle fetch finished (epoch ms), or null before the first. */
  lastSuccessAt: number | null
  /** Human explanation of the latest failure, if any. */
  errorMessage: string | null
  /** For rate limiting: when requests resume (epoch ms). */
  retryAt: number | null
  isFetching: boolean
  /** Manual refresh. Ignored while throttled (once per 5 s) or rate limited. */
  refresh: () => void
  canRefresh: boolean
  paused: boolean
  setPaused: (paused: boolean) => void
  /** Relevant official alerts, most severe first. */
  alerts: LineAlert[]
  lineStatus: Record<LineId, LineStatus> | null
}

export const LiveDataContext = createContext<LiveData | null>(null)

export function useLiveData(): LiveData {
  const value = useContext(LiveDataContext)
  if (!value) throw new Error('useLiveData must be used inside <LiveDataProvider>')
  return value
}
