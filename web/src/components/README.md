# components/

Shared pieces used by more than one view.

| File | What it does |
| --- | --- |
| `LineTree.tsx` | The sidebar tree. Clicking a line filters the map (R6); the caret expands it into its vehicles with stop label and age. It doubles as the non-map vehicle list (09). |
| `PropertiesPanel.tsx` | Details of the selected vehicle, or network status and alerts when nothing is selected. A side panel on desktop, a bottom sheet on phones. |
| `FeedNotices.tsx` | The error panel with Retry for a failed first load, the loading notice, and the banner explaining stale, failed, rate-limited or paused data. |
| `AlertList.tsx` | Official MBTA alerts, most severe first. |
| `StatusMark.tsx` | Line status as a symbol plus text: ○ good service, ▲ minor issues, ■ major disruption. |
| `Icons.tsx` | Small inline icons. |

**Rules**

- Everything works with the keyboard, with visible focus.
- Status is never shown by colour alone.
