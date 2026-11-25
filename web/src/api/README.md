# api/

The only place that talks to the MBTA V3 API (https://api-v3.mbta.com).

| File           | What it does                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `mbta.ts`      | Every request the app makes, the `MbtaError` type (network, rate limit, HTTP, bad response) and the shared rate-limit wait. |
| `mbtaTypes.ts` | The raw JSON:API response shapes. Every field is optional, because the feed is not always complete.                         |

**Requests**

| Request                                                                      | When                                        | Why                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/vehicles?filter[route]=…&include=trip,stop`                                | Every 15 s, plus manual refresh             | Positions, plus the trip (headsign, for direction) and stop (for the stop label) in one call |
| `/alerts?filter[route]=…&filter[datetime]=NOW`                               | Every 60 s                                  | Line status and alert text                                                                   |
| `/predictions?filter[trip]=…&include=stop`                                   | When a train is selected, then every 15 s   | The countdown and the strip of stops ahead on the train card                                 |
| `/predictions?filter[stop]=…&include=trip`                                   | When a station is selected, then every 15 s | The station card: next departures from every platform                                        |
| `/route_patterns?…&filter[canonical]=true&include=representative_trip.shape` | Once a day (device cache)                   | Line paths                                                                                   |
| `/stops?filter[route]=…` ×4                                                  | Once a day (device cache)                   | Station dots, asked per line so each stop's line is known                                    |

**Rules**

- No API key in the browser; requests are anonymous (DEC-021). The limit is 20 requests per minute per network address.
- After any HTTP 429, **every** request waits 60 s (DEC-036). The MBTA doesn't expose its `x-ratelimit-reset` header to browsers, so the exact reset time can't be read.
- Raw API types stay inside `api/` and `domain/`. Screens never see them.
- For testing only, a build can point at another address with `VITE_MBTA_BASE_URL`; production always uses the real API.
