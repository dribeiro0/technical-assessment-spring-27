import { useMemo } from 'react'
import { networkScore, routeScore, type ChaosScore, type RouteInputs } from '../domain/chaos'
import { commuteToward, type Commute } from '../domain/commute'
import { commuteFocus } from '../domain/commuteRoute'
import { countByLine } from '../domain/counts'
import { LINES, lineForRoute } from '../domain/lines'
import { useLiveData } from './liveData'
import { useBaselines, useLiveHeadways } from './useHistoryStatus'
import { useNetwork } from './useNetwork'
import { useNow } from './useNow'

/**
 * Everything a chaos score needs that is not about one line: alerts, the live train count,
 * the LAMP baselines and the collector's live gaps. Recomputed every 15 s; the inputs
 * themselves change at most once a minute (gaps) or every few seconds (trains).
 */
function useShared() {
  const { vehicles, status, lastSuccessAt, alerts, alertsState } = useLiveData()
  const baselines = useBaselines()
  const live = useLiveHeadways()
  const now = useNow(15_000)
  const current = status === 'live' || status === 'refresh-failed'
  const counts = countByLine(vehicles)
  const loading = alertsState === 'loading' || baselines.isPending || live.isPending
  const base = (line: (typeof LINES)[number]['id']): RouteInputs => ({
    line,
    directionId: null,
    now,
    alerts,
    alertsAvailable: alertsState === 'ok',
    liveTrains: current ? (counts.find((c) => c.line === line)?.count ?? 0) : null,
    vehiclesAt: current ? lastSuccessAt : null,
    baselines: baselines.data ?? null,
    live: live.data ?? null,
  })
  return { base, now, loading, baselines: baselines.data ?? null }
}

/** Line and network scores for Analytics (step e, DEC-062). Null while inputs load. */
export function useChaosScores(): { routes: ChaosScore[]; network: ChaosScore } | null {
  const { base, now, loading, baselines } = useShared()
  if (loading) return null
  const routes = LINES.map((l) => routeScore(base(l.id), l.name))
  return { routes, network: networkScore(routes, baselines, now) }
}

/**
 * One commute's score: its own line and direction, with alerts judged against its stretch
 * of line (DEC-055). Null while inputs load or for a route outside the subway lines.
 */
export function useCommuteChaos(commute: Commute): ChaosScore | null {
  const { base, loading } = useShared()
  const { data: network } = useNetwork()
  const stretch = useMemo(
    () => (network ? (commuteFocus(network, commute)?.stationIds ?? null) : null),
    [network, commute],
  )
  const line = lineForRoute(commute.routeId)
  if (loading || !line) return null
  return routeScore(
    { ...base(line), directionId: commute.directionId, commute: { commute, stretch } },
    `${commute.name}, toward ${commuteToward(commute)}`,
  )
}
