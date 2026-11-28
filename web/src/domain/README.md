# domain/

The rules of EnRoute, written as plain TypeScript with no React and no network. Run the tests with `npm test`.

| File                | What it decides                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines.ts`          | Which routes are in scope (Red, Orange, Blue, Green-B/C/D/E), their colours, names and display order, and how the Green branches combine into one line. Mattapan is excluded until Sprint 9 (DEC-026).           |
| `vehicle.ts`        | The app's `Vehicle` model, the only vehicle shape screens see.                                                                                                                                                   |
| `normalize.ts`      | Raw `/vehicles` response → `Vehicle[]`. Keeps in-scope routes, usable coordinates and a valid update time; one record per vehicle ID (newest wins).                                                              |
| `stopLabel.ts`      | "At [stop]" when stopped, "Approaching [stop]" when incoming or in transit, "Next stop unavailable" otherwise. Never guesses a stop.                                                                             |
| `freshness.ts`      | A vehicle is live up to 2 min since its last report, aging (faded) from 2 to 10 min, and dropped after 10 min. The feed is stale 45 s after the last successful fetch (DEC-024).                                 |
| `counts.ts`         | Active vehicles per line for the chart: every line, Green combined, map filter ignored (DEC-019).                                                                                                                |
| `lineStatus.ts`     | Line status from official alerts: suspensions and shuttles are a major disruption, other alerts of severity 3+ are minor issues, and lower-severity notices are ignored. It is not the experimental Chaos Score. |
| `predictions.ts`    | Raw `/predictions` response for one trip → the stops ahead with arrival estimates; the countdown text ("4 min", "Now"); which stops fit on the strip; and how far the train is toward its next stop.             |
| `departures.ts`     | Raw `/predictions` response for one station → boardable departures (no trains ending there, one per train even when each Green Line car is listed), grouped by line and destination.                             |
| `baselines.ts`      | "Is now worse than usual?": the MBTA service day and hour for a moment, the typical train count for it, and reliability by hour, never on too little data (DEC-061).                                             |
| `commute.ts`        | Saved commutes: their stored format and checks, reversing, timetable parsing, choosing LIVE over SCHEDULED departures, the service day past midnight, and "Leave in N min" (rounded down).                       |
| `commuteRoute.ts`   | The stretch of line a commute rides, cut out of the full line shapes, and the stations on it, so the map can focus on it (DEC-049). Uses the Red branch table where tracks run side by side (DEC-050).           |
| `alertRelevance.ts` | Whether an alert affects a saved commute: direct, elsewhere on the route, unknown or none (DEC-055).                                                                                                             |
| `network.ts`        | Route patterns and stops → line paths and stations for the map.                                                                                                                                                  |
| `polyline.ts`       | Decodes the encoded polylines the MBTA uses for shapes.                                                                                                                                                          |
