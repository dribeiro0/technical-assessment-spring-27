import L from 'leaflet'
import { memo, useMemo } from 'react'
import { CircleMarker, Pane, Polyline, Tooltip } from 'react-leaflet'
import type { CommuteFocus } from '../../domain/commuteRoute'
import { getLine, type LineId } from '../../domain/lines'
import { useNetwork } from '../../hooks/useNetwork'

const TRANSFER_STATION_COLOR = '#1D2B44'
const STATION_FILL = '#FFFFFF'
const SELECTED_RING = '#1D2B44'

interface Props {
  activeLine: LineId | null
  selectedStation: string | null
  onSelectStation: (stationId: string) => void
  /** An open commute: its stretch is drawn on top and everything else fades. */
  focus?: { stretch: CommuteFocus; color: string } | null
}

/**
 * Line paths and hollow station dots from /shapes and /stops (Sprint 3, DEC-027).
 * Drawn in their own panes so they always sit beneath the vehicles.
 * When a line filter is set, the other lines fade back: shapes are restyled in place
 * rather than rebuilt. An open commute works the same way for just the stretch it rides.
 *
 * Tapping a station opens its departures. The dots are small, so they get their own
 * canvas renderer with a wide tolerance: a tap up to 10 px away still counts.
 */
export const RouteLayer = memo(function RouteLayer({
  activeLine,
  selectedStation,
  onSelectStation,
  focus = null,
}: Props) {
  const { data: network } = useNetwork()
  const stationRenderer = useMemo(() => L.canvas({ pane: 'stations', tolerance: 10 }), [])
  if (!network) return null

  const dimmed = (lines: LineId[]) =>
    focus !== null || (activeLine !== null && !lines.includes(activeLine))
  const selected = selectedStation
    ? network.stations.find((s) => s.id === selectedStation)
    : undefined

  return (
    <>
      <Pane name="routes" style={{ zIndex: 410 }}>
        {network.shapes.map((shape) => (
          <Polyline
            key={shape.id}
            positions={shape.points}
            interactive={false}
            pathOptions={{
              color: getLine(shape.line).color,
              weight: 4,
              opacity: dimmed([shape.line]) ? 0.2 : 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}
        {focus?.stretch.paths.map((path, i) => (
          <Polyline
            key={`focus-${i}`}
            positions={path}
            interactive={false}
            pathOptions={{
              color: focus.color,
              weight: 6,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}
      </Pane>
      <Pane name="stations" style={{ zIndex: 420 }}>
        {network.stations.map((station) => {
          const isTransfer = station.lines.length > 1
          const faded = focus ? !focus.stretch.stationIds.has(station.id) : dimmed(station.lines)
          return (
            <CircleMarker
              key={station.id}
              center={[station.lat, station.lon]}
              radius={isTransfer ? 4.5 : 3.5}
              renderer={stationRenderer}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => onSelectStation(station.id) }}
              pathOptions={{
                color: isTransfer ? TRANSFER_STATION_COLOR : getLine(station.lines[0]).color,
                weight: 2,
                fillColor: STATION_FILL,
                fillOpacity: 1,
                opacity: faded ? 0.25 : 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} className="station-tooltip">
                {station.name}
              </Tooltip>
            </CircleMarker>
          )
        })}
        {selected && (
          <CircleMarker
            key={`selected-${selected.id}`}
            center={[selected.lat, selected.lon]}
            radius={9}
            renderer={stationRenderer}
            interactive={false}
            pathOptions={{ color: SELECTED_RING, weight: 2.5, fill: false }}
          />
        )}
      </Pane>
    </>
  )
})
