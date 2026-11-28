-- Step e (scores, DEC-062): the mean gap and the expected wait of a rider arriving at
-- random, E[H²] / (2 E[H]) (03 section 10), so live waits are compared on the same
-- definition. Null until the next import fills them.
ALTER TABLE baseline_headways ADD COLUMN mean_seconds INTEGER;
ALTER TABLE baseline_headways ADD COLUMN wait_seconds INTEGER;

-- Live gaps (/live-headways) read the last two hours of positions by source time; without
-- this index every request would scan all 14 days.
CREATE INDEX vehicle_obs_updated ON vehicle_obs (updated_at);
