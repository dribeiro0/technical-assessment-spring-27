# components/

Shared controls used by more than one view.

**Will contain**
- `LineFilter.tsx`: choose All, Red, Orange, Blue or Green. Updates `?line=` (R6, Sprint 2).
- `RefreshControls.tsx`: the manual refresh button, an auto-refresh pause toggle (Sprint 3) and the last successful update time (R7, Sprint 2).
- `ErrorPanel.tsx`: the small panel that pops up when the first load fails, with a Retry button. It is never a blank page (DEC-024).
- `StaleBanner.tsx`: a notice when data is more than 45 s old or the app is waiting out a rate limit, showing the time of the last good data.

**Rules**
- Everything works with the keyboard, with visible focus.
- Status is never shown by colour alone. Pair it with text or a symbol.
