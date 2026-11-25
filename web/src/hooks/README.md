# hooks/

React hooks that connect screens to data and shared state.

| File                  | What it does                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveData.ts`         | The `LiveData` shape, the `FeedStatus` values and `useLiveData()`, which any component uses to read the shared live data from `app/LiveDataProvider.tsx`. |
| `useViewParams.ts`    | Reads and writes `?line=` (the filter) and `?vehicle=` (the selection) in the URL, so both survive view switches and reloads (DEC-025).                   |
| `useNetwork.ts`       | Line paths and stations, cached on the device for 24 h.                                                                                                   |
| `useNow.ts`           | A ticking clock for "8 s ago" labels.                                                                                                                     |
| `useReducedMotion.ts` | Whether the system asks for reduced motion (turns off chart animation).                                                                                   |

**Rules**

- An empty filter result and a failed refresh are different states and stay distinguishable (DEC-019).
- After a failed refresh, the last good data and its time stay on screen.
