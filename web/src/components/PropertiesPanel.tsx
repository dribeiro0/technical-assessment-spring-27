import type { ReactNode } from 'react'
import { formatAgeLong, vehicleFreshness } from '../domain/freshness'
import { getLine, LINES } from '../domain/lines'
import { directionText, statusText, stopLabel } from '../domain/stopLabel'
import type { Vehicle } from '../domain/vehicle'
import { useLiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'
import { useViewParams } from '../hooks/useViewParams'
import { AlertList } from './AlertList'
import { CloseIcon } from './Icons'
import { StatusMark } from './StatusMark'

/**
 * Right-hand panel: details of the selected vehicle, or network status when
 * nothing is selected. On phones the same content appears in a bottom sheet.
 */
export function PropertiesPanel({ onClose }: { onClose?: () => void }) {
  const { vehicles, status } = useLiveData()
  const { vehicleId, selectVehicle } = useViewParams()
  const vehicle = vehicleId ? vehicles.find((v) => v.id === vehicleId) : undefined

  return (
    <section aria-label="Properties" className="flex min-h-0 flex-1 flex-col">
      <header className="border-border flex h-9 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-fg text-xs font-semibold">Properties</h2>
        {(onClose || vehicleId) && (
          <button
            type="button"
            onClick={() => {
              selectVehicle(null)
              onClose?.()
            }}
            aria-label={vehicleId ? 'Clear selected vehicle' : 'Close panel'}
            className="text-fg-muted hover:text-fg -mr-1 grid h-7 w-7 place-items-center"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {vehicle ? (
          <VehicleDetails vehicle={vehicle} />
        ) : vehicleId && status !== 'loading' ? (
          <p className="text-fg-secondary p-4 text-xs leading-relaxed">
            Vehicle <span className="font-mono">{vehicleId}</span> is no longer reporting. It may
            have left service.
          </p>
        ) : (
          <NetworkSummary />
        )}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border grid grid-cols-[6.5rem_1fr] gap-2 border-b px-4 py-2.5 text-xs">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  )
}

function VehicleDetails({ vehicle }: { vehicle: Vehicle }) {
  const now = useNow(1000)
  const { lineStatus } = useLiveData()
  const line = getLine(vehicle.line)
  const aging = vehicleFreshness(vehicle.updatedAt, now) === 'aging'
  const lineAlerts = lineStatus?.[vehicle.line].alerts ?? []

  return (
    <>
      <div className="border-border border-b px-4 py-4">
        <p className="text-fg-muted flex items-center gap-2 text-xs">
          <span aria-hidden="true" className="h-2.5 w-2.5" style={{ background: line.color }} />
          {line.name}
          {vehicle.branch && ` · ${vehicle.branch} branch`}
        </p>
        <p className="text-fg mt-1 text-base font-semibold">
          {vehicle.headsign ? `To ${vehicle.headsign}` : 'Destination unknown'}
        </p>
        <p className="text-accent mt-0.5 text-sm">{stopLabel(vehicle)}</p>
      </div>
      <dl>
        <Row label="line">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5" style={{ background: line.color }} />
            {line.name}
            {vehicle.branch && <span className="text-fg-muted">· {vehicle.branch} branch</span>}
          </span>
        </Row>
        <Row label="direction">{directionText(vehicle.headsign)}</Row>
        <Row label="status">{statusText(vehicle.status)}</Row>
        <Row label="stop">{stopLabel(vehicle)}</Row>
        <Row label="updated">
          <span className={`font-mono ${aging ? 'text-accent' : ''}`}>
            {formatAgeLong(vehicle.updatedAt, now)}
          </span>
          {aging && <span className="text-fg-muted block">Not heard from in over 2 minutes</span>}
        </Row>
        {/* Car and vehicle numbers are for enthusiasts; riders go by destination. */}
        <Row label="car no.">
          <span className="text-fg-secondary font-mono">{vehicle.label}</span>
        </Row>
        <Row label="vehicle ID">
          <span className="text-fg-secondary font-mono">{vehicle.id}</span>
        </Row>
      </dl>
      <div className="px-4 py-4">
        <h3 className="text-fg-muted mb-2 text-[11px] font-medium tracking-wider uppercase">
          {line.name} alerts
        </h3>
        <AlertList
          alerts={lineAlerts}
          unavailable={lineStatus === null}
          emptyText="No active alerts on this line."
        />
      </div>
    </>
  )
}

function NetworkSummary() {
  const { lineStatus, alerts } = useLiveData()
  const { line } = useViewParams()
  const shown = line ? alerts.filter((a) => a.lines.includes(line)) : alerts

  return (
    <>
      <p className="text-fg-secondary border-border border-b px-4 py-3 text-xs leading-relaxed">
        Select a train on the map or in the list to see where it is and where it's headed.
      </p>
      <dl>
        {LINES.map((l) => (
          <Row key={l.id} label={l.name}>
            <StatusMark level={lineStatus?.[l.id].level ?? null} withText />
          </Row>
        ))}
      </dl>
      <div className="px-4 py-4">
        <h3 className="text-fg-muted mb-2 text-[11px] font-medium tracking-wider uppercase">
          {line ? `${getLine(line).name} alerts` : 'Service alerts'}
        </h3>
        <AlertList
          alerts={shown}
          unavailable={lineStatus === null}
          emptyText="No active service alerts."
        />
      </div>
    </>
  )
}
