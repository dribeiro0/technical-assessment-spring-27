// The subway lines in scope (DEC-005). Mattapan is excluded until Sprint 9 (DEC-026).
export type LineId = 'Red' | 'Orange' | 'Blue' | 'Green'

export interface LineInfo {
  id: LineId
  /** Display name, e.g. "Red line". */
  name: string
  /** Marker and route colour on the cream map: official MBTA colours (Orange slightly darker). */
  color: string
  /** Colour of the arrow or square drawn inside a vehicle marker. */
  glyphColor: string
  /** MBTA route IDs that belong to this line. */
  routeIds: readonly string[]
}

// This order is used everywhere: sidebar tree, filter and chart bars.
export const LINES: readonly LineInfo[] = [
  { id: 'Red', name: 'Red line', color: '#DA291C', glyphColor: '#FFFFFF', routeIds: ['Red'] },
  {
    id: 'Orange',
    name: 'Orange line',
    color: '#C96F00',
    glyphColor: '#FFFFFF',
    routeIds: ['Orange'],
  },
  { id: 'Blue', name: 'Blue line', color: '#003DA5', glyphColor: '#FFFFFF', routeIds: ['Blue'] },
  {
    id: 'Green',
    name: 'Green line',
    color: '#00843D',
    glyphColor: '#FFFFFF',
    routeIds: ['Green-B', 'Green-C', 'Green-D', 'Green-E'],
  },
]

/** Every route ID the app requests from the API. */
export const IN_SCOPE_ROUTE_IDS: readonly string[] = LINES.flatMap((line) => line.routeIds)

const LINE_BY_ROUTE = new Map<string, LineId>(
  LINES.flatMap((line) => line.routeIds.map((routeId) => [routeId, line.id] as const)),
)

/** The line a route belongs to, or null when the route is out of scope (e.g. "Mattapan"). */
export function lineForRoute(routeId: string | null | undefined): LineId | null {
  if (!routeId) return null
  return LINE_BY_ROUTE.get(routeId) ?? null
}

/** The Green Line branch letter, e.g. "Green-C" -> "C". Null for every other route. */
export function branchForRoute(routeId: string): string | null {
  return routeId.startsWith('Green-') ? routeId.slice('Green-'.length) : null
}

/** Checks that a value (for example from the ?line= URL parameter) is a real line. */
export function isLineId(value: string | null | undefined): value is LineId {
  return LINES.some((line) => line.id === value)
}

export function getLine(id: LineId): LineInfo {
  const line = LINES.find((l) => l.id === id)
  if (!line) throw new Error(`Unknown line: ${id}`)
  return line
}
