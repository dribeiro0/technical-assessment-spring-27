# collector/

EnRoute's collector (Sprint 6): a Cloudflare Worker that records MBTA subway observations **every minute, whether or not anyone has the site open** (DEC-012), into a Cloudflare D1 database. It is deployed separately from the site in `web/`, so a collector problem can never break the site.

| File                          | What it does                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/rules.ts`                | The rules, as plain functions with tests: parsing positions and alert versions, duplicate keys, "only if newer", when a gap is due, the 14-day retention cut-off.                   |
| `src/worker.ts`               | The Worker. Every minute (`scheduled`) it runs one collection; `GET /status` returns collecting-since, last run, last success, run counts for 24 h, recent gaps and overall health. |
| `migrations/0001_history.sql` | The tables: `runs`, `vehicle_obs` (raw, 14 days), `vehicle_current`, `alert_versions`, `gaps`, `meta`.                                                                              |
| `wrangler.toml`               | Worker name, the every-minute schedule and the database binding.                                                                                                                    |

**Rules (planning files 07 and 08)**

- Every record keeps its **source time** (`updated_at`) and **retrieval time**.
- Duplicates are stored once: the primary key is vehicle + source time, inserted with `INSERT OR IGNORE`, so replaying a batch changes nothing.
- An older report never overwrites a newer one in `vehicle_current`.
- A failed run is logged and leaves `last_success_at` alone; the next good run records one **gap** from the last success to now. Gaps are never filled in.
- Raw positions are deleted after 14 days; runs, gaps and alert versions are kept.

**Commands** (run in this folder)

```sh
npm test                                            # rules
npx wrangler d1 migrations apply enroute-history --local
npx wrangler dev --test-scheduled                   # then GET /__scheduled to run once, /status to read
npx wrangler deploy                                 # after `wrangler login` and creating the database
npx wrangler secret put MBTA_API_KEY                # the key is typed at the prompt, never committed
```

**Baselines from MBTA history (Sprint 7)**

| File                                 | What it does                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/baselines.ts`                   | The rules, with tests: reading LAMP rows, day types, typical and 90th-percentile gaps, reliability (within 2 minutes of schedule), typical trains mid-hour. |
| `src/live.ts`                        | Live gaps between trains at each stop over the last 30 minutes, from the collector's own positions, measured as the baselines are (step e, DEC-062).        |
| `scripts/import-lamp.ts`             | Downloads the last N days of LAMP (cached in `.lamp-cache/`) and writes `baselines.sql`, which replaces all baselines.                                      |
| `migrations/0002_baselines.sql`      | `baseline_headways`, `baseline_trains`, `baseline_source`.                                                                                                  |
| `migrations/0003_wait_baselines.sql` | Mean gap and expected wait per slot; an index on `vehicle_obs (updated_at)` for live gaps.                                                                  |

`GET /baselines` returns the source and all summaries (cached an hour).

`GET /live-headways` returns, per line and direction, the gaps between trains that ended in the last 30 minutes and how long each stop has waited since its last train, timed against the last successful collection (worked out at most once a minute). The site turns these into the experimental Chaos Score (`web/src/domain/chaos.ts`).

Both sides measure gaps the same way: passenger platforms only (terminal tracks such as `Alewife-01` each see every other train), never a trip's first stop (layover), and each gap capped at 3 times the usual 90th-percentile gap before the expected wait, E[H²] / 2E[H], is worked out. The import takes finished service days only.

```sh
node scripts/import-lamp.ts 56                                     # 8 weeks
npx wrangler d1 execute enroute-history --remote --file baselines.sql
```
