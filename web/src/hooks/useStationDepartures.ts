import { useQuery } from '@tanstack/react-query'
import { fetchStationPredictions } from '../api/mbta'
import { parseDepartures } from '../domain/departures'
import { useLiveData } from './liveData'
import { PREDICTION_POLL_MS, pollEvery, retryUnlessRateLimited } from './polling'

/**
 * Trains expected to leave the selected station, from MBTA predictions.
 * Only runs while a station is selected, refreshes every 15 s, and follows the same
 * pause and rate-limit rules as the live feed. A train and a station are never selected
 * at once, so this and the train's predictions never poll together.
 */
export function useStationDepartures(stationId: string | null) {
  const { paused } = useLiveData()
  return useQuery({
    queryKey: ['station', stationId],
    queryFn: async ({ signal }) =>
      parseDepartures(await fetchStationPredictions(stationId as string, signal)),
    enabled: stationId !== null,
    refetchInterval: pollEvery(PREDICTION_POLL_MS, paused),
    retry: retryUnlessRateLimited,
    staleTime: 10_000,
  })
}
