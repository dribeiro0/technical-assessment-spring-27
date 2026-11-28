import {
  ROUTES,
  alertVersions,
  dedupe,
  gapSince,
  rawCutoff,
  vehicleObservations,
  type VehicleObservation,
} from './rules'
import { LIVE_LOOKBACK_MS, LIVE_WINDOW_MS, lineOf, liveGaps, type FirstSeen } from './live'

// EnRoute's collector (Sprint 6, DEC-012/DEC-013): records MBTA subway observations every
// minute, whether or not anyone has the site open, and serves a status summary to the site.

export interface Env {
  DB: D1Database
  /** Optional MBTA API key, set as a Cloudflare secret; never in the repo or the browser. */
  MBTA_API_KEY?: string
  /** Overridable for tests (a local stand-in API); production uses the real MBTA API. */
  MBTA_BASE_URL?: string
}

/** Health thresholds for /status: one missed run is fine, five means collection is down. */
const DEGRADED_AFTER_MS = 2.5 * 60_000
const DOWN_AFTER_MS = 5 * 60_000

async function mbta(env: Env, path: string): Promise<{ data?: unknown[] }> {
  const base = env.MBTA_BASE_URL || 'https://api-v3.mbta.com'
  const headers: Record<string, string> = { Accept: 'application/vnd.api+json' }
  if (env.MBTA_API_KEY) headers['x-api-key'] = env.MBTA_API_KEY
  const response = await fetch(`${base}${path}`, { headers })
  if (!response.ok) throw new Error(`MBTA ${path.split('?')[0]} returned HTTP ${response.status}`)
  const body = (await response.json()) as { data?: unknown[] }
  if (!Array.isArray(body.data)) throw new Error(`MBTA ${path.split('?')[0]} sent no data`)
  return body
}

async function meta(db: D1Database, key: string): Promise<number | null> {
  const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: number }>()
  return row?.value ?? null
}

function setMeta(db: D1Database, key: string, value: number) {
  return db
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value)
}

const VEHICLE_COLUMNS =
  'vehicle_id, updated_at, retrieved_at, route_id, direction_id, trip_id, stop_id, lat, lon, bearing, status'

function vehicleValues(o: VehicleObservation) {
  return [o.vehicleId, o.updatedAt, o.retrievedAt, o.routeId, o.directionId, o.tripId, o.stopId, o.lat, o.lon, o.bearing, o.status]
}

/**
 * One collection run. A failure is logged and leaves last_success_at alone, so the next
 * good run records the gap (08, F9: "retry or record gap; never fabricate").
 */
export async function collect(env: Env, now: number): Promise<{ ok: boolean; error?: string }> {
  const db = env.DB
  const run = await db
    .prepare('INSERT INTO runs (started_at) VALUES (?) RETURNING id')
    .bind(now)
    .first<{ id: number }>()
  try {
    const routes = ROUTES.join(',')
    const [vehiclesDoc, alertsDoc] = await Promise.all([
      mbta(env, `/vehicles?filter[route]=${routes}`),
      mbta(env, `/alerts?filter[route]=${routes}`),
    ])
    const retrievedAt = Date.now()
    const observations = dedupe(vehicleObservations(vehiclesDoc as never, retrievedAt))
    const alerts = alertVersions(alertsDoc as never, retrievedAt)

    const lastSuccess = await meta(db, 'last_success_at')
    const gap = gapSince(lastSuccess, now)
    const placeholders = VEHICLE_COLUMNS.split(',').map(() => '?').join(', ')

    const statements = [
      // H2: a repeat (same vehicle, same source time) is ignored by the primary key.
      ...observations.map((o) =>
        db.prepare(`INSERT OR IGNORE INTO vehicle_obs (${VEHICLE_COLUMNS}) VALUES (${placeholders})`).bind(...vehicleValues(o)),
      ),
      // H4: current state only moves forward in source time.
      ...observations.map((o) =>
        db
          .prepare(
            `INSERT INTO vehicle_current (${VEHICLE_COLUMNS}) VALUES (${placeholders})
             ON CONFLICT(vehicle_id) DO UPDATE SET
               updated_at = excluded.updated_at, retrieved_at = excluded.retrieved_at,
               route_id = excluded.route_id, direction_id = excluded.direction_id,
               trip_id = excluded.trip_id, stop_id = excluded.stop_id, lat = excluded.lat,
               lon = excluded.lon, bearing = excluded.bearing, status = excluded.status
             WHERE excluded.updated_at > vehicle_current.updated_at`,
          )
          .bind(...vehicleValues(o)),
      ),
      ...alerts.map((a) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO alert_versions
               (alert_id, updated_at, retrieved_at, effect, severity, lifecycle, header, routes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(a.alertId, a.updatedAt, a.retrievedAt, a.effect, a.severity, a.lifecycle, a.header, a.routes),
      ),
      // H3: one gap per outage, written by the run that ends it.
      ...(gap ? [db.prepare('INSERT OR IGNORE INTO gaps (start_at, end_at) VALUES (?, ?)').bind(gap.start, gap.end)] : []),
      db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('collecting_since', ?)").bind(now),
      setMeta(db, 'last_success_at', now),
      // H5: raw positions older than 14 days go; events, gaps and runs stay.
      db.prepare('DELETE FROM vehicle_obs WHERE retrieved_at < ?').bind(rawCutoff(now)),
      db
        .prepare('UPDATE runs SET finished_at = ?, ok = 1, vehicles = ?, alerts = ? WHERE id = ?')
        .bind(Date.now(), observations.length, alerts.length, run?.id ?? -1),
    ]
    await db.batch(statements)
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await db
      .prepare('UPDATE runs SET finished_at = ?, ok = 0, error = ? WHERE id = ?')
      .bind(Date.now(), error.slice(0, 500), run?.id ?? -1)
      .run()
    return { ok: false, error }
  }
}

/** What the site and a health check need to know about collection (H6, H8). */
export async function status(db: D1Database, now: number) {
  const dayAgo = now - 24 * 3600_000
  const [since, lastSuccess, lastRun, runs, gaps, observations] = await Promise.all([
    meta(db, 'collecting_since'),
    meta(db, 'last_success_at'),
    db.prepare('SELECT started_at, ok, error FROM runs ORDER BY id DESC LIMIT 1').first<{ started_at: number; ok: number; error: string | null }>(),
    db
      .prepare('SELECT COUNT(*) AS total, SUM(ok) AS ok FROM runs WHERE started_at >= ?')
      .bind(dayAgo)
      .first<{ total: number; ok: number | null }>(),
    db.prepare('SELECT start_at, end_at FROM gaps ORDER BY start_at DESC LIMIT 20').all<{ start_at: number; end_at: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM vehicle_obs').first<{ n: number }>(),
  ])
  const quiet = lastSuccess === null ? Infinity : now - lastSuccess
  return {
    health: quiet > DOWN_AFTER_MS ? 'down' : quiet > DEGRADED_AFTER_MS ? 'degraded' : 'ok',
    collectingSince: since,
    lastSuccessAt: lastSuccess,
    lastRun: lastRun ? { at: lastRun.started_at, ok: lastRun.ok === 1, error: lastRun.error } : null,
    last24h: { runs: runs?.total ?? 0, successful: runs?.ok ?? 0 },
    gaps: (gaps.results ?? []).map((g) => ({ start: g.start_at, end: g.end_at })),
    rawObservations: observations?.n ?? 0,
  }
}

/**
 * Baselines from public MBTA history (Sprint 7, DEC-059), always with their source (B6).
 * Null when none have been imported, so the site can say so rather than guess.
 */
export async function baselines(db: D1Database) {
  const source = await db
    .prepare('SELECT source, from_date, to_date, days, events, imported_at FROM baseline_source WHERE id = 1')
    .first<{ source: string; from_date: number; to_date: number; days: number; events: number; imported_at: number }>()
  if (!source) return null
  const [headways, trains] = await Promise.all([
    db
      .prepare(
        'SELECT line, direction_id, day_type, hour, samples, median_seconds, p90_seconds, scheduled_median_seconds, reliable_share, mean_seconds, wait_seconds FROM baseline_headways',
      )
      .all(),
    db.prepare('SELECT line, day_type, hour, typical_trains, days FROM baseline_trains').all(),
  ])
  return {
    source: {
      name: source.source,
      fromDate: source.from_date,
      toDate: source.to_date,
      days: source.days,
      events: source.events,
      importedAt: source.imported_at,
    },
    headways: headways.results,
    trains: trains.results,
  }
}

/**
 * Live gaps between trains over the last 30 minutes (step e, DEC-062), timed against the
 * last successful collection, not the clock: if collection stops, gaps do not grow on
 * their own. Null before the first successful run.
 */
export async function liveHeadways(db: D1Database) {
  const asOf = await meta(db, 'last_success_at')
  if (asOf === null) return null
  const rows = await db
    .prepare(
      `SELECT route_id, direction_id, stop_id, trip_id, MIN(updated_at) AS at
       FROM vehicle_obs
       WHERE updated_at > ? AND updated_at <= ?
         AND stop_id IS NOT NULL AND trip_id IS NOT NULL AND direction_id IN (0, 1)
         AND trip_id NOT LIKE 'NONREV%'
       GROUP BY route_id, direction_id, stop_id, trip_id`,
    )
    .bind(asOf - LIVE_LOOKBACK_MS, asOf)
    .all<{ route_id: string; direction_id: 0 | 1; stop_id: string; trip_id: string; at: number }>()
  const firstSeen: FirstSeen[] = []
  for (const r of rows.results ?? []) {
    const line = lineOf(r.route_id)
    if (line) firstSeen.push({ line, directionId: r.direction_id, stopId: r.stop_id, tripId: r.trip_id, at: r.at })
  }
  return { asOf, windowMinutes: LIVE_WINDOW_MS / 60_000, lines: liveGaps(firstSeen, asOf) }
}

let liveCache: { at: number; body: Awaited<ReturnType<typeof liveHeadways>> } | null = null

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(collect(env, Date.now()))
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/status') {
      return new Response(JSON.stringify(await status(env.DB, Date.now())), {
        headers: { ...CORS, 'Cache-Control': 'public, max-age=30' },
      })
    }
    if (request.method === 'GET' && url.pathname === '/baselines') {
      const body = await baselines(env.DB)
      // Baselines change only on import: cache for an hour.
      return new Response(JSON.stringify(body), {
        status: body ? 200 : 404,
        headers: { ...CORS, 'Cache-Control': 'public, max-age=3600' },
      })
    }
    if (request.method === 'GET' && url.pathname === '/live-headways') {
      // One calculation per minute per Worker instance, however many readers.
      if (!liveCache || Date.now() - liveCache.at > 60_000) {
        liveCache = { at: Date.now(), body: await liveHeadways(env.DB) }
      }
      const body = liveCache.body
      // New data arrives every minute.
      return new Response(JSON.stringify(body), {
        status: body ? 200 : 404,
        headers: { ...CORS, 'Cache-Control': 'public, max-age=60' },
      })
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS })
  },
}
