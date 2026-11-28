# features/

One folder per view. A view combines live data, domain rules and shared components into a screen.

- `map/`: Live Map (R4, R5, route lines)
- `analytics/`: Analytics chart and alerts (R8)
- `commute/`: My Commute, saved stops with departures and when to leave (Sprint 4)

The non-map list of vehicles lives in the sidebar tree (`components/LineTree.tsx`), which every view shares.
