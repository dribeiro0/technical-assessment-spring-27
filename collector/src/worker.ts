import {
  ROUTES,
  alertVersions,
  dedupe,
  gapSince,
  rawCutoff,
  vehicleObservations,
  type VehicleObservation,
} from './rules'

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
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS })
  },
}
