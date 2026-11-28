import { useQuery } from '@tanstack/react-query'
import { fetchBaselines, fetchHistoryStatus } from '../api/history'

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
 * they are fetched once a visit and kept; only Analytics asks for them (B7).
 */
export function useBaselines() {
  return useQuery({
    queryKey: ['baselines'],
    queryFn: ({ signal }) => fetchBaselines(signal),
    staleTime: Infinity,
    retry: 1,
  })
}
