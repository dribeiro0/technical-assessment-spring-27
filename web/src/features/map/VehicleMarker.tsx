import type L from 'leaflet'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { VEHICLE_POLL_MS } from '../../hooks/polling'
import { formatAgeLong } from '../../domain/freshness'
import { getLine } from '../../domain/lines'
import { destinationLabel, directionText, statusText, stopLabel } from '../../domain/stopLabel'
import type { Vehicle } from '../../domain/vehicle'
import { useNow } from '../../hooks/useNow'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { glideTo, stopGlide } from './glide'
import { vehicleIcon } from './vehicleIcon'

/** A jump longer than this (metres) is a data correction, not movement: snap instead of gliding. */
const MAX_GLIDE_METRES = 2500

interface Props {
  vehicle: Vehicle
  selected: boolean
  aging: boolean
  onSelect: (vehicle: Vehicle) => void
}

/**
 * One vehicle on the map. Clicking it (or pressing Enter when focused) selects it
 * and opens a popup with line, direction, status and next stop (R5).
 */
export const VehicleMarker = memo(function VehicleMarker({
  vehicle,
  selected,
  aging,
  onSelect,
}: Props) {
  const markerRef = useRef<L.Marker>(null)
  const reducedMotion = useReducedMotion()
  const line = getLine(vehicle.line)

  // Leaflet is given the first position only; later positions are applied by the glide
  // below, so React never makes the marker jump.
  const [initialPosition] = useState<[number, number]>(() => [vehicle.lat, vehicle.lon])

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const to: [number, number] = [vehicle.lat, vehicle.lon]
    const distance = marker.getLatLng().distanceTo(to)
    if (distance < 1) return
    if (reducedMotion || document.hidden || distance > MAX_GLIDE_METRES) {
      stopGlide(marker)
      marker.setLatLng(to)
    } else {
      glideTo(marker, to, VEHICLE_POLL_MS)
    }
  }, [vehicle.lat, vehicle.lon, reducedMotion])

  // Stop animating a marker once it leaves the map.
  useEffect(() => {
    const marker = markerRef.current
    return () => stopGlide(marker)
  }, [])

  // Rebuild the icon only when something visible about it changes.
  const bearing = vehicle.bearing === null ? null : Math.round(vehicle.bearing)
  const icon = useMemo(
    () => vehicleIcon(vehicle, { selected, aging }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicle.line, vehicle.headsign, vehicle.branch, vehicle.status, bearing, selected, aging],
  )

  // When selected from the list, open this vehicle's popup (which also pans the map to it).
  useEffect(() => {
    if (selected) markerRef.current?.openPopup()
  }, [selected])

  return (
    <Marker
      ref={markerRef}
      position={initialPosition}
      icon={icon}
      title={`${line.name} to ${destinationLabel(vehicle)}: ${stopLabel(vehicle)}`}
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
    <div className="min-w-52">
      <p className="text-fg-muted flex items-center gap-2 text-xs">
        <span aria-hidden="true" className="h-2.5 w-2.5" style={{ background: line.color }} />
        {line.name}
        {vehicle.branch && ` · ${vehicle.branch} branch`}
      </p>
      <p className="text-fg mt-0.5 text-sm font-semibold">
        {vehicle.headsign ? `To ${vehicle.headsign}` : 'Destination unknown'}
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
