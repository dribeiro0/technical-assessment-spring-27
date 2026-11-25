import { useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { ErrorPanel, LoadingNotice, StaleBanner } from '../../components/FeedNotices'
import { vehicleFreshness } from '../../domain/freshness'
import { getLine } from '../../domain/lines'
import type { Vehicle } from '../../domain/vehicle'
import { useLiveData } from '../../hooks/liveData'
import { useNow } from '../../hooks/useNow'
import { useViewParams } from '../../hooks/useViewParams'
import { RouteLayer } from './RouteLayer'
import { VehicleMarker } from './VehicleMarker'

/** Downtown Boston, between Park Street and Downtown Crossing. */
const BOSTON_CENTER: [number, number] = [42.3555, -71.0605]
/** Car-number tags show from this zoom level up (and always on hover or selection). */
const TAG_ZOOM = 14

// Esri's dark gray basemap without labels, so our own stations and tags stay readable.
// It needs no API key. (CARTO's dark tiles, the first choice, began requiring one.)
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const TILE_MAX_NATIVE_ZOOM = 16
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Data: <a href="https://www.mbta.com/developers">MBTA</a>'

/** Live Map view (R4): the interactive map with live vehicle markers. */
export function LiveMapView() {
  const { vehicles, status } = useLiveData()
  const { line, vehicleId, selectVehicle } = useViewParams()
  const now = useNow(5000)

  const shown = line ? vehicles.filter((v) => v.line === line) : vehicles
  const onSelect = useCallback((v: Vehicle) => selectVehicle(v.id, v.line), [selectVehicle])
  const hasData = status !== 'loading' && status !== 'error'

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={BOSTON_CENTER}
        zoom={12}
        minZoom={10}
        maxZoom={18}
        zoomControl={false}
        className="h-full w-full"
        aria-label="Live map of MBTA subway vehicles"
      >
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          maxZoom={18}
        />
        <ZoomControl position="bottomright" />
        <TagVisibility />
        <ClearSelectionOnMapClick onClear={() => vehicleId && selectVehicle(null)} />
        <RouteLayer activeLine={line} />
        {shown.map((v) => (
          <VehicleMarker
            key={v.id}
            vehicle={v}
            selected={v.id === vehicleId}
            aging={vehicleFreshness(v.updatedAt, now) === 'aging'}
            onSelect={onSelect}
          />
        ))}
      </MapContainer>

      <LoadingNotice />
      <StaleBanner />
      <ErrorPanel />

      {/* An empty filter result is not a failure (DEC-019), so it gets its own message. */}
      {hasData && line && shown.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-[1000] flex justify-center px-3">
          <p
            role="status"
            className="bg-chrome border-control text-fg-secondary border px-3 py-1 text-xs"
          >
            No {getLine(line).name} trains are reporting right now.
          </p>
        </div>
      )}
    </div>
  )
}

/** Adds a class to the map when zoomed in far enough to show every car-number tag. */
function TagVisibility() {
  const map = useMap()
  useEffect(() => {
    const update = () =>
      map.getContainer().classList.toggle('tags-visible', map.getZoom() >= TAG_ZOOM)
    update()
    map.on('zoomend', update)
    return () => {
      map.off('zoomend', update)
    }
  }, [map])
  return null
}

/** Clicking empty map space deselects the vehicle. */
function ClearSelectionOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear })
  return null
}
