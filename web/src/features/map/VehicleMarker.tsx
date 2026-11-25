import type L from 'leaflet'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { formatAgeLong } from '../../domain/freshness'
import { getLine } from '../../domain/lines'
import { directionText, statusText, stopLabel } from '../../domain/stopLabel'
import type { Vehicle } from '../../domain/vehicle'
import { useNow } from '../../hooks/useNow'
import { vehicleIcon } from './vehicleIcon'

interface Props {
  vehicle: Vehicle
  selected: boolean
  aging: boolean
  onSelect: (vehicle: Vehicle) => void
}

/**
 * One vehicle on the map. Clicking it (or pressing Enter when focused) selects it
 * and opens a popup with route, direction, status and stop (R5).
 */
export const VehicleMarker = memo(function VehicleMarker({
  vehicle,
  selected,
  aging,
  onSelect,
}: Props) {
  const markerRef = useRef<L.Marker>(null)
  const line = getLine(vehicle.line)

  // Rebuild the icon only when something visible about it changes.
  const bearing = vehicle.bearing === null ? null : Math.round(vehicle.bearing)
  const icon = useMemo(
    () => vehicleIcon(vehicle, { selected, aging }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicle.line, vehicle.label, vehicle.status, bearing, selected, aging],
  )

  // When selected from the list, open this vehicle's popup (which also pans the map to it).
  useEffect(() => {
    if (selected) markerRef.current?.openPopup()
  }, [selected])

  return (
    <Marker
      ref={markerRef}
      position={[vehicle.lat, vehicle.lon]}
      icon={icon}
      title={`${line.name} ${vehicle.label}: ${stopLabel(vehicle)}`}
      zIndexOffset={selected ? 1000 : aging ? -100 : 0}
      riseOnHover
      eventHandlers={{ click: () => onSelect(vehicle) }}
    >
      <Popup className="vehicle-popup" closeButton>
        <VehiclePopup vehicle={vehicle} />
      </Popup>
    </Marker>
  )
})

function VehiclePopup({ vehicle }: { vehicle: Vehicle }) {
  const now = useNow(1000)
  const line = getLine(vehicle.line)
  return (
    <div className="min-w-48">
      <p className="flex items-center gap-2 font-medium">
        <span aria-hidden="true" className="h-2.5 w-2.5" style={{ background: line.color }} />
        <span>
          {line.name}
          {vehicle.branch && ` · ${vehicle.branch} branch`}
        </span>
        <span className="text-fg-muted ml-auto font-mono text-xs">{vehicle.label}</span>
      </p>
      <dl className="mt-1.5 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-fg-muted">Direction</dt>
        <dd>{directionText(vehicle.headsign)}</dd>
        <dt className="text-fg-muted">Status</dt>
        <dd>{statusText(vehicle.status)}</dd>
        <dt className="text-fg-muted">Next stop</dt>
        <dd className="text-accent">{stopLabel(vehicle)}</dd>
      </dl>
      <p className="text-fg-muted mt-1.5 font-mono text-[11px]">
        updated {formatAgeLong(vehicle.updatedAt, now)}
      </p>
    </div>
  )
}
