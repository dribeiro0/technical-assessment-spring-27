# domain/

The rules of Chaos Meter, written as plain TypeScript with no React and no network. Every file here gets a test next to it (`*.test.ts`).

**Will contain**
- `lines.ts`: which routes are in scope (Red, Orange, Blue, Green-B/C/D/E), their colours and display names, and how the Green branches combine into one Green line. Mattapan is excluded until Sprint 9 (DEC-026).
- `normalize.ts`: turns the raw API response into the app's `Vehicle` model.
  - Keeps in-scope routes only.
  - Requires usable coordinates.
  - Keeps one record per vehicle ID.
  - Resolves direction from the included trip and stop from the included stop.
- `stopLabel.ts`: builds the popup's stop text from `current_status` and the stop.
  - `STOPPED_AT` gives "At [stop]".
  - `INCOMING_AT` and `IN_TRANSIT_TO` give "Approaching [stop]".
  - With no stop: "Next stop unavailable".
- `freshness.ts`: the timing rules from DEC-024.
  - A vehicle is live up to 2 min since its last update, aging from 2 to 10 min, and dropped after 10 min.
  - The feed is stale 45 s after the last successful fetch.
- `counts.ts`: active vehicles per line for the Analytics chart. It counts every in-scope line regardless of the map filter, with Green combined into one bar (DEC-019).

**Rules**
- A missing value is shown as unknown, never guessed (02_functional_architecture.txt, section 2).
- These functions decide what is true. Screens only display the result.
