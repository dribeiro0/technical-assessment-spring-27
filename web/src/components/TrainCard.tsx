import { useState, type ReactNode } from 'react'
import { formatAgeLong, vehicleFreshness } from '../domain/freshness'
import { getLine } from '../domain/lines'
import {
  minutesAway,
  progressToNextStop,
  shortEta,
  stripStops,
  type UpcomingStop,
} from '../domain/predictions'
import { directionText, statusText, stopLabel } from '../domain/stopLabel'
import type { Vehicle } from '../domain/vehicle'
import { useLiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'
import { useTripPredictions } from '../hooks/useTripPredictions'
import { useViewParams } from '../hooks/useViewParams'
import { AlertList } from './AlertList'
import { ChevronIcon, CloseIcon } from './Icons'

/**
 * The floating card for the selected train (design CS1-a): a countdown to the next stop,
 * then a strip of the stops ahead with the line filled in behind the train.
 * Floats over the map's top-right corner on desktop and becomes a bottom sheet on phones.
 * With no train selected it shows the filtered line's alerts, if there are any.
 */
export function TrainCard() {
  const { vehicles, status, lineStatus } = useLiveData()
  const { vehicleId, line, selectVehicle } = useViewParams()
  const vehicle = vehicleId ? vehicles.find((v) => v.id === vehicleId) : undefined

  if (vehicle)
    return <VehicleCard key={vehicle.id} vehicle={vehicle} onClose={() => selectVehicle(null)} />

  if (vehicleId && status !== 'loading') {
    return (
      <Shell label="Selected train" onClose={() => selectVehicle(null)}>
        <p className="text-fg-secondary px-4 pt-3 pb-4 text-sm leading-relaxed">
          This train is no longer reporting. It may have left service.
        </p>
      </Shell>
    )
  }

  // No train picked, but a line is filtered: show that line's alerts if it has any.
  const alerts = line && lineStatus ? lineStatus[line].alerts : []
  if (line && alerts.length > 0) {
    const info = getLine(line)
    return (
      <Shell label={`${info.name} alerts`} color={info.color}>
        <div className="px-4 pt-3 pb-4">
          <p className="mb-2 text-sm font-semibold">{info.name} alerts</p>
          <AlertList alerts={alerts} emptyText="" />
        </div>
      </Shell>
    )
  }
  return null
}

function Shell({
  label,
  color,
  onClose,
  children,
}: {
  label: string
  color?: string
  onClose?: () => void
  children: ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="card-in bg-card text-fg absolute inset-x-0 bottom-0 z-[1100] flex max-h-[60%] flex-col overflow-hidden rounded-t-2xl shadow-[var(--shadow-float)] lg:inset-auto lg:top-4 lg:right-4 lg:max-h-[calc(100%-2rem)] lg:w-[400px] lg:rounded-xl"
    >
      <div
        aria-hidden="true"
        className="h-[5px] shrink-0"
        style={{ background: color ?? 'var(--color-select)' }}
      />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close train details"
          className="text-fg-muted hover:text-fg hover:bg-chip absolute top-3 right-3 grid h-7 w-7 place-items-center rounded-md"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="min-h-0 overflow-y-auto">{children}</div>
    </section>
  )
}

function VehicleCard({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const now = useNow(1000)
  const { lineStatus } = useLiveData()
  const { data: upcoming = [] } = useTripPredictions(vehicle.tripId)
  const [expanded, setExpanded] = useState(false)
  const line = getLine(vehicle.line)
  const aging = vehicleFreshness(vehicle.updatedAt, now) === 'aging'
  const lineAlerts = lineStatus?.[vehicle.line].alerts ?? []

  // When the train is standing at its first predicted stop, count down to the one after.
  const atFirst = vehicle.status === 'stopped' && upcoming[0]?.name === vehicle.stopName
  const target = (atFirst ? upcoming[1] : upcoming[0]) ?? null
  const countdown = target?.at != null ? minutesAway(target.at, now) : null
  const chipText = `${line.name}${vehicle.branch ? ` · ${vehicle.branch}` : ''} · ${vehicle.headsign ? `To ${vehicle.headsign}` : 'Destination unknown'}`

  return (
    <Shell label={`${line.name} train details`} color={line.color} onClose={onClose}>
      <div className="px-4 pt-3 pr-12">
        <span className="bg-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-[2px]"
            style={{ background: line.color }}
          />
          {chipText}
        </span>
      </div>

      {countdown && target ? (
        <div className="flex items-center gap-3.5 px-4 pt-2 pb-2.5">
          <p className="text-accent leading-none font-bold tracking-tight" aria-hidden="true">
            <span className="text-[44px]">{countdown.value}</span>
            {countdown.unit && (
              <span className="ml-1 text-[15px] font-semibold">{countdown.unit}</span>
            )}
          </p>
          <div className="min-w-0">
            <p className="text-base">
              to <b>{target.name}</b>
            </p>
            <p className="text-fg-muted text-xs">{statusText(vehicle.status)}</p>
          </div>
          <span className="sr-only">
            {countdown.unit ? `${countdown.value} minutes` : 'Arriving now'} to {target.name}
          </span>
        </div>
      ) : (
        // No estimates from the MBTA: fall back to where the train is.
        <div className="px-4 pt-2 pb-2.5">
          <p className="text-xl font-bold tracking-tight">
            {vehicle.headsign ? `To ${vehicle.headsign}` : 'Destination unknown'}
          </p>
          <p className="text-accent text-sm font-semibold">{stopLabel(vehicle)}</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <TripStrip
          stops={upcoming}
          vehicle={vehicle}
          atFirst={atFirst}
          color={line.color}
          now={now}
        />
      )}

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        <Fact>{stopLabel(vehicle)}</Fact>
        <Fact mono warn={aging}>
          {aging && <span aria-hidden="true">⧗ </span>}
          {formatAgeLong(vehicle.updatedAt, now)}
        </Fact>
        <Fact>
          {lineAlerts.length
            ? `${lineAlerts.length} line alert${lineAlerts.length > 1 ? 's' : ''}`
            : 'No alerts'}
        </Fact>
      </div>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="border-border bg-main hover:bg-chip/60 flex w-full items-center justify-between border-t px-4 py-2.5 text-xs font-semibold"
      >
        {expanded ? 'Fewer details' : 'More details'}
        <ChevronIcon
          className={`h-3 w-3 transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`}
        />
      </button>

      {expanded && (
        <div className="border-border border-t">
          <dl className="text-xs">
            <Row label="Line">
              {line.name}
              {vehicle.branch && ` · ${vehicle.branch} branch`}
            </Row>
            <Row label="Direction">{directionText(vehicle.headsign)}</Row>
            <Row label="Status">{statusText(vehicle.status)}</Row>
            <Row label="Stop">{stopLabel(vehicle)}</Row>
            <Row label="Car no.">
              <span className="font-mono">{vehicle.label}</span>
            </Row>
            <Row label="Vehicle ID">
              <span className="font-mono">{vehicle.id}</span>
            </Row>
          </dl>
          <div className="bg-main px-4 py-3">
            <p className="text-fg-muted mb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
              {line.name} alerts
            </p>
            <AlertList
              alerts={lineAlerts}
              unavailable={lineStatus === null}
              emptyText="No active alerts on this line."
            />
          </div>
        </div>
      )}
    </Shell>
  )
}

/**
 * The stops ahead, left to right, after a small cap that stands for "behind the train".
 * The line is filled from the cap to the train and grey beyond it.
 */
function TripStrip({
  stops,
  vehicle,
  atFirst,
  color,
  now,
}: {
  stops: UpcomingStop[]
  vehicle: Vehicle
  atFirst: boolean
  color: string
  now: number
}) {
  const shown = stripStops(stops)
  const points = shown.length + 1 // the cap plus each shown stop
  const step = 100 / (points - 1)
  // The train sits between the cap and the first stop, or on the first stop when stopped there.
  const trainAt = step * (atFirst ? 1 : progressToNextStop(vehicle.status))

  return (
    <div className="px-6 pb-3">
      <ol aria-label="Stops ahead" className="relative flex justify-between pt-1">
        <span
          aria-hidden="true"
          className="bg-border absolute inset-x-0 top-[9px] h-[3px] rounded-full"
        />
        <span
          aria-hidden="true"
          className="absolute left-0 top-[9px] h-[3px] rounded-full"
          style={{ width: `${trainAt}%`, background: color }}
        />
        <li aria-hidden="true" className="relative w-0">
          <span
            className="absolute top-[5px] -left-[5px] h-[11px] w-[11px] rounded-full"
            style={{ background: color }}
          />
        </li>
        {shown.map((stop, i) => {
          const isNext = i === (atFirst ? 1 : 0)
          const eta = shortEta(stop.at, now)
          return (
            <li key={stop.id} className="relative w-0">
              {stop.afterGap && (
                <span
                  aria-hidden="true"
                  className="text-fg-muted absolute -top-1 -left-[calc(50%+18px)] text-xs"
                >
                  …
                </span>
              )}
              <span
                aria-hidden="true"
                className={`absolute rounded-full border-[2.5px] bg-white ${
                  isNext
                    ? 'top-[2px] -left-[8px] h-[16px] w-[16px] shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--color-select)]'
                    : 'top-[4px] -left-[6px] h-[12px] w-[12px]'
                } ${i === shown.length - 1 ? 'rounded-[3px]' : ''}`}
                style={{ borderColor: i === 0 && atFirst ? color : isNext ? color : '#B9AE9A' }}
              />
              <span className="absolute top-[22px] left-1/2 w-16 -translate-x-1/2 text-center leading-tight">
                <span
                  className={`line-clamp-2 block text-[10px] ${isNext ? 'text-fg font-bold' : 'text-fg-muted'}`}
                >
                  {stop.name}
                </span>
                {eta && <span className="text-fg block font-mono text-[10.5px]">{eta}</span>}
              </span>
            </li>
          )
        })}
        <li aria-hidden="true" className="absolute top-[0px]" style={{ left: `${trainAt}%` }}>
          <span className="-ml-[11px] block">
            <svg width="22" height="22" viewBox="-11 -11 22 22">
              <circle r="9" fill={color} stroke="#fff" strokeWidth="2" />
              <path d="M0,-5 L4.5,4.5 L0,2.2 L-4.5,4.5 Z" fill="#fff" transform="rotate(90)" />
            </svg>
          </span>
        </li>
      </ol>
      {/* Room for the labels, which are absolutely positioned under the strip. */}
      <div aria-hidden="true" className="h-12" />
      <p className="sr-only">
        Next stops:{' '}
        {shown.map((s) => `${s.name}${s.at ? ` in ${shortEta(s.at, now)}` : ''}`).join(', ')}.
      </p>
    </div>
  )
}

function Fact({ children, mono, warn }: { children: ReactNode; mono?: boolean; warn?: boolean }) {
  return (
    <span
      className={`bg-chip rounded-full px-2 py-0.5 text-[11.5px] ${mono ? 'font-mono' : ''} ${warn ? 'text-warn' : 'text-fg-secondary'}`}
    >
      {children}
    </span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border grid grid-cols-[6rem_1fr] gap-2 border-b px-4 py-2">
      <dt className="text-fg-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
