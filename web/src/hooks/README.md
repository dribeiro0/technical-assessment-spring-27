# hooks/

React hooks that connect screens to data and shared state.

| File                      | What it does                                                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveData.ts`             | The `LiveData` shape, the `FeedStatus` values and `useLiveData()`, which any component uses to read the shared live data from `app/LiveDataProvider.tsx`.                                                                                                                                                      |
| `polling.ts`              | The shared refresh rules: poll intervals, pausing, waiting out a rate limit, and retrying network hiccups (but never a rate limit).                                                                                                                                                                            |
| `useTripPredictions.ts`   | Upcoming stops and arrival estimates for the selected train, every 15 s while it stays selected.                                                                                                                                                                                                               |
| `useStationDepartures.ts` | The next departures from the selected station, every 15 s while it stays selected.                                                                                                                                                                                                                             |
| `useViewParams.ts`        | Reads and writes `?line=` (the filter) and `?vehicle=` (the selection) in the URL, so both survive view switches and reloads (DEC-025). Also holds the selected station (`?stop=`); a train and a station are never selected at once. Moving the filter to another line deselects a train on a different line. |
| `useNetwork.ts`           | Line paths and stations, cached on the device for 24 h; retried every minute if loading fails.                                                                                                                                                                                                                 |
| `useNow.ts`               | A ticking clock for "8 s ago" labels and countdowns.                                                                                                                                                                                                                                                           |
| `useReducedMotion.ts`     | Whether the system asks for reduced motion (turns off gliding, map and chart animation).                                                                                                                                                                                                                       |

**Rules**

- An empty filter result and a failed refresh are different states and stay distinguishable (DEC-019).
- After a failed refresh, the last good data and its time stay on screen.
