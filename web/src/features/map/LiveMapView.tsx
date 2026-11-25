import L from 'leaflet'
import { useCallback, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { ErrorPanel, LoadingNotice, StaleBanner } from '../../components/FeedNotices'
import { vehicleFreshness } from '../../domain/freshness'
import { getLine, type LineId } from '../../domain/lines'
import type { Vehicle } from '../../domain/vehicle'
import { useLiveData } from '../../hooks/liveData'
import { useNetwork } from '../../hooks/useNetwork'
import { useNow } from '../../hooks/useNow'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useViewParams } from '../../hooks/useViewParams'
import { RouteLayer } from './RouteLayer'
import { VehicleMarker } from './VehicleMarker'

/** Downtown Boston, between Park Street and Downtown Crossing. */
const BOSTON_CENTER: [number, number] = [42.3555, -71.0605]
const BOSTON_ZOOM = 12
/** Destination tags show from this zoom level up (and always on hover or selection). */
const TAG_ZOOM = 14

// Esri's light gray basemap without labels, faded over the cream map colour, so our own
// stations and tags stay readable.
// It needs no API key. (CARTO's dark tiles, the first choice, began requiring one.)
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
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
        zoom={BOSTON_ZOOM}
        // Lines and station dots are drawn on a canvas, which stays smooth with hundreds of shapes.
        preferCanvas
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
        <FitToLine line={line} />
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

/** Adds a class to the map when zoomed in far enough to show every destination tag. */
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

/**
 * When a line is chosen, zooms the map to show the whole line; when the filter is
 * cleared, returns to the Boston overview.
 */
function FitToLine({ line }: { line: LineId | null }) {
  const map = useMap()
  const { data: network } = useNetwork()
  const reducedMotion = useReducedMotion()
  const fittedFor = useRef<LineId | null | undefined>(undefined)

  useEffect(() => {
    if (fittedFor.current === line) return
    if (line === null) {
      // Leave the view alone on first load; only reset after a filter is cleared.
      if (fittedFor.current !== undefined) {
        map.flyTo(BOSTON_CENTER, BOSTON_ZOOM, { animate: !reducedMotion, duration: 0.8 })
      }
      fittedFor.current = null
      return
    }
    const points = network?.shapes.filter((s) => s.line === line).flatMap((s) => s.points)
    if (!points?.length) return // try again once the line paths have loaded
    map.flyToBounds(L.latLngBounds(points), {
      padding: [32, 32],
      animate: !reducedMotion,
      duration: 0.8,
    })
    fittedFor.current = line
  }, [line, network, map, reducedMotion])

  return null
}
