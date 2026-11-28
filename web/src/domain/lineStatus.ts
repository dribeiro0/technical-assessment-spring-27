import type { AlertsDocument } from '../api/mbtaTypes'
import { LINES, lineForRoute, type LineId } from './lines'

// A simple, explainable status based only on official MBTA alerts. It is not the
// experimental Chaos Score from 03_chaos_engine.txt.

export type StatusLevel = 'good' | 'minor' | 'major'

/** Effects that stop or replace service. */
const MAJOR_EFFECTS = new Set(['SUSPENSION', 'SHUTTLE', 'NO_SERVICE'])
/** Alerts below this severity (1-10) are notices, such as parking or stair repairs. */
export const MIN_RELEVANT_SEVERITY = 3

/** What one alert says about one place: a route, optionally a station and direction. */
export interface AlertEntity {
  routeId: string
  /** Parent station ("place-hwsst"), or null when the whole route is affected. */
  stationId: string | null
  /** Null when both directions are affected. */
  directionId: 0 | 1 | null
  /** True when trains themselves are not running (RIDE); false when only stations are affected. */
  ride: boolean
}

export interface LineAlert {
  id: string
  header: string
  /** The MBTA's longer explanation, when there is one. */
  description: string | null
  effect: string
  severity: number
  level: Exclude<StatusLevel, 'good'>
  lines: LineId[]
  /** "active": in effect now; "upcoming": announced ahead, such as a weekend shutdown. */
  timing: 'active' | 'upcoming'
  /** The current period (active) or the next one (upcoming), in epoch ms. */
  start: number | null
  /** Null when the MBTA has not given an end. */
  end: number | null
  entities: AlertEntity[]
  updatedAt: number | null
}

export interface LineStatus {
  line: LineId
  level: StatusLevel
  /** Active alerts only: an upcoming shutdown does not change today's status. */
  alerts: LineAlert[]
}

export const STATUS_TEXT: Record<StatusLevel, string> = {
  good: 'Good service',
  minor: 'Minor issues',
  major: 'Major disruption',
}

/** "STATION_CLOSURE" -> "Station closure". */
export function effectText(effect: string): string {
  const words = effect.toLowerCase().split('_').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function time(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

/**
 * When an alert applies, judged against `now`: the period in effect now, else the next one
 * to come. Null when every period has ended. An alert without periods counts as active.
 */
function timingOf(
  periods: { start: number | null; end: number | null }[],
  now: number,
): Pick<LineAlert, 'timing' | 'start' | 'end'> | null {
  if (periods.length === 0) return { timing: 'active', start: null, end: null }
  const current = periods.find((p) => (p.start ?? -Infinity) <= now && (p.end ?? Infinity) > now)
  if (current) return { timing: 'active', ...current }
  const next = periods
    .filter((p) => p.start !== null && p.start > now)
    .sort((a, b) => a.start! - b.start!)[0]
  return next ? { timing: 'upcoming', ...next } : null
}

/**
 * Relevant alerts: severity 3 or more, on an in-scope line, not yet over. Ordered by
 * passenger impact (planning file 05 section 3), not by date: alerts in effect now before
 * upcoming ones, major disruptions before minor issues, then by severity, then by start.
 */
export function relevantAlerts(doc: AlertsDocument, now: number): LineAlert[] {
  const alerts: LineAlert[] = []
  for (const raw of doc.data ?? []) {
    const a = raw.attributes ?? {}
    const severity = typeof a.severity === 'number' ? a.severity : 0
    if (severity < MIN_RELEVANT_SEVERITY) continue

    const lines = new Set<LineId>()
    const entities: AlertEntity[] = []
    const seen = new Set<string>()
    for (const e of a.informed_entity ?? []) {
      const line = lineForRoute(e.route)
      if (!line || !e.route) continue
      lines.add(line)
      // Alerts name both platforms ("70214") and their station ("place-hwsst"); the map
      // works in stations, so platforms are skipped. An entity with no stop at all
      // means the whole route.
      if (e.stop && !e.stop.startsWith('place-')) continue
      const entity: AlertEntity = {
        routeId: e.route,
        stationId: e.stop ?? null,
        directionId: e.direction_id === 0 || e.direction_id === 1 ? e.direction_id : null,
        ride: (e.activities ?? []).includes('RIDE'),
      }
      const key = `${entity.routeId}|${entity.stationId}|${entity.directionId}|${entity.ride}`
      if (seen.has(key)) continue
      seen.add(key)
      entities.push(entity)
    }
    if (lines.size === 0) continue

    const periods = (a.active_period ?? []).map((p) => ({ start: time(p.start), end: time(p.end) }))
    const timing = timingOf(periods, now)
    if (!timing) continue // over

    const effect = a.effect ?? 'UNKNOWN_EFFECT'
    alerts.push({
      id: raw.id,
      header: a.header?.trim() || 'Service alert',
      description: a.description?.trim() || null,
      effect,
      severity,
      level: MAJOR_EFFECTS.has(effect) ? 'major' : 'minor',
      lines: LINES.map((l) => l.id).filter((id) => lines.has(id)),
      ...timing,
      entities,
      updatedAt: time(a.updated_at),
    })
  }
  const rank = (x: LineAlert) => (x.timing === 'active' ? 0 : 2) + (x.level === 'major' ? 0 : 1)
  return alerts.sort(
    (x, y) => rank(x) - rank(y) || y.severity - x.severity || (x.start ?? 0) - (y.start ?? 0),
  )
}

/** One status per line: the worst level among the line's alerts in effect now. */
export function lineStatuses(alerts: readonly LineAlert[]): Record<LineId, LineStatus> {
  const result = {} as Record<LineId, LineStatus>
  for (const line of LINES) {
    const onLine = alerts.filter((a) => a.timing === 'active' && a.lines.includes(line.id))
    const level: StatusLevel = onLine.some((a) => a.level === 'major')
      ? 'major'
      : onLine.length > 0
        ? 'minor'
        : 'good'
    result[line.id] = { line: line.id, level, alerts: onLine }
  }
  return result
}
