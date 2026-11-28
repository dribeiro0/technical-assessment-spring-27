import { useQuery } from '@tanstack/react-query'
import { fetchRoutesAtStation, fetchStops } from '../api/mbta'
import { IN_SCOPE_ROUTE_IDS } from '../domain/lines'
import { retryUnlessRateLimited } from './polling'

// Choices for the commute form. Each is asked once per station or route while the form
// is open and then kept for the visit: which routes serve a station rarely changes.

/** In-scope routes stopping at a station, in the app's usual line order. */
export function useRoutesAtStation(stationId: string | null) {
  return useQuery({
    queryKey: ['routes-at', stationId],
    queryFn: async ({ signal }) => {
      const doc = await fetchRoutesAtStation(stationId as string, signal)
      const served = new Set((doc.data ?? []).map((r) => r.id))
      return IN_SCOPE_ROUTE_IDS.filter((id) => served.has(id))
    },
    enabled: stationId !== null,
    staleTime: Infinity,
    retry: retryUnlessRateLimited,
  })
}

/** Stations on one route (for the optional destination), A to Z. */
export function useStationsOnRoute(routeId: string | null) {
  return useQuery({
    queryKey: ['stations-on', routeId],
    queryFn: async ({ signal }) => {
      const doc = await fetchStops([routeId as string], signal)
      return (doc.data ?? [])
        .map((s) => ({ id: s.id, name: s.attributes?.name ?? '' }))
        .filter((s) => s.name)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    enabled: routeId !== null,
    staleTime: Infinity,
    retry: retryUnlessRateLimited,
  })
}
