# domain/

The rules of EnRoute, written as plain TypeScript with no React and no network. Run the tests with `npm test`.

| File            | What it decides                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines.ts`      | Which routes are in scope (Red, Orange, Blue, Green-B/C/D/E), their colours, names and display order, and how the Green branches combine into one line. Mattapan is excluded until Sprint 9 (DEC-026).           |
| `vehicle.ts`    | The app's `Vehicle` model, the only vehicle shape screens see.                                                                                                                                                   |
| `normalize.ts`  | Raw `/vehicles` response → `Vehicle[]`. Keeps in-scope routes, usable coordinates and a valid update time; one record per vehicle ID (newest wins).                                                              |
| `stopLabel.ts`  | "At [stop]" when stopped, "Approaching [stop]" when incoming or in transit, "Next stop unavailable" otherwise. Never guesses a stop.                                                                             |
| `freshness.ts`  | A vehicle is live up to 2 min since its last report, aging (faded) from 2 to 10 min, and dropped after 10 min. The feed is stale 45 s after the last successful fetch (DEC-024).                                 |
| `counts.ts`     | Active vehicles per line for the chart: every line, Green combined, map filter ignored (DEC-019).                                                                                                                |
| `lineStatus.ts` | Line status from official alerts: suspensions and shuttles are a major disruption, other alerts of severity 3+ are minor issues, and lower-severity notices are ignored. It is not the experimental Chaos Score. |
| `network.ts`    | Route patterns and stops → line paths and stations for the map.                                                                                                                                                  |
| `polyline.ts`   | Decodes the encoded polylines the MBTA uses for shapes.                                                                                                                                                          |
