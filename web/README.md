# Chaos Meter: web app

The single-page Chaos Meter dashboard, built on live MBTA V3 data. The product plan lives in [`../docs/planning`](../docs/planning/readme.md); start with `00_master_plan.txt`.

**Status:** structure and tooling only. Application code starts with Sprint 1 (Live Map).

## Stack (DEC-020 to DEC-022)

| Layer | Tool |
|---|---|
| Build and dev server | Vite |
| UI and language | React + TypeScript |
| Views | React Router |
| Map | React Leaflet + Leaflet, CARTO tiles |
| Data fetching and cache | TanStack Query |
| Chart | Recharts |
| Styling | Tailwind CSS v4 |
| Tests | Vitest + React Testing Library |
| Lint and format | oxlint + Prettier |
| Hosting | Vercel, Root Directory set to `web`, with a custom domain |

There is no backend and no API key: the browser calls the MBTA API directly (DEC-021).

## Commands

Run these inside `web/`:

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at http://localhost:5173 |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## How the code is organized

Data moves through three layers in one direction:

```
api/  (raw MBTA JSON)  ->  domain/  (clean Vehicle model and rules)  ->  features/  (screens)
```

| Folder | Role |
|---|---|
| `src/app/` | App shell and the three views (Live Map, Analytics, Vehicles) |
| `src/api/` | Every MBTA request, rate-limit handling and raw response types |
| `src/domain/` | Plain, tested rules: line scope, normalization, stop labels, freshness, counts |
| `src/hooks/` | Data hooks (refresh timing, last good data) and the URL line filter |
| `src/features/` | One folder per view: `map/`, `analytics/`, `vehicles/` |
| `src/components/` | Shared controls: line filter, refresh, error panel, stale banner |
| `src/styles/` | Tailwind setup, MBTA colours and design tokens |

Each folder has its own README describing what goes there.

The template's `src/App.tsx`, `src/App.css`, `src/index.css` and `src/assets/` are Vite's starter demo. Sprint 1 replaces them.

## Data rules at a glance

- **Refresh:** vehicles every 15 s, paused while the tab is hidden. Manual refresh is allowed at most once every 5 s. After an HTTP 429, wait for the rate-limit reset (DEC-023).
- **Freshness:** a vehicle is live up to 2 min since its last update, faded from 2 to 10 min, and dropped after 10 min. The feed is stale 45 s after the last successful fetch (DEC-024).
- **Failure:** keep the last good data and its time. If the first load fails, show an error panel with Retry.
- **Scope:** Red, Orange, Blue and Green (B, C, D and E branches). Mattapan comes in Sprint 9 (DEC-026).
