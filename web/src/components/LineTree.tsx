import { useEffect, useRef, useState } from 'react'
import { formatAge, vehicleFreshness } from '../domain/freshness'
import { LINES, type LineId } from '../domain/lines'
import { destinationLabel, stopLabel } from '../domain/stopLabel'
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
  // Before any data arrives, counts are unknown, not zero.
  const noData = status === 'loading' || status === 'error'
  const count = (n: number) => (noData ? '–' : n)

  return (
    <nav aria-label="Lines and trains" className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-fg-muted px-4 pt-3.5 pb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
        Trains · {count(total)} live
      </h2>

      <button
        type="button"
        aria-pressed={activeLine === null}
        onClick={() => setLine(null)}
        className={`mx-2.5 flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] ${
          activeLine === null ? 'bg-chip text-fg font-medium' : 'text-fg-secondary hover:bg-chip/60'
        }`}
      >
        <span>All lines</span>
        <span className="text-fg-muted font-mono text-xs">{count(total)}</span>
      </button>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {LINES.map((line) => {
          const onLine = vehicles.filter((v) => v.line === line.id)
          const isOpen = isExpanded(line.id)
          const isActive = activeLine === line.id
          const listId = `tree-${line.id}`
          return (
            <li key={line.id}>
              <div
                className={`flex items-center rounded-md ${isActive ? 'bg-chip' : 'hover:bg-chip/60'}`}
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
                  onClick={() => setLine(isActive ? null : line.id, selectedLine)}
                  title={isActive ? `Show all lines` : `Show only the ${line.name}`}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-[13px]"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: line.color }}
                  />
                  <span className={isActive ? 'text-fg font-semibold' : 'text-fg'}>
                    {line.name}
                  </span>
                  <StatusMark level={lineStatus?.[line.id].level ?? null} />
                  <span className="text-fg-muted ml-auto font-mono text-xs">
                    {count(onLine.length)}
                  </span>
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
                      color={line.color}
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
  color,
  now,
  selected,
  onSelect,
}: {
  vehicle: Vehicle
  color: string
  now: number
  selected: boolean
  onSelect: () => void
}) {
  const aging = vehicleFreshness(vehicle.updatedAt, now) === 'aging'
  const label = stopLabel(vehicle)
  const destination = destinationLabel(vehicle)
  const rowRef = useRef<HTMLButtonElement>(null)

  // When a train is picked on the map, bring its row into view in the list.
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <li>
      <button
        ref={rowRef}
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        aria-label={`${destination}, ${label}`}
        className={`my-px grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 rounded-md py-1.5 pr-2 pl-7 text-left ${
          selected ? 'bg-chip ring-select ring-[1.5px] ring-inset' : 'hover:bg-chip/60'
        }`}
      >
        <span
          aria-hidden="true"
          className="row-span-2 h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
        <span
          className={`truncate text-[12.5px] font-medium ${selected ? 'text-fg' : 'text-fg-secondary'}`}
        >
          <span aria-hidden="true" className="text-fg-muted font-normal">
            →{' '}
          </span>
          {destination}
        </span>
        <span
          className={`row-span-2 self-center font-mono text-[11px] ${aging ? 'text-warn' : 'text-fg-muted'}`}
          title={aging ? 'Not heard from in over 2 minutes' : 'Time since last report'}
        >
          {aging && <span aria-hidden="true">⧗ </span>}
          {formatAge(vehicle.updatedAt, now)}
          {aging && <span className="sr-only"> old, may be out of date</span>}
        </span>
        <span className="text-fg-muted truncate text-[11px]" title={label}>
          {label}
        </span>
      </button>
    </li>
  )
}
