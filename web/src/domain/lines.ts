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
    color: '#BF6900',
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

/**
 * Where each direction of a route goes: index 0 is direction_id 0, index 1 is direction_id 1.
 * Copied from /routes (direction_destinations) on November 28, 2026. They change only when a
 * terminus changes, so they are kept here instead of spending a request on them.
 */
export const DIRECTION_DESTINATIONS: Readonly<Record<string, readonly [string, string]>> = {
  Red: ['Ashmont/Braintree', 'Alewife'],
  Orange: ['Forest Hills', 'Oak Grove'],
  Blue: ['Bowdoin', 'Wonderland'],
  'Green-B': ['Boston College', 'Government Center'],
  'Green-C': ['Cleveland Circle', 'Government Center'],
  'Green-D': ['Riverside', 'Union Square'],
  'Green-E': ['Heath Street', 'Medford/Tufts'],
}

/** "Alewife" for Red direction 1. Falls back to a neutral label for an unknown route. */
export function directionDestination(routeId: string, directionId: 0 | 1): string {
  return DIRECTION_DESTINATIONS[routeId]?.[directionId] ?? `Direction ${directionId}`
}

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
