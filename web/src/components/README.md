# components/

Shared pieces used by more than one view.

| File                   | What it does                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LineStatusBadges.tsx` | Four badges with each line's status from official alerts. Each badge is also a filter button (R6).                                                                                                                                                                                                                                                      |
| `LineTree.tsx`         | The train list. Clicking a line filters the map; the caret expands it into its trains, named by destination, with stop and age. The selected train scrolls into view. It doubles as the non-map vehicle list (09).                                                                                                                                      |
| `TrainCard.tsx`        | The selected train's floating card: a countdown to the next stop and a strip of the stops ahead, filled up to the train (DEC-032), then fact chips and "More details" with the full rows and line alerts. Falls back to stop text without predictions. With a line filtered and no train picked, it shows that line's alerts. A bottom sheet on phones. |
| `FeedNotices.tsx`      | The error panel with Retry for a failed first load, the loading notice, and the banner explaining stale, failed, rate-limited or paused data.                                                                                                                                                                                                           |
| `AlertList.tsx`        | Official MBTA alerts, most severe first, with a coloured bar by severity.                                                                                                                                                                                                                                                                               |
| `StatusMark.tsx`       | Line status as a symbol plus text: ○ good service, ▲ minor issues, ■ major disruption.                                                                                                                                                                                                                                                                  |
| `Icons.tsx`            | Small inline icons.                                                                                                                                                                                                                                                                                                                                     |

**Rules**

- Everything works with the keyboard, with visible focus.
- Status is never shown by colour alone.
