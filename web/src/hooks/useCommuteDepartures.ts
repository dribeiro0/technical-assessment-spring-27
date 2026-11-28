import { useQuery } from '@tanstack/react-query'
import { describeError, fetchCommutePredictions, fetchCommuteSchedules } from '../api/mbta'
import {
  chooseDepartures,
  reachesDestination,
  parseScheduledDepartures,
  serviceDayQuery,
  type Commute,
  type CommuteDeparture,
} from '../domain/commute'
import { parseDepartures, type Departure } from '../domain/departures'
import { FEED_STALE_AFTER_MS } from '../domain/freshness'
import { useLiveData } from './liveData'
import { PREDICTION_POLL_MS, pollEvery, retryUnlessRateLimited } from './polling'

/** The timetable barely changes, so it is asked at most every 5 minutes. */
const TIMETABLE_POLL_MS = 5 * 60_000

/**
 * - loading: nothing yet
 * - ok: departures to show
 * - none: loaded fine, but no train is coming in this direction
 * - error: nothing could be loaded (live and timetable both failed)
 */
export type CommuteStatus = 'loading' | 'ok' | 'none' | 'error'

export interface CommuteDepartures {
  status: CommuteStatus
  departures: CommuteDeparture[]
  /** When the shown departures were fetched (epoch ms). */
  updatedAt: number | null
  /** True when the live times are older than 45 s (same rule as the map, DEC-024). */
  stale: boolean
  /** The latest failure, even while older data is still shown. */
  errorMessage: string | null
}

/**
 * Departures for one commute. Live predictions every 15 s, with the same pause and
 * rate-limit rules as the rest of the app. The timetable is asked only when there is no
 * live train to show, so a normal day costs 4 requests a minute and nothing more (C7).
 * Only the commute on screen calls this, so other saved commutes cost nothing.
 */
export function useCommuteDepartures(commute: Commute | null, now: number): CommuteDepartures {
  const { paused } = useLiveData()
  const key = commute ? [commute.stationId, commute.routeId, commute.directionId] : []

  const live = useQuery({
    queryKey: ['commute-live', ...key],
    queryFn: async ({ signal }) =>
      parseDepartures(
        await fetchCommutePredictions(
          commute!.stationId,
          commute!.routeId,
          commute!.directionId,
          signal,
        ),
      ),
    enabled: commute !== null,
    refetchInterval: pollEvery(PREDICTION_POLL_MS, paused),
    retry: retryUnlessRateLimited,
    staleTime: 10_000,
  })

  // Only trains that reach the destination (where the Red Line splits, its branch).
  const reaching = (list: Departure[] | undefined) =>
    commute ? (list ?? []).filter((d) => reachesDestination(d.headsign, commute)) : []
  const liveReaching = reaching(live.data)
  const liveAhead = chooseDepartures(liveReaching, [], now)
  const needTimetable =
    commute !== null &&
    ((live.data === undefined && live.isError) ||
      (live.data !== undefined && liveAhead.length === 0))

  const timetable = useQuery({
    queryKey: ['commute-timetable', ...key],
    queryFn: async ({ signal }) => {
      const { date, minTime } = serviceDayQuery(Date.now())
      return parseScheduledDepartures(
        await fetchCommuteSchedules(
          commute!.stationId,
          commute!.routeId,
          commute!.directionId,
          date,
          minTime,
          signal,
        ),
      )
    },
    enabled: needTimetable,
    refetchInterval: pollEvery(TIMETABLE_POLL_MS, paused),
    retry: retryUnlessRateLimited,
    staleTime: TIMETABLE_POLL_MS,
  })

  const departures = chooseDepartures(
    liveReaching,
    needTimetable ? reaching(timetable.data) : [],
    now,
  )
  const fromLive = departures[0]?.source !== 'scheduled'
  const updatedAt = fromLive ? live.dataUpdatedAt || null : timetable.dataUpdatedAt || null

  const liveFailedLast = live.isError && live.errorUpdatedAt >= live.dataUpdatedAt
  const errorMessage = liveFailedLast
    ? describeError(live.error)
    : timetable.isError
      ? describeError(timetable.error)
      : null

  let status: CommuteStatus
  if (departures.length > 0) status = 'ok'
  else if (live.isPending && live.fetchStatus !== 'idle') status = 'loading'
  else if (needTimetable && timetable.isPending && timetable.fetchStatus !== 'idle')
    status = 'loading'
  else if (live.data === undefined && live.isError && (timetable.isError || !needTimetable)) {
    status = 'error'
  } else if (needTimetable && timetable.isError) status = 'error'
  else status = 'none'

  const stale = fromLive && live.dataUpdatedAt > 0 && now - live.dataUpdatedAt > FEED_STALE_AFTER_MS

  return { status, departures, updatedAt, stale, errorMessage }
}
