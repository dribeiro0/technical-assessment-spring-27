import type { AlertsDocument } from '../api/mbtaTypes'
import { LINES, lineForRoute, type LineId } from './lines'

// A simple, explainable status based only on official MBTA alerts. It is not the
// experimental Chaos Score from 03_chaos_engine.txt.

export type StatusLevel = 'good' | 'minor' | 'major'

/** Effects that stop or replace service. */
const MAJOR_EFFECTS = new Set(['SUSPENSION', 'SHUTTLE', 'NO_SERVICE'])
/** Alerts below this severity (1-10) are notices, such as parking or stair repairs. */
export const MIN_RELEVANT_SEVERITY = 3

export interface LineAlert {
  id: string
  header: string
  effect: string
  severity: number
  level: Exclude<StatusLevel, 'good'>
  lines: LineId[]
  updatedAt: number | null
}

export interface LineStatus {
  line: LineId
  level: StatusLevel
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

/** Relevant alerts, most severe first. Notices below MIN_RELEVANT_SEVERITY are left out. */
export function relevantAlerts(doc: AlertsDocument): LineAlert[] {
  const alerts: LineAlert[] = []
  for (const raw of doc.data ?? []) {
    const a = raw.attributes ?? {}
    const severity = typeof a.severity === 'number' ? a.severity : 0
    if (severity < MIN_RELEVANT_SEVERITY) continue

    const lines = new Set<LineId>()
    for (const entity of a.informed_entity ?? []) {
      const line = lineForRoute(entity.route)
      if (line) lines.add(line)
    }
    if (lines.size === 0) continue

    const effect = a.effect ?? 'UNKNOWN_EFFECT'
    const updatedAt = a.updated_at ? Date.parse(a.updated_at) : NaN
    alerts.push({
      id: raw.id,
      header: a.header?.trim() || 'Service alert',
      effect,
      severity,
      level: MAJOR_EFFECTS.has(effect) ? 'major' : 'minor',
      lines: LINES.map((l) => l.id).filter((id) => lines.has(id)),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
    })
  }
  return alerts.sort((x, y) =>
    x.level === y.level ? y.severity - x.severity : x.level === 'major' ? -1 : 1,
  )
}

/** One status per line: the worst level among that line's relevant alerts. */
export function lineStatuses(alerts: readonly LineAlert[]): Record<LineId, LineStatus> {
  const result = {} as Record<LineId, LineStatus>
  for (const line of LINES) {
    const onLine = alerts.filter((a) => a.lines.includes(line.id))
    const level: StatusLevel = onLine.some((a) => a.level === 'major')
      ? 'major'
      : onLine.length > 0
        ? 'minor'
        : 'good'
    result[line.id] = { line: line.id, level, alerts: onLine }
  }
  return result
}
