# hooks/

React hooks that connect the screens to data and shared state.

**Will contain**
- `useVehicles.ts`: live vehicles through TanStack Query.
  - Refreshes every 15 s and pauses while the tab is hidden.
  - Manual refresh is allowed at most once every 5 s and restarts the timer.
  - After a failed refresh, keeps the last successful data and its time.
  - Waits for the rate-limit reset after an HTTP 429.
- `useRoutes.ts`: route names and colours, fetched once per visit.
- `useShapes.ts`: route lines for the map, cached on the device for 24 h (Sprint 3).
- `useLineFilter.ts`: reads and writes the `?line=` URL parameter, so the filter survives view switches and reloads (DEC-025).

**Rules**
- A hook returns data plus its state: loading, error, last updated, stale. Screens decide how to show it.
- An empty filter result and a failed refresh are different states and must stay distinguishable (DEC-019).
