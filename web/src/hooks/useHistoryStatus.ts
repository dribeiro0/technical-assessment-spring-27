import { useQuery } from '@tanstack/react-query'
import { fetchBaselines, fetchHistoryStatus, fetchLiveHeadways } from '../api/history'

/** Collection status changes slowly; every 5 minutes is plenty. */
const HISTORY_POLL_MS = 5 * 60_000

/**
 * How EnRoute's history collection is going (Sprint 6, H6). Only read where it is shown
 * (Analytics). If the collector is unreachable the rest of the site carries on (H9).
 */
export function useHistoryStatus() {
  return useQuery({
    queryKey: ['history-status'],
    queryFn: ({ signal }) => fetchHistoryStatus(signal),
    refetchInterval: HISTORY_POLL_MS,
    staleTime: 60_000,
    retry: 1,
  })
}

/**
 * Baselines from public MBTA history (Sprint 7). They change only when re-imported, so
 * they are fetched once a visit and kept. Analytics and the commute's chaos score read
 * them; the MBTA is never asked (B7).
 */
export function useBaselines() {
  return useQuery({
    queryKey: ['baselines'],
    queryFn: ({ signal }) => fetchBaselines(signal),
    staleTime: Infinity,
    retry: 1,
  })
}

/**
 * Live gaps between trains for the chaos scores (step e). The collector adds a minute of
 * data each minute, so asking more often would only return the same figures.
 */
export function useLiveHeadways() {
  return useQuery({
    queryKey: ['live-headways'],
    queryFn: ({ signal }) => fetchLiveHeadways(signal),
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: 1,
  })
}
