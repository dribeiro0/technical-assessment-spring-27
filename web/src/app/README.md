# app/

The frame of the single-page app: everything that stays on screen while the view changes, plus the one place live data is fetched.

| File                   | What it does                                                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes.tsx`           | Two views on one page with no browser reload (R1): `/` Live Map and `/analytics` Analytics. Analytics loads on first use because the chart library is large.                                                                                                                     |
| `LiveDataProvider.tsx` | Fetches vehicles (every 15 s) and alerts (every 60 s) once for the whole app and shares them through `useLiveData()`. Handles pause, the 5 s manual-refresh throttle and waiting out an HTTP 429. Works out the feed status (live, stale, refresh failed, rate limited, paused). |
| `AppShell.tsx`         | The V5 layout. Desktop: ribbon, sidebar tree, tabs and view, properties panel, status bar. Phone: title header, tree in a drawer, properties in a bottom sheet. Holds the app title and description (R2).                                                                        |
| `Ribbon.tsx`           | Left icon column: Live Map, Analytics, Refresh, Pause (desktop).                                                                                                                                                                                                                 |
| `TabBar.tsx`           | Tabs across the top and the transit-mode selector (Subway; other modes marked "coming soon"). On phones it also holds the menu, refresh and pause buttons.                                                                                                                       |
| `RefreshButtons.tsx`   | Manual refresh and the auto-refresh pause toggle (R7).                                                                                                                                                                                                                           |
| `StatusBar.tsx`        | Bottom bar: feed status, last successful update, vehicle count, alert count.                                                                                                                                                                                                     |

**Rules**

- Switching views never refetches; both views read the same cached data.
- View links keep `?line=` and `?vehicle=` in the URL (DEC-025).
