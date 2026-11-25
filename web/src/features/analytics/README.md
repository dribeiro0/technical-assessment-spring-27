# features/analytics/

The Analytics view (Sprint 3, R8).

**Will contain**
- `AnalyticsView.tsx`: the view layout, with the chart's scope, unit and last-updated time.
- `VehiclesByLineChart.tsx`: a Recharts bar chart, "Active vehicles by subway line".
  - One bar each for Red, Orange, Blue and Green, with the Green branches combined.
  - Each bar is in its line colour and also labelled with text, so colour isn't the only cue.

**Rules**
- Counts come from `domain/counts.ts` and the same vehicle data the map uses, so the two always agree.
- The chart ignores the map's line filter and always compares every in-scope line (DEC-019).
- Values must match a direct count of the current `/vehicles` response (R8 check).
- Vehicle counts are not a Chaos Score.
