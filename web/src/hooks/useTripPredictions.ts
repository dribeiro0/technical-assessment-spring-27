import { useQuery } from '@tanstack/react-query'
import { fetchTripPredictions } from '../api/mbta'
import { upcomingStops } from '../domain/predictions'
import { useLiveData } from './liveData'
import { PREDICTION_POLL_MS, pollEvery, retryUnlessRateLimited } from './polling'

/**
 * Upcoming stops and arrival estimates for the selected train's trip.
 * Only runs while a train is selected, refreshes every 15 s, and follows the
 * same pause and rate-limit rules as the live feed. An empty list means the
 * MBTA has no estimates for this trip; the card then falls back to the stop text.
 */
export function useTripPredictions(tripId: string | null) {
  const { paused } = useLiveData()
  return useQuery({
    queryKey: ['predictions', tripId],
    queryFn: async ({ signal }) =>
      upcomingStops(await fetchTripPredictions(tripId as string, signal)),
    enabled: tripId !== null,
    refetchInterval: pollEvery(PREDICTION_POLL_MS, paused),
    retry: retryUnlessRateLimited,
    staleTime: 10_000,
  })
}
