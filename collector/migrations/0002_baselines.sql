-- Baselines from public MBTA history (Sprint 7, DEC-059). Summaries only, replaced as a
-- whole by each import, so re-importing changes nothing (B2).

-- Gaps between trains per line, direction, day type and Boston hour.
CREATE TABLE baseline_headways (
  line TEXT NOT NULL,
  direction_id INTEGER NOT NULL,
  day_type TEXT NOT NULL,
  hour INTEGER NOT NULL,
  samples INTEGER NOT NULL,
  median_seconds INTEGER NOT NULL,
  p90_seconds INTEGER NOT NULL,
  scheduled_median_seconds INTEGER NOT NULL,
  reliable_share REAL NOT NULL,
  PRIMARY KEY (line, direction_id, day_type, hour)
);

-- Typical trains running mid-hour per line, day type and Boston hour.
CREATE TABLE baseline_trains (
  line TEXT NOT NULL,
  day_type TEXT NOT NULL,
  hour INTEGER NOT NULL,
  typical_trains INTEGER NOT NULL,
  days INTEGER NOT NULL,
  PRIMARY KEY (line, day_type, hour)
);

-- Where the baselines came from (B6): always shown with them.
CREATE TABLE baseline_source (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT NOT NULL,
  from_date INTEGER NOT NULL,
  to_date INTEGER NOT NULL,
  days INTEGER NOT NULL,
  events INTEGER NOT NULL,
  imported_at INTEGER NOT NULL
);
