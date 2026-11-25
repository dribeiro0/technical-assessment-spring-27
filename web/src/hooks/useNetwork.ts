import { useQuery } from '@tanstack/react-query'
import { LINE_ROUTE_GROUPS, fetchRoutePatterns, fetchStops } from '../api/mbta'
import { buildNetwork, type Network } from '../domain/network'

// Line paths and stations change only with service changes, so they are fetched
// once and kept on the device for 24 hours (DEC-023). That costs 5 requests per
// day per visitor instead of 5 per visit.
const STORAGE_KEY = 'enroute:network:v1'
const MAX_AGE_MS = 24 * 60 * 60_000

interface Saved {
  savedAt: number
  network: Network
}

function readSaved(): Network | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    if (Date.now() - saved.savedAt > MAX_AGE_MS || !Array.isArray(saved.network?.shapes))
      return null
    return saved.network
  } catch {
    // Storage can be blocked (private windows) or corrupted; just fetch again.
    return null
  }
}

function save(network: Network) {
  try {
    const value: Saved = { savedAt: Date.now(), network }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Not being able to save only means we fetch again next visit.
  }
}

async function loadNetwork(signal: AbortSignal): Promise<Network> {
  const saved = readSaved()
  if (saved) return saved

  const [patterns, ...stopDocs] = await Promise.all([
    fetchRoutePatterns(signal),
    ...LINE_ROUTE_GROUPS.map((group) => fetchStops(group.routeIds, signal)),
  ])
  const network = buildNetwork(
    patterns,
    LINE_ROUTE_GROUPS.map((group, i) => ({ line: group.line, doc: stopDocs[i] })),
  )
  save(network)
  return network
}

/** Route lines and stations for the map. Optional decoration: the map works without them. */
export function useNetwork() {
  return useQuery({
    queryKey: ['network'],
    queryFn: ({ signal }) => loadNetwork(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}
