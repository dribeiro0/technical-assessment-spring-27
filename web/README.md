# Chaos Meter: web app

A live MBTA subway dashboard: every Red, Orange, Blue and Green Line train on a dark map, where it is, where it's headed and what's going wrong. Built on the official MBTA V3 API. The product plan lives in [`../docs/planning`](../docs/planning/readme.md).

## Features

- **Live map** (React Leaflet): every train in its line colour. An arrow shows its heading when moving and a square when stopped. Car numbers appear when zoomed in. Line paths and stations are drawn underneath.
- **Popups and properties:** line, direction, status and next stop ("At Park Street", "Approaching Kendall/MIT" or "Next stop unavailable"), plus how old the report is.
- **Sidebar tree:** filter by line, then expand a line to list its trains with stop and age. It doubles as the non-map list.
- **Line status** from official MBTA alerts: ○ good service, ▲ minor issues, ■ major disruption.
- **Analytics:** "Active vehicles by subway line" chart (Green branches combined), a table of the same numbers, and service alerts.
- **Refresh:** automatic every 15 s, a manual refresh button and a pause toggle. The status bar shows the last update time.
- **Honest data states:**
  - Reports 2-10 min old are faded; older ones are dropped.
  - A failed refresh keeps the last good data and says so.
  - A failed first load shows an error panel with Retry.
  - An empty filter result is explained, not shown as an error.
- **One page:** switching views never reloads. The line filter and selected train live in the URL (`?line=Red&vehicle=…`).
- **Responsive:** the desktop layout has the tree and properties panels; on phones the tree moves to a drawer and the details to a bottom sheet.

## Stack

| Layer | Tool |
| --- | --- |
| Build and dev server | Vite |
| UI and language | React + TypeScript |
| Views | React Router |
| Map | React Leaflet + Leaflet, Esri Dark Gray basemap |
| Data fetching and cache | TanStack Query |
| Chart | Recharts |
| Styling | Tailwind CSS v4 |
| Tests | Vitest |
| Lint and format | oxlint + Prettier |
| Hosting | Vercel (Root Directory `web`) |

There is no backend and no API key: the browser calls the MBTA API directly (DEC-021).

## Commands

Run these inside `web/`:

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at http://localhost:5173 |
| `npm test` | Run the unit tests for the data rules |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |
| `npm run format` | Format with Prettier |

## How the code is organized

Data moves through three layers in one direction:

```
api/  (raw MBTA JSON)  ->  domain/  (clean Vehicle model and rules)  ->  app/ + features/ + components/  (screens)
```

| Folder | Role |
| --- | --- |
| `src/api/` | Every MBTA request, error types and raw response shapes |
| `src/domain/` | Plain, tested rules: line scope, normalization, stop labels, freshness, counts, line status |
| `src/app/` | App frame, routes and the shared live-data provider (polling, pause, rate limits) |
| `src/hooks/` | Shared state (URL filter and selection), cached network data, clocks |
| `src/features/` | The two views: `map/` and `analytics/` |
| `src/components/` | Shared pieces: line tree, properties panel, notices, alert list |
| `src/styles/` | Tailwind setup and design tokens |

Each folder has a README describing its files.

## Request budget

The anonymous MBTA limit is 20 requests per minute per network address. The app uses about 5:

- vehicles every 15 s (4 per minute)
- alerts every 60 s (1 per minute)
- line paths and stations once a day, cached on the device

Manual refresh is limited to once every 5 s. Polling stops while the tab is hidden. After an HTTP 429 the app waits a minute and keeps showing the last good data.
