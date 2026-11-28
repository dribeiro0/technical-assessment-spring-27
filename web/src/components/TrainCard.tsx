import { useState, type ReactNode } from 'react'
import { formatAgeLong, vehicleFreshness } from '../domain/freshness'
import { getLine } from '../domain/lines'
import {
  minutesAway,
  progressToNextStop,
  shortEta,
  stillAhead,
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
import { FloatingCard } from './FloatingCard'
import { ChevronIcon } from './Icons'
import { useSavedCommutes } from '../hooks/useSavedCommutes'
import { AlertCard } from './AlertCard'
import { CommuteCard } from './CommuteCard'
import { StationCard } from './StationCard'

/**
 * The card over the map. Shows, in order of priority:
 * - the open official alert (?alert=): its details, with the affected places lit on the map,
 * - the open saved commute (?commute=): when to leave and its next departures,
 * - the selected station's departures (?stop=),
 * - the selected train (?vehicle=): a countdown to its next stop and a strip of the stops
 *   ahead with the line filled in behind the train (DEC-032),
 * - with only a line filtered, that line's alerts if there are any.
 */
export function TrainCard() {
  const { vehicles, status, lineStatus, alerts: allAlerts } = useLiveData()
  const {
    vehicleId,
    stationId,
    commuteId,
    alertId,
    line,
    selectVehicle,
    selectStation,
    selectCommute,
    selectAlert,
  } = useViewParams()
  // Every hook runs before any early return: React needs the same hooks on every render.
  const { commutes } = useSavedCommutes()
  const alert = alertId ? allAlerts.find((a) => a.id === alertId) : undefined
  const commute = commuteId ? commutes.find((c) => c.id === commuteId) : undefined

  if (alert) {
    return <AlertCard key={alert.id} alert={alert} onClose={() => selectAlert(null)} />
  }
  if (commute) {
    return <CommuteCard key={commute.id} commute={commute} onClose={() => selectCommute(null)} />
  }
  const vehicle = vehicleId ? vehicles.find((v) => v.id === vehicleId) : undefined

  if (stationId) {
    return <StationCard key={stationId} stationId={stationId} onClose={() => selectStation(null)} />
  }

  if (vehicle)
    return <VehicleCard key={vehicle.id} vehicle={vehicle} onClose={() => selectVehicle(null)} />

  if (vehicleId && status !== 'loading') {
    return (
      <FloatingCard
        label="Selected train"
        onClose={() => selectVehicle(null)}
        closeLabel="Close train details"
      >
        <p className="text-fg-secondary px-4 pt-3 pb-4 text-sm leading-relaxed">
          This train is no longer reporting. It may have left service.
        </p>
      </FloatingCard>
    )
  }

  // No train picked, but a line is filtered: show that line's alerts if it has any.
  const alerts = line && lineStatus ? lineStatus[line].alerts : []
  if (line && alerts.length > 0) {
    const info = getLine(line)
    return (
      <FloatingCard label={`${info.name} alerts`} color={info.color}>
        <div className="px-4 pt-3 pb-4">
          <p className="mb-2 text-sm font-semibold">{info.name} alerts</p>
          <AlertList alerts={alerts} emptyText="" />
        </div>
      </FloatingCard>
    )
  }
  return null
}

function VehicleCard({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const now = useNow(1000)
  const { lineStatus } = useLiveData()
  const { selectStation } = useViewParams()
  const { data: predicted = [] } = useTripPredictions(vehicle.tripId)
  const upcoming = stillAhead(predicted, now)
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
    <FloatingCard
      label={`${line.name} train details`}
      color={line.color}
      onClose={onClose}
      closeLabel="Close train details"
    >
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
          onPickStation={selectStation}
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
    </FloatingCard>
  )
}

/**
 * The stops ahead, left to right, after a small cap that stands for "behind the train".
 * The line is filled from the cap to the train and grey beyond it.
 *
 * Laid out as a grid: a narrow column for the cap, then one equal column per stop. Each
 * stop's name and time sit in normal flow under its dot, so long names make the card
 * taller instead of overlapping what comes next. Each stop opens its station card.
 */
function TripStrip({
  stops,
  vehicle,
  atFirst,
  color,
  now,
  onPickStation,
}: {
  stops: UpcomingStop[]
  vehicle: Vehicle
  atFirst: boolean
  color: string
  now: number
  onPickStation: (stationId: string) => void
}) {
  const shown = stripStops(stops)
  const count = shown.length
  // Column widths in "fr" units: 0.5 for the cap, 1 per stop. Column centres, as a share
  // of the width: the cap at 0.25, stop i at (1 + i), all divided by the total.
  const total = 0.5 + count
  const at = (units: number) => `${(units / total) * 100}%`
  const capCentre = 0.25
  const firstCentre = 1
  const trainUnits = atFirst
    ? firstCentre
    : capCentre + progressToNextStop(vehicle.status) * (firstCentre - capCentre)

  return (
    <div className="px-3 pb-3">
      <div className="relative">
        {/* The track: grey from the cap to the last stop, filled in up to the train. */}
        <span
          aria-hidden="true"
          className="bg-border absolute top-[10px] h-[3px] rounded-full"
          style={{ left: at(capCentre), width: at(count - capCentre) }}
        />
        <span
          aria-hidden="true"
          className="absolute top-[10px] h-[3px] rounded-full"
          style={{ left: at(capCentre), width: at(trainUnits - capCentre), background: color }}
        />

        <ol
          aria-label="Stops ahead"
          className="relative grid"
          style={{ gridTemplateColumns: `0.5fr repeat(${count}, minmax(0, 1fr))` }}
        >
          <li aria-hidden="true" className="flex h-[23px] items-center justify-center">
            <span className="h-[11px] w-[11px] rounded-full" style={{ background: color }} />
          </li>
          {shown.map((stop, i) => {
            const isNext = i === (atFirst ? 1 : 0)
            const isLast = i === count - 1
            const eta = shortEta(stop.at, now)
            return (
              <li key={stop.id} className="flex min-w-0 flex-col items-center">
                <span className="relative grid h-[23px] w-full place-items-center">
                  {stop.afterGap && (
                    <span
                      aria-hidden="true"
                      className="text-fg-muted absolute -top-1 left-0 text-xs"
                    >
                      …
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={`border-[2.5px] bg-white ${isLast ? 'rounded-[3px]' : 'rounded-full'} ${
                      isNext
                        ? 'h-[16px] w-[16px] shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--color-select)]'
                        : 'h-[12px] w-[12px]'
                    }`}
                    style={{ borderColor: (i === 0 && atFirst) || isNext ? color : '#B9AE9A' }}
                  />
                </span>
                <button
                  type="button"
                  onClick={() => onPickStation(stop.stationId)}
                  title={`Next trains at ${stop.name}`}
                  aria-label={`${stop.name}${eta ? `, ${eta}` : ''}. Show next trains at this station`}
                  className="hover:bg-chip mt-1 w-full rounded-md px-0.5 py-0.5 text-center leading-tight"
                >
                  <span
                    className={`line-clamp-2 block text-[10px] break-words ${isNext ? 'text-fg font-bold' : 'text-fg-muted'}`}
                  >
                    {stop.name}
                  </span>
                  {eta && <span className="text-fg block font-mono text-[10.5px]">{eta}</span>}
                </button>
              </li>
            )
          })}
        </ol>

        {/* The train itself, sitting on the track. */}
        <span
          aria-hidden="true"
          className="absolute top-0 -ml-[11px] block"
          style={{ left: at(trainUnits) }}
        >
          <svg width="22" height="22" viewBox="-11 -11 22 22">
            <circle r="9" fill={color} stroke="#fff" strokeWidth="2" />
            <path d="M0,-5 L4.5,4.5 L0,2.2 L-4.5,4.5 Z" fill="#fff" transform="rotate(90)" />
          </svg>
        </span>
      </div>
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
