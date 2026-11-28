-- EnRoute history (Sprint 6, planning file 07). Times are epoch milliseconds.

-- Every collector run, successful or not: how collection itself is going (08).
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  ok INTEGER NOT NULL DEFAULT 0,
  vehicles INTEGER,
  alerts INTEGER,
  error TEXT
);
CREATE INDEX runs_started ON runs (started_at);

-- Raw positions: one row per vehicle and source time, so a repeat or a replay is ignored
-- by the primary key itself. Kept 14 days.
CREATE TABLE vehicle_obs (
  vehicle_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  retrieved_at INTEGER NOT NULL,
  route_id TEXT NOT NULL,
  direction_id INTEGER,
  trip_id TEXT,
  stop_id TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  bearing REAL,
  status TEXT,
  PRIMARY KEY (vehicle_id, updated_at)
);
CREATE INDEX vehicle_obs_retrieved ON vehicle_obs (retrieved_at);
CREATE INDEX vehicle_obs_route ON vehicle_obs (route_id, updated_at);

-- Latest known state per vehicle. Only ever replaced by a newer source time.
CREATE TABLE vehicle_current (
  vehicle_id TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL,
  retrieved_at INTEGER NOT NULL,
  route_id TEXT NOT NULL,
  direction_id INTEGER,
  trip_id TEXT,
  stop_id TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  bearing REAL,
  status TEXT
);

-- Each version of each alert (a new row whenever the MBTA updates it). Kept long-term.
CREATE TABLE alert_versions (
  alert_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  retrieved_at INTEGER NOT NULL,
  effect TEXT,
  severity INTEGER,
  lifecycle TEXT,
  header TEXT,
  routes TEXT,
  PRIMARY KEY (alert_id, updated_at)
);

-- Periods with no successful collection. Never filled in with invented data (07 s5).
CREATE TABLE gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  UNIQUE (start_at)
);

-- Small facts about the collection: collecting_since, last_success_at.
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
