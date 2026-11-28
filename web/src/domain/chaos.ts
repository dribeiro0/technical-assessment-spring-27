import type { Commute } from './commute'
import { alertRelevance } from './alertRelevance'
import {
  MIN_RELIABILITY_SAMPLES,
  MIN_TRAINS_TO_COMPARE,
  serviceSlot,
  usualTrains,
  type Baselines,
  type HeadwayBaselineRow,
} from './baselines'
import type { LineAlert } from './lineStatus'
import { LINES, lineForRoute, type LineId } from './lines'

// The experimental Chaos Score (planning file 03, Sprint 7 step e, DEC-062): candidate C,
// built on the LAMP baselines. Every number here is a proposal, not a calibrated value; the
// score stays labelled experimental until 03 section 8 steps 4-6 are done.

export const MODEL_VERSION = 'C-0.1'

/** Candidate C weights (03 section 2). Never redistributed silently (03 section 6). */
export const WEIGHTS = {
  wait: 0.3,
  disruptions: 0.25,
  travel: 0.2,
  unpredictability: 0.15,
  availability: 0.1,
} as const
export type FactorKey = keyof typeof WEIGHTS

/** Below this share of the model measured, there is too little evidence: UNKNOWN. */
export const MIN_MEASURED_WEIGHT = 0.5
/** Gaps per direction needed to judge waiting; fewer is "partial", under the floor none. */
export const FULL_LIVE_GAPS = 12
export const MIN_LIVE_GAPS = 5
/** Live gaps older than this mean the collector has stopped: never read as good service. */
export const MAX_LIVE_AGE_MS = 5 * 60_000
/**
 * Gaps are capped at this many times the usual 90th-percentile gap before working out the
 * wait, as the baselines are (collector WAIT_GAP_CAP): one stray gap must not swing a
 * whole line (03 section 5, gradual recovery). [PROPOSED]
 */
export const WAIT_GAP_CAP = 3
/** An active suspension or shuttle keeps its route at "High" or worse (03 section 5). */
export const SUSPENSION_FLOOR = 60

export type FactorStatus = 'available' | 'partial' | 'unavailable'
export type Band = 'smooth' | 'minor' | 'moderate' | 'high' | 'critical'
export type Confidence = 'medium' | 'low'

export const BAND_TEXT: Record<Band, string> = {
  smooth: 'Smooth',
  minor: 'Minor chaos',
  moderate: 'Moderate chaos',
  high: 'High chaos',
  critical: 'Critical chaos',
}

/** 03 section 7: 0-19, 20-39, 40-59, 60-79, 80-100. */
export function bandOf(score: number): Band {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'moderate'
  if (score >= 20) return 'minor'
  return 'smooth'
}

export interface Factor {
  key: string
  label: string
  /** Share of the model, 0-1. */
  weight: number
  status: FactorStatus
  /** 0-100, higher is worse; null when unavailable. */
  value: number | null
  /** What was measured, in words. */
  detail: string
}

export interface ChaosScore {
  scope: 'network' | 'route' | 'commute'
  /** "Red Line", "Red Line toward Alewife", "Whole subway". */
  label: string
  /** 0-100, or null for UNKNOWN. */
  value: number | null
  band: Band | null
  /** True whenever part of the model could not be measured. */
  provisional: boolean
  confidence: Confidence | null
  confidenceReason: string
  /** Share of the model that was measured, 0-1. */
  measuredWeight: number
  factors: Factor[]
  /** Why the score was raised to a minimum, if it was. */
  floor: string | null
  limitations: string[]
  /** Newest observation behind the score (epoch ms), and when it was computed. */
  observedAt: number | null
  computedAt: number
  modelVersion: string
}

/** One line and direction as the collector reports it (/live-headways). */
export interface LiveLineGaps {
  line: string
  directionId: 0 | 1
  gaps: number[]
  open: number[]
}

export interface LiveHeadways {
  /** The collector's last successful run: gaps are measured up to here (epoch ms). */
  asOf: number
  windowMinutes: number
  lines: LiveLineGaps[]
}

export interface RouteInputs {
  line: LineId
  /** One direction (a commute), or null for both. */
  directionId: 0 | 1 | null
  now: number
  alerts: readonly LineAlert[]
  /** False when the alerts feed failed: the score is then UNKNOWN, never "Smooth". */
  alertsAvailable: boolean
  /** Trains running on the line now, or null when the vehicle feed is not current. */
  liveTrains: number | null
  /** When the vehicle count was fetched. */
  vehiclesAt: number | null
  baselines: Baselines | null
  live: LiveHeadways | null
  /** For a commute: which alerts touch its stretch, in its direction (DEC-055). */
  commute?: { commute: Commute; stretch: ReadonlySet<string> | null }
}

const clamp = (x: number) => Math.max(0, Math.min(100, x))
const minutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`

/** The value at a fraction through a sorted list, as the baselines compute it. */
function quantile(sorted: readonly number[], q: number): number {
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** E[H²] / (2 E[H]): the expected wait of a rider arriving at random (03 section 10). */
export function expectedWait(gaps: readonly number[]): number {
  let sum = 0
  let squares = 0
  for (const g of gaps) {
    sum += g
    squares += g * g
  }
  return squares / (2 * sum)
}

interface DirectionMeasure {
  directionId: 0 | 1
  gaps: number
  /** Live and usual expected wait, seconds. */
  wait: number
  usualWait: number
  p90: number
  usualP90: number
  /** Stops already waiting longer than the usual 90th-percentile gap. */
  longOpen: number
}

/**
 * Live gaps for one line and direction against the baseline for this hour and day type.
 * A stop that has waited longer than the usual 90th-percentile gap counts as a gap of that
 * length so far: a train that has not come yet is the worst gap of all, not a missing one.
 */
function measureDirection(
  live: LiveLineGaps | undefined,
  base: HeadwayBaselineRow | undefined,
): DirectionMeasure | null {
  if (!live || !base || base.samples < MIN_RELIABILITY_SAMPLES || !base.wait_seconds) return null
  const longOpen = live.open.filter((s) => s > base.p90_seconds)
  const gaps = [...live.gaps, ...longOpen].sort((a, b) => a - b)
  if (gaps.length < MIN_LIVE_GAPS) return null
  const cap = WAIT_GAP_CAP * base.p90_seconds
  return {
    directionId: live.directionId,
    gaps: gaps.length,
    wait: expectedWait(gaps.map((g) => Math.min(g, cap))),
    usualWait: base.wait_seconds,
    p90: quantile(gaps, 0.9),
    usualP90: base.p90_seconds,
    longOpen: longOpen.length,
  }
}

function headwayFactors(i: RouteInputs): {
  wait: Factor
  unpredictability: Factor
  at: number | null
} {
  const wait: Factor = {
    key: 'wait',
    label: 'Excess waiting',
    weight: WEIGHTS.wait,
    status: 'unavailable',
    value: null,
    detail: '',
  }
  const unpredictability: Factor = {
    key: 'unpredictability',
    label: 'Unpredictability',
    weight: WEIGHTS.unpredictability,
    status: 'unavailable',
    value: null,
    detail: '',
  }
  const none = (why: string) => {
    wait.detail = why
    unpredictability.detail = why
    return { wait, unpredictability, at: null }
  }
  if (!i.baselines) return none('No baselines to compare with.')
  if (!i.live) return none('Live gaps between trains are unavailable.')
  const age = i.now - i.live.asOf
  if (age > MAX_LIVE_AGE_MS) {
    return none(`The collector has not reported for ${Math.round(age / 60_000)} min.`)
  }

  const { dayType, hour } = serviceSlot(i.now)
  const directions: (0 | 1)[] = i.directionId === null ? [0, 1] : [i.directionId]
  const measured = directions
    .map((d) =>
      measureDirection(
        i.live!.lines.find((l) => l.line === i.line && l.directionId === d),
        i.baselines!.headways.find(
          (h) =>
            h.line === i.line && h.direction_id === d && h.day_type === dayType && h.hour === hour,
        ),
      ),
    )
    .filter((m): m is DirectionMeasure => m !== null)
  if (measured.length === 0) {
    return none('Too few trains in the last 30 minutes, or too little history for this hour.')
  }

  // Both directions count equally: a rider in either one waits.
  const avg = (f: (m: DirectionMeasure) => number) =>
    measured.reduce((s, m) => s + f(m), 0) / measured.length
  const waitRatio = avg((m) => m.wait / m.usualWait)
  const p90Ratio = avg((m) => m.p90 / m.usualP90)
  const thin = measured.some((m) => m.gaps < FULL_LIVE_GAPS)
  const status: FactorStatus = measured.length < directions.length || thin ? 'partial' : 'available'
  const gapCount = measured.reduce((s, m) => s + m.gaps, 0)
  const longOpen = measured.reduce((s, m) => s + m.longOpen, 0)
  const pending = longOpen
    ? `, including ${longOpen} stop${longOpen > 1 ? 's' : ''} still waiting`
    : ''

  // Proposed scale [UNVALIDATED]: usual = 0, twice the usual = 100.
  wait.status = status
  wait.value = clamp((waitRatio - 1) * 100)
  wait.detail = `Expected wait ${minutes(avg((m) => m.wait))} against a usual ${minutes(avg((m) => m.usualWait))} (${gapCount} gaps in the last 30 min${pending}).`
  unpredictability.status = status
  unpredictability.value = clamp((p90Ratio - 1) * 100)
  unpredictability.detail = `1 gap in 10 is longer than ${minutes(avg((m) => m.p90))}; usually ${minutes(avg((m) => m.usualP90))}.`
  return { wait, unpredictability, at: i.live.asOf }
}

function availabilityFactor(i: RouteInputs): Factor {
  const f: Factor = {
    key: 'availability',
    label: 'Service availability',
    weight: WEIGHTS.availability,
    status: 'unavailable',
    value: null,
    detail: '',
  }
  if (i.liveTrains === null) {
    f.detail = 'The live train count is not current.'
    return f
  }
  const usual = i.baselines ? usualTrains(i.baselines, i.line, i.now) : null
  if (!usual || usual.typical < MIN_TRAINS_TO_COMPARE) {
    f.detail = 'Too little history, or too few trains usually run at this hour, to compare.'
    return f
  }
  const shortfall = 1 - i.liveTrains / usual.typical
  // Proposed scale [UNVALIDATED]: as many as usual = 0, half as many = 100.
  f.status = 'available'
  f.value = clamp((shortfall / 0.5) * 100)
  f.detail = `${i.liveTrains} trains running; usually ${usual.typical} at this hour${i.directionId === null ? '' : ' (whole line, both directions)'}.`
  return f
}

/** How much one alert disrupts service, 0-100 [PROPOSED]. */
function alertImpact(a: LineAlert, line: LineId): number {
  if (a.level === 'major') {
    const wholeRoute = a.entities.some(
      (e) => lineForRoute(e.routeId) === line && e.stationId === null && e.ride,
    )
    return wholeRoute ? 100 : 80
  }
  // Minor issues (DEC-035) rise with the MBTA's severity (3-10) but never reach a suspension.
  return Math.min(60, a.severity * 8)
}

/**
 * Coverage as an exposure modifier (03 section 2): a closure of stations that trains still
 * run through touches only the riders of those stations, so on a whole line it counts a
 * quarter. For a commute that boards or alights there it counts in full. [PROPOSED]
 */
export const STATION_ONLY_SHARE = 0.25
function stationOnly(a: LineAlert, line: LineId): boolean {
  const onLine = a.entities.filter((e) => lineForRoute(e.routeId) === line)
  return onLine.length > 0 && onLine.every((e) => e.stationId !== null && !e.ride)
}

function disruptionFactor(i: RouteInputs): { factor: Factor; floor: string | null } {
  const factor: Factor = {
    key: 'disruptions',
    label: 'Service disruptions',
    weight: WEIGHTS.disruptions,
    status: 'unavailable',
    value: null,
    detail: 'Official alerts could not be loaded.',
  }
  if (!i.alertsAvailable) return { factor, floor: null }

  const active = i.alerts.filter((a) => a.timing === 'active' && a.lines.includes(i.line))
  let worst = 0
  let worstAlert: LineAlert | null = null
  let floor: string | null = null
  let unknown = false
  for (const a of active) {
    let impact = alertImpact(a, i.line)
    let direct = true
    if (!i.commute && stationOnly(a, i.line)) impact *= STATION_ONLY_SHARE
    if (i.commute) {
      const relevance = alertRelevance(a, i.commute.commute, i.commute.stretch)
      if (relevance === 'none') continue
      // Elsewhere on the route: knock-on delays at most (03 section 5, geographic awareness).
      if (relevance === 'indirect') {
        impact *= 0.25
        direct = false
      }
      if (relevance === 'unknown') unknown = true
    }
    if (direct && a.level === 'major' && !floor) {
      floor = `An active ${a.effect.toLowerCase().replaceAll('_', ' ')} keeps this at “${BAND_TEXT.high}” or worse.`
    }
    // The worst alert counts, not the sum: several alerts for one incident do not add up.
    if (impact > worst) {
      worst = impact
      worstAlert = a
    }
  }
  factor.status = unknown ? 'partial' : 'available'
  factor.value = worst
  factor.detail = worstAlert
    ? `${active.length} active alert${active.length > 1 ? 's' : ''}; the worst counts: “${worstAlert.header}”`
    : active.length
      ? `${active.length} alert${active.length > 1 ? 's' : ''} elsewhere on the line, not on this trip.`
      : 'No active alerts.'
  if (unknown) factor.detail += ' Whether some alerts touch this trip is not known yet.'
  return { factor, floor }
}

function travelFactor(): Factor {
  return {
    key: 'travel',
    label: 'Excess travel time',
    weight: WEIGHTS.travel,
    status: 'unavailable',
    value: null,
    detail: 'Travel times are not measured yet.',
  }
}

/**
 * Combines measured factors. Missing factors are named and their weight left out openly:
 * the score is then over the measured share and marked provisional (03 section 6).
 */
function combine(
  base: Pick<ChaosScore, 'scope' | 'label'>,
  factors: Factor[],
  opts: { now: number; observedAt: number | null; floor: string | null; required?: Factor },
): ChaosScore {
  const measured = factors.filter((f) => f.value !== null)
  const measuredWeight = measured.reduce((s, f) => s + f.weight, 0)
  const missing = factors.filter((f) => f.value === null).map((f) => f.label.toLowerCase())
  const partial = factors.some((f) => f.status === 'partial')
  const limitations = missing.length ? [`Not measured: ${missing.join(', ')}.`] : []
  const result: ChaosScore = {
    ...base,
    value: null,
    band: null,
    provisional: true,
    confidence: null,
    confidenceReason: '',
    measuredWeight,
    factors,
    floor: null,
    limitations,
    observedAt: opts.observedAt,
    computedAt: opts.now,
    modelVersion: MODEL_VERSION,
  }
  if (opts.required && opts.required.value === null) {
    result.confidenceReason = `Unknown: ${opts.required.detail.toLowerCase()} Missing data is never shown as good service.`
    return result
  }
  if (measuredWeight < MIN_MEASURED_WEIGHT && opts.floor) {
    // A suspension holds the floor regardless of other inputs (03 section 12).
    result.value = SUSPENSION_FLOOR
    result.band = bandOf(SUSPENSION_FLOOR)
    result.floor = opts.floor
    result.confidence = 'low'
    result.confidenceReason = `Only ${Math.round(measuredWeight * 100)}% of the model measured; the score rests on the official alert alone.`
    return result
  }
  if (measuredWeight < MIN_MEASURED_WEIGHT) {
    result.confidenceReason = `Unknown: only ${Math.round(measuredWeight * 100)}% of the model could be measured (at least ${MIN_MEASURED_WEIGHT * 100}% needed).`
    return result
  }
  let value = measured.reduce((s, f) => s + f.weight * f.value!, 0) / measuredWeight
  if (opts.floor && value < SUSPENSION_FLOOR) {
    value = SUSPENSION_FLOOR
    result.floor = opts.floor
  }
  result.value = Math.round(value)
  result.band = bandOf(result.value)
  result.provisional = measuredWeight < 1
  result.confidence = measuredWeight >= 0.7 && !partial ? 'medium' : 'low'
  result.confidenceReason = `${Math.round(measuredWeight * 100)}% of the model measured${partial ? ', some of it on thin data' : ''}. Weights are not yet calibrated against real outcomes, so confidence is never high.`
  return result
}

/** Route (or, for a commute, route and direction) score: 03 section 4. */
export function routeScore(i: RouteInputs, label: string): ChaosScore {
  const { wait, unpredictability, at } = headwayFactors(i)
  const { factor: disruptions, floor } = disruptionFactor(i)
  const factors = [wait, disruptions, travelFactor(), unpredictability, availabilityFactor(i)]
  const times = [at, i.vehiclesAt].filter((t): t is number => t !== null)
  return combine({ scope: i.commute ? 'commute' : 'route', label }, factors, {
    now: i.now,
    observedAt: times.length ? Math.max(...times) : null,
    floor,
    // The alerts feed is the one input whose absence must make the score unknown (03 s12).
    required: disruptions,
  })
}

/**
 * Network score from the route scores, weighted by how many trains each line usually runs
 * at this hour (03 section 4). No floor: one suspended line makes that line critical, not
 * the whole network. Unknown lines are named, never counted as smooth.
 */
export function networkScore(
  routes: readonly ChaosScore[],
  baselines: Baselines | null,
  now: number,
): ChaosScore {
  const { dayType, hour } = serviceSlot(now)
  const typical = (line: LineId) =>
    baselines?.trains.find((t) => t.line === line && t.day_type === dayType && t.hour === hour)
      ?.typical_trains ?? 1
  const lines = LINES.map((l) => l.id)
  const total = lines.reduce((s, l) => s + typical(l), 0)
  const factors: Factor[] = routes.map((r, idx) => ({
    key: lines[idx],
    label: r.label,
    weight: typical(lines[idx]) / total,
    status: r.value === null ? 'unavailable' : r.provisional ? 'partial' : 'available',
    value: r.value,
    detail: r.value === null ? 'Unknown' : `${r.value}, ${BAND_TEXT[r.band!]}`,
  }))
  const times = routes.map((r) => r.observedAt).filter((t): t is number => t !== null)
  const score = combine({ scope: 'network', label: 'Whole subway' }, factors, {
    now,
    observedAt: times.length ? Math.max(...times) : null,
    floor: null,
  })
  score.limitations = [
    ...(factors.some((f) => f.value === null)
      ? [
          `Unknown lines left out: ${factors
            .filter((f) => f.value === null)
            .map((f) => f.label)
            .join(', ')}.`,
        ]
      : []),
    'Each line counts by how many trains it usually runs at this hour.',
    'Every line score is provisional: travel time is not measured yet.',
  ]
  if (score.value !== null) {
    score.provisional = true
    score.confidence = 'low'
    score.confidenceReason = `Built from ${factors.filter((f) => f.value !== null).length} of ${factors.length} line scores, each provisional.`
  }
  return score
}
