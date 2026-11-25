# EnRoute: web app

EnRoute is a live MBTA subway dashboard: every Red, Orange, Blue and Green Line train on a live map of Boston, where it is, where it's headed and what's going wrong. Built on the official MBTA V3 API. The product plan lives in [`../docs/planning`](../docs/planning/readme.md).

## Features

- **Live map** (React Leaflet): every train in its line colour. An arrow shows its heading when moving and a square when stopped. Trains glide between updates, are labelled by destination when zoomed in, and the map zooms to fit a chosen line. Line paths and stations are drawn underneath.
- **Popups:** line, direction, status and next stop ("At Park Street", "Approaching Kendall/MIT" or "Next stop unavailable"), plus how old the report is.
- **Train card:** pick a train and a card shows a countdown to its next stop ("1 min to Harvard") and a strip of the stops ahead with their times, filled up to the train. It comes from MBTA predictions and falls back to the stop text when there are none.
- **Line status badges** from official MBTA alerts (○ good service, ▲ minor issues, ■ major disruption); each badge also filters the map.
- **Train list:** expand a line to see its trains by destination, with stop and age. It doubles as the non-map list.
- **Analytics:** "Active vehicles by subway line" chart (Green branches combined), a table of the same numbers, and service alerts.
- **Refresh:** automatic every 15 s, a manual refresh button and a pause toggle. The status bar shows the last update time.
- **Honest data states:**
  - Reports 2-10 min old are faded; older ones are dropped.
  - A failed refresh keeps the last good data and says so.
  - A failed first load shows an error panel with Retry.
  - An empty filter result is explained, not shown as an error.
- **One page:** switching views never reloads. The line filter and selected train live in the URL (`?line=Red&vehicle=…`).
- **Responsive:** on phones the sidebar moves to a drawer and the train card becomes a bottom sheet.
- **Accessible:** keyboard access with visible focus, text contrast of at least 4.5:1, status never shown by colour alone, and reduced motion respected.

## Stack

| Layer                   | Tool                                            |
| ----------------------- | ----------------------------------------------- |
| Build and dev server    | Vite                                            |
| UI and language         | React + TypeScript                              |
| Views                   | React Router                                    |
| Map                     | React Leaflet + Leaflet, Esri Dark Gray basemap |
| Data fetching and cache | TanStack Query                                  |
| Chart                   | Recharts                                        |
| Styling                 | Tailwind CSS v4                                 |
| Tests                   | Vitest                                          |
| Lint and format         | oxlint + Prettier                               |
| Hosting                 | Vercel (Root Directory `web`)                   |

There is no backend and no API key: the browser calls the MBTA API directly (DEC-021).

## Commands

Run these inside `web/`:

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `npm install`     | Install dependencies                             |
| `npm run dev`     | Start the dev server at http://localhost:5173    |
| `npm test`        | Run the unit tests for the data rules            |
| `npm run build`   | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally               |
| `npm run lint`    | Lint with oxlint                                 |
| `npm run format`  | Format with Prettier                             |

## How the code is organized

Data moves through three layers in one direction:

```
api/  (raw MBTA JSON)  ->  domain/  (clean Vehicle model and rules)  ->  app/ + features/ + components/  (screens)
```

| Folder            | Role                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `src/api/`        | Every MBTA request, error types and raw response shapes                                                  |
| `src/domain/`     | Plain, tested rules: line scope, normalization, stop labels, freshness, counts, line status, predictions |
| `src/app/`        | App frame, routes and the shared live-data provider (polling, pause, rate limits)                        |
| `src/hooks/`      | Polling rules, train predictions, URL filter and selection, cached network data, clocks                  |
| `src/features/`   | The two views: `map/` and `analytics/`                                                                   |
| `src/components/` | Shared pieces: status badges, train list, train card, notices, alert list                                |
| `src/styles/`     | Tailwind setup and design tokens                                                                         |

Each folder has a README describing its files.

## Request budget

The anonymous MBTA limit is 20 requests per minute per network address. The app uses about 5, or 9 with a train selected:

- vehicles every 15 s (4 per minute)
- alerts every 60 s (1 per minute)
- predictions for the selected train every 15 s (4 per minute, only while one is selected)
- line paths and stations once a day, cached on the device

Manual refresh is limited to once every 5 s. Polling stops while the tab is hidden and resumes when you come back. After an HTTP 429 every request waits a minute while the last good data stays on screen.

## Testing

- `npm test` runs 37 unit tests on the data rules in `src/domain`.
- The audit of November 25, 2026 is recorded in section 9 of [`../docs/planning/10_assessment_audit.txt`](../docs/planning/10_assessment_audit.txt). It covers live-data checks, error states forced through a local stand-in API, contrast and keyboard checks.
