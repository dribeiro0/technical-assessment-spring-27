import type { Baselines } from '../domain/baselines'

// EnRoute's own collector (Sprint 6, collector/), not the MBTA: it records observations
// every minute and reports how collection is going. A separate address, so reading it
// costs nothing from the MBTA request budget.

const HISTORY_URL: string =
  import.meta.env.VITE_HISTORY_URL || 'https://enroute-collector.enroute-collector.workers.dev'

export interface HistoryStatus {
  health: 'ok' | 'degraded' | 'down'
  /** When collection began (epoch ms), or null before the first successful run. */
  collectingSince: number | null
  lastSuccessAt: number | null
  lastRun: { at: number; ok: boolean; error: string | null } | null
  last24h: { runs: number; successful: number }
  /** Periods with no successful collection, newest first. */
  gaps: { start: number; end: number }[]
  rawObservations: number
}

export async function fetchHistoryStatus(signal?: AbortSignal): Promise<HistoryStatus> {
  const response = await fetch(`${HISTORY_URL}/status`, { signal })
  if (!response.ok) throw new Error(`History service returned HTTP ${response.status}`)
  const body = (await response.json()) as Partial<HistoryStatus>
  if (!body || !body.last24h || !Array.isArray(body.gaps))
    throw new Error('Unreadable history status')
  return body as HistoryStatus
}

/**
 * Baselines from public MBTA history (Sprint 7), with their source. Null when none have
 * been imported yet (the collector answers 404).
 */
export async function fetchBaselines(signal?: AbortSignal): Promise<Baselines | null> {
  const response = await fetch(`${HISTORY_URL}/baselines`, { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`History service returned HTTP ${response.status}`)
  const body = (await response.json()) as Partial<Baselines> | null
  if (!body?.source || !Array.isArray(body.trains) || !Array.isArray(body.headways)) {
    throw new Error('Unreadable baselines')
  }
  return body as Baselines
}
