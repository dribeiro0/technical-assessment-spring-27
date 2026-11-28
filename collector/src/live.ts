// Live gaps between trains (Sprint 7 step e, DEC-062), measured from the collector's own
// minute-by-minute positions and compared by the site with the LAMP baselines. Plain
// functions, no I/O.

import { MAX_HEADWAY_SECONDS, PLATFORM, type Line } from './baselines'

/** Gaps that ended within this window are "now". Long enough for ~3 trains per stop. */
export const LIVE_WINDOW_MS = 30 * 60_000
/** How far back to look for each stop's previous train, so a long gap is still seen whole. */
export const LIVE_LOOKBACK_MS = 2 * 3600_000

/** The first time a trip was seen heading to (or at) a stop. */
export interface FirstSeen {
  line: Line
  directionId: 0 | 1
  stopId: string
  tripId: string
  /** Source time, epoch ms. */
  at: number
}

export interface LiveGaps {
  line: Line
  directionId: 0 | 1
  /** Gaps (seconds) between consecutive trains at a stop that ended inside the window. */
  gaps: number[]
  /**
   * Per stop, seconds since its last train when no train has come since. The site counts
   * one only when it is already longer than usual, so a stop left waiting is not missed.
   */
  open: number[]
}

/** "Green-B" -> "Green"; other subway routes are their own line. */
export function lineOf(routeId: string): Line | null {
  if (routeId.startsWith('Green-')) return 'Green'
  return routeId === 'Red' || routeId === 'Orange' || routeId === 'Blue' ? routeId : null
}

/**
 * Gaps at each stop between consecutive trips, as LAMP measures its "trunk" headways: any
 * train of the line counts, so Green branches sharing a stop are one stream. A trip's time
 * at a stop is the first report naming it, which is when the train left the stop before;
 * both trains of a gap are timed the same way, so the gap itself is unaffected (to within
 * the one-minute collection interval). Terminal tracks and each trip's origin stop are
 * left out (see below): both produced 20-40 minute "gaps" no rider waits through.
 */
export function liveGaps(rows: Iterable<FirstSeen>, asOf: number): LiveGaps[] {
  const all = [...rows]
  // A trip's first stop is where it waits on layover before leaving; when it is first
  // reported there says nothing about when it left, so origin stops are not measured.
  const origin = new Map<string, number>()
  for (const r of all) origin.set(r.tripId, Math.min(origin.get(r.tripId) ?? Infinity, r.at))
  const stops = new Map<string, number[]>()
  for (const r of all) {
    // Terminal tracks ("Oak Grove-01") each see every other train: not a rider's gap.
    if (!PLATFORM.test(r.stopId) || r.at === origin.get(r.tripId)) continue
    const key = `${r.line}|${r.directionId}|${r.stopId}`
    const times = stops.get(key) ?? stops.set(key, []).get(key)!
    times.push(r.at)
  }
  const out = new Map<string, LiveGaps>()
  for (const [key, times] of stops) {
    const [line, dir] = key.split('|')
    const groupKey = `${line}|${dir}`
    const group =
      out.get(groupKey) ??
      out
        .set(groupKey, { line: line as Line, directionId: Number(dir) as 0 | 1, gaps: [], open: [] })
        .get(groupKey)!
    times.sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) {
      if (times[i] < asOf - LIVE_WINDOW_MS) continue
      const gap = Math.round((times[i] - times[i - 1]) / 1000)
      // Same limits as the baselines: no zero gaps, nothing longer than an overnight break.
      if (gap > 0 && gap <= MAX_HEADWAY_SECONDS) group.gaps.push(gap)
    }
    const open = Math.round((asOf - times[times.length - 1]) / 1000)
    if (open > 0 && open <= MAX_HEADWAY_SECONDS) group.open.push(open)
  }
  return [...out.values()].sort(
    (a, b) => a.line.localeCompare(b.line) || a.directionId - b.directionId,
  )
}
