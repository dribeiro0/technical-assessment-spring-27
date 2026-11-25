import { useState } from 'react'
import { formatAge, vehicleFreshness } from '../domain/freshness'
import { LINES, type LineId } from '../domain/lines'
import { stopLabel } from '../domain/stopLabel'
import type { Vehicle } from '../domain/vehicle'
import { useLiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'
import { useViewParams } from '../hooks/useViewParams'
import { ChevronIcon } from './Icons'
import { StatusMark } from './StatusMark'

interface Props {
  /** Called after a vehicle is chosen, e.g. to close the phone drawer. */
  onVehicleChosen?: () => void
}

/**
 * The sidebar tree. Clicking a line filters the map (R6); the caret expands it
 * into its vehicles. It also serves as the non-map list of every vehicle (09).
 */
export function LineTree({ onVehicleChosen }: Props) {
  const { vehicles, lineStatus, status } = useLiveData()
  const { line: activeLine, vehicleId, setLine, selectVehicle } = useViewParams()
  const now = useNow(1000)
  // The filtered line and the selected vehicle's line open automatically;
  // anything the rider opens or closes by hand overrides that.
  const [overrides, setOverrides] = useState<Partial<Record<LineId, boolean>>>({})
  const selectedLine = vehicles.find((v) => v.id === vehicleId)?.line ?? null
  const isExpanded = (id: LineId) => overrides[id] ?? (id === activeLine || id === selectedLine)
  const toggle = (id: LineId) => setOverrides((prev) => ({ ...prev, [id]: !isExpanded(id) }))

  const total = vehicles.length

  return (
    <nav aria-label="Lines and vehicles" className="flex min-h-0 flex-1 flex-col">
      <p className="text-fg-muted px-4 pt-3 pb-2 text-[11px] font-medium tracking-wider uppercase">
        Subway · {status === 'loading' || status === 'error' ? '–' : total} vehicles
      </p>

      <button
        type="button"
        aria-pressed={activeLine === null}
        onClick={() => setLine(null)}
        className={`mx-2 flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-[13px] ${
          activeLine === null ? 'bg-main text-fg' : 'text-fg-secondary hover:bg-main/60'
        }`}
      >
        <span>All lines</span>
        <span className="text-fg-muted font-mono text-xs">{total}</span>
      </button>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {LINES.map((line) => {
          const onLine = vehicles.filter((v) => v.line === line.id)
          const isOpen = isExpanded(line.id)
          const isActive = activeLine === line.id
          const listId = `tree-${line.id}`
          return (
            <li key={line.id}>
              <div
                className={`flex items-center rounded-sm ${isActive ? 'bg-main' : 'hover:bg-main/60'}`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${line.name}`}
                  onClick={() => toggle(line.id)}
                  className="text-fg-muted hover:text-fg grid h-8 w-6 shrink-0 place-items-center"
                >
                  <ChevronIcon
                    className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setLine(isActive ? null : line.id)}
                  title={isActive ? `Show all lines` : `Show only the ${line.name}`}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-[13px]"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0"
                    style={{ background: line.color }}
                  />
                  <span className={isActive ? 'text-fg font-medium' : 'text-fg'}>{line.name}</span>
                  <StatusMark level={lineStatus?.[line.id].level ?? null} />
                  <span className="text-fg-muted ml-auto font-mono text-xs">{onLine.length}</span>
                </button>
              </div>

              {isOpen && (
                <ul id={listId} className="mb-1">
                  {onLine.length === 0 && (
                    <li className="text-fg-muted py-1 pl-9 text-xs">No trains reporting</li>
                  )}
                  {onLine.map((v) => (
                    <VehicleRow
                      key={v.id}
                      vehicle={v}
                      now={now}
                      selected={v.id === vehicleId}
                      onSelect={() => {
                        selectVehicle(v.id, v.line)
                        onVehicleChosen?.()
                      }}
                    />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function VehicleRow({
  vehicle,
  now,
  selected,
  onSelect,
}: {
  vehicle: Vehicle
  now: number
  selected: boolean
  onSelect: () => void
}) {
  const aging = vehicleFreshness(vehicle.updatedAt, now) === 'aging'
  const label = stopLabel(vehicle)
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={`grid w-full grid-cols-[auto_1fr_auto] items-baseline gap-x-2 rounded-sm py-1 pr-2 pl-9 text-left ${
          selected ? 'bg-main ring-accent ring-1 ring-inset' : 'hover:bg-main/60'
        }`}
      >
        <span className={`font-mono text-xs ${selected ? 'text-fg' : 'text-fg-secondary'}`}>
          {vehicle.label}
          {vehicle.branch && <span className="text-fg-muted"> · {vehicle.branch}</span>}
        </span>
        <span className="text-fg-muted truncate text-xs" title={label}>
          {label}
        </span>
        <span
          className={`font-mono text-[11px] ${aging ? 'text-accent' : 'text-fg-muted'}`}
          title={aging ? 'Not heard from in over 2 minutes' : 'Time since last report'}
        >
          {aging && <span aria-hidden="true">⧗ </span>}
          {formatAge(vehicle.updatedAt, now)}
          {aging && <span className="sr-only"> old, may be out of date</span>}
        </span>
      </button>
    </li>
  )
}
