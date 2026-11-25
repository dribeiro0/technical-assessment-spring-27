# app/

The frame of the single-page app: everything that stays on screen while the view changes.

**Will contain**
- `AppShell.tsx`: title, one-line description, view tabs, line filter, refresh controls and the live/stale status. Desktop gets a wide toolbar and phones get a compact control row (00_master_plan.txt, section 5).
- `routes.tsx`: the three views, all on one page with no browser reload (R1).
  - `/`: Live Map (Sprint 1)
  - `/analytics`: Analytics (Sprint 3)
  - `/vehicles`: Vehicle list (Sprint 3)

**Rules**
- Switching views must not refetch data that is already held; the TanStack Query cache supplies it.
- View tabs keep the `?line=` filter in the URL (DEC-025).
