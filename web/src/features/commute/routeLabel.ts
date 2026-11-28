import { branchForRoute, getLine, lineForRoute } from '../../domain/lines'

/** "Red line", or "Green line · B branch" for a Green Line route. */
export function routeLabel(routeId: string): string {
  const line = lineForRoute(routeId)
  if (!line) return routeId
  const branch = branchForRoute(routeId)
  return branch ? `${getLine(line).name} · ${branch} branch` : getLine(line).name
}

/** The line colour for a route, for the strip and chips. */
export function routeColor(routeId: string): string | undefined {
  const line = lineForRoute(routeId)
  return line ? getLine(line).color : undefined
}
