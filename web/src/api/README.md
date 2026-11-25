# api/

The only place that talks to the MBTA V3 API (https://api-v3.mbta.com).

**Will contain**
- `mbta.ts`: every request the app makes, in one file.
  - Vehicles: `/vehicles?filter[route]=<in-scope routes>&include=trip,stop`. One request returns each vehicle with its trip (headsign, for direction) and stop (for the stop label).
  - Routes: `/routes?filter[type]=0,1`, once per visit (names, colours, direction names).
  - Shapes: `/shapes?filter[route]=...`, cached on the device for 24 h (Sprint 3 route lines).
- `mbtaTypes.ts`: the raw JSON:API response shapes, exactly as the API sends them.

**Rules**
- No API key in the browser. Requests are anonymous (DEC-021).
- The anonymous limit is 20 requests per minute per network address. On HTTP 429, report the `x-ratelimit-reset` time so the app waits instead of retrying (DEC-023).
- Turn failures into clear error types (network, rate limit, bad response) that the rest of the app can show.
- Raw API types stay inside `api/` and `domain/normalize`. Screens never see them.
