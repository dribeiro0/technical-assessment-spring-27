import { LINES, type LineId } from './lines'
import type { Vehicle } from './vehicle'

export interface LineCount {
  line: LineId
  name: string
  color: string
  count: number
  /** Per-branch counts for the Green Line, e.g. { B: 13, C: 10 }. Empty for other lines. */
  branches: Record<string, number>
}

/**
 * Active vehicles per line for the Analytics chart (R8).
 * Every in-scope line appears, even with zero vehicles, in LINES order.
 * The Green branches are combined into one Green entry (DEC-019).
 * Callers pass the full vehicle list; the map's line filter does not apply here.
 */
export function countByLine(vehicles: readonly Vehicle[]): LineCount[] {
  return LINES.map((line) => {
    const onLine = vehicles.filter((v) => v.line === line.id)
    const branches: Record<string, number> = {}
    for (const v of onLine) {
      if (v.branch) branches[v.branch] = (branches[v.branch] ?? 0) + 1
    }
    return { line: line.id, name: line.name, color: line.color, count: onLine.length, branches }
  })
}
