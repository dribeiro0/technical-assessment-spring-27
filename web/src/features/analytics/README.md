# features/analytics/

The Analytics view (R8).

| File                      | What it does                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AnalyticsView.tsx`       | The chart card, a table with the same numbers (vehicles, Green branch counts, line status) and the service alerts list. Clicking a line opens it on the map. |
| `VehiclesByLineChart.tsx` | Recharts bar chart "Active vehicles by subway line": one bar per line in its colour, value labels on top, no animation under reduced motion.                 |

**Rules**

- Counts come from `domain/counts.ts` and the same data the map uses, so the two always agree.
- The chart ignores the map's line filter and always compares every line (DEC-019).
- Vehicle counts are not a Chaos Score.

`HistoryPanel.tsx` shows EnRoute's own history collection (Sprint 6): collecting since, runs in the last 24 hours and gaps, or that history is unavailable. Trend charts come in Sprint 7.

`ReliabilityChart.tsx` shows how reliable each line is by hour (Sprint 7), from MBTA LAMP history, for weekdays, Saturdays or Sundays. The line table's "Usually" column compares live counts with the typical count for the hour.
