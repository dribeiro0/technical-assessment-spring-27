import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { ErrorPanel, LoadingNotice, StaleBanner } from '../../components/FeedNotices'
import { vehicleFreshness } from '../../domain/freshness'
import { reachesDestination } from '../../domain/commute'
import { alertFocus, commuteFocus, endsBeforeDestination } from '../../domain/commuteRoute'
import { getLine, routeColor, type LineId } from '../../domain/lines'
import type { Vehicle } from '../../domain/vehicle'
import { useLiveData } from '../../hooks/liveData'
import { useNetwork } from '../../hooks/useNetwork'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSavedCommutes } from '../../hooks/useSavedCommutes'
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
  const { vehicles, status, freshnessReference, alerts } = useLiveData()
  const reducedMotion = useReducedMotion()
  const { line, vehicleId, stationId, commuteId, alertId, selectVehicle, selectStation } =
    useViewParams()
  const { commutes } = useSavedCommutes()
  const { data: network } = useNetwork()
  const commute = commuteId ? commutes.find((c) => c.id === commuteId) : undefined
  const alert = alertId ? alerts.find((a) => a.id === alertId) : undefined
  // An open commute rings its station on the map, as a selected station does.
  const ringedStation = stationId ?? commute?.stationId ?? null

  // An open commute focuses the map on the stretch it rides, and an open alert on what
  // it affects, like the line filter does for a whole line: that part stays bright and
  // everything else fades. Closed stations also get a warning ring.
  const focus = useMemo(() => {
    if (!network) return null
    if (commute) {
      const stretch = commuteFocus(network, commute)
      return stretch ? { stretch, color: routeColor(commute.routeId) ?? '#1D2B44' } : null
    }
    if (alert) {
      const stretch = alertFocus(network, alert)
      if (!stretch) return null
      const closed = alert.entities.filter((e) => !e.ride && e.stationId).map((e) => e.stationId!)
      return {
        stretch,
        color: routeColor(alert.entities[0]?.routeId ?? '') ?? '#1D2B44',
        marks: [...new Set(closed)],
        markColor: alert.level === 'major' ? '#B42318' : '#9A520A',
      }
    }
    return null
  }, [commute, alert, network])
  // Where to zoom for the focus: the lit track, plus lit stations (a closure has no track).
  const focusPoints = useMemo(() => {
    if (!focus || !network) return null
    const stations = network.stations
      .filter((s) => focus.stretch.stationIds.has(s.id))
      .map((s): [number, number] => [s.lat, s.lon])
    return [...focus.stretch.paths.flat(), ...stations]
  }, [focus, network])
  const alertRoutes = alert ? new Set(alert.entities.map((e) => e.routeId)) : null

  // With a commute open, only the trains the rider could catch: its route, its direction,
  // and (where the Red Line splits) its branch.
  const shown = commute
    ? vehicles.filter(
        (v) =>
          v.routeId === commute.routeId &&
          (v.directionId === null || v.directionId === commute.directionId) &&
          reachesDestination(v.headsign, commute) &&
          !(network && endsBeforeDestination(network, commute, v.headsign)),
      )
    : alertRoutes
      ? vehicles.filter((v) => alertRoutes.has(v.routeId))
      : line
        ? vehicles.filter((v) => v.line === line)
        : vehicles
  const onSelect = useCallback((v: Vehicle) => selectVehicle(v.id, v.line), [selectVehicle])
  // Only say a line has no trains when the data is current; otherwise the banner explains why.
  const dataIsCurrent = status === 'live' || status === 'refresh-failed'

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={BOSTON_CENTER}
        zoom={BOSTON_ZOOM}
        // Lines and station dots are drawn on a canvas, which stays smooth with hundreds of shapes.
        preferCanvas
        // No zoom or fade animation when the system asks for reduced motion.
        zoomAnimation={!reducedMotion}
        fadeAnimation={!reducedMotion}
        markerZoomAnimation={!reducedMotion}
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
        <FitToFocus focusKey={commuteId ?? alertId} points={focusPoints} />
        <ShowStation stationId={stationId} />
        {/* Clicking empty map closes whichever card is open (selectVehicle clears them all). */}
        <ClearSelectionOnMapClick
          onClear={() => (vehicleId || stationId || commuteId || alertId) && selectVehicle(null)}
        />
        <RouteLayer
          activeLine={line}
          selectedStation={ringedStation}
          onSelectStation={selectStation}
          focus={focus}
        />
        {shown.map((v) => (
          <VehicleMarker
            key={v.id}
            vehicle={v}
            selected={v.id === vehicleId}
            aging={vehicleFreshness(v.updatedAt, freshnessReference) === 'aging'}
            onSelect={onSelect}
          />
        ))}
      </MapContainer>

      <LoadingNotice />
      <StaleBanner />
      <ErrorPanel />

      {/* An empty filter result is not a failure (DEC-019), so it gets its own message. */}
      {dataIsCurrent && line && shown.length === 0 && (
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

/** At this width and up the card floats top-right (400 px); below it is a bottom sheet. */
const CARD_FLOATS_QUERY = '(min-width: 1024px)'

/**
 * Zooms to an open commute's stretch or an open alert's affected area, as FitToLine does
 * for a whole line, leaving room for the card so it doesn't cover them: on the right on
 * desktop, at the bottom (up to 60% of the map) on phones. Once per opened item, so it
 * never fights a rider who pans around while the card is open.
 */
function FitToFocus({
  focusKey,
  points,
}: {
  focusKey: string | null
  points: [number, number][] | null
}) {
  const map = useMap()
  const reducedMotion = useReducedMotion()
  const fittedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!focusKey) {
      fittedFor.current = null
      return
    }
    if (fittedFor.current === focusKey || !points?.length) return // try again once loaded
    const floats = window.matchMedia?.(CARD_FLOATS_QUERY).matches ?? true
    const pad = 32
    map.flyToBounds(L.latLngBounds(points), {
      paddingTopLeft: [pad, pad],
      paddingBottomRight: floats ? [400 + 16 + pad, pad] : [pad, map.getSize().y * 0.6 + pad],
      maxZoom: 15,
      animate: !reducedMotion,
      duration: 0.8,
    })
    fittedFor.current = focusKey
  }, [focusKey, points, map, reducedMotion])

  return null
}

/**
 * When a station is picked from a train's stop strip it may be off-screen:
 * pan the map just enough to bring it into view. Stations picked on the map are
 * already visible, so the map doesn't move for them.
 */
function ShowStation({ stationId }: { stationId: string | null }) {
  const map = useMap()
  const { data: network } = useNetwork()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!stationId || !network) return
    const station = network.stations.find((s) => s.id === stationId)
    if (!station) return
    const point: [number, number] = [station.lat, station.lon]
    if (!map.getBounds().pad(-0.1).contains(point)) {
      map.panTo(point, { animate: !reducedMotion })
    }
  }, [stationId, network, map, reducedMotion])

  return null
}
