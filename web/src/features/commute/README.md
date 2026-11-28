# features/commute/

My Commute (Sprint 4, planning file 06): save the station you leave from and which way you go, then see your next trains and when to head out.

| File                | What it does                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CommuteView.tsx`   | The tab: saved commutes as pills, the open one's departures, and the edit, reverse and delete actions. With nothing saved it shows the form.                |
| `CommuteDetail.tsx` | One commute: when to leave, the next departures labelled LIVE or SCHEDULED, and where and when the data came from.                                          |
| `CommuteForm.tsx`   | Add or edit: station by name, then the lines that stop there, direction, optional destination, walk and buffer. Keeps saved values when lists fail to load. |
| `routeLabel.ts`     | "Red line" or "Green line · B branch", and the line colour for a route.                                                                                     |

**Rules**

- Saved on this device only, never sent anywhere (DEC-041).
- Only the commute on screen fetches departures; the timetable is asked only when there is no live train (DEC-042).
- No leave-time advice from stale data (DEC-043).
