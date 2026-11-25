import { memo } from 'react'
import { CircleMarker, Pane, Polyline, Tooltip } from 'react-leaflet'
import { getLine, type LineId } from '../../domain/lines'
import { useNetwork } from '../../hooks/useNetwork'

const TRANSFER_STATION_COLOR = '#DADADA'
const MAP_BACKGROUND = '#141414'

/**
 * Line paths and hollow station dots from /shapes and /stops (Sprint 3, DEC-027).
 * Drawn in their own panes so they always sit beneath the vehicles.
 * When a line filter is set, the other lines fade back: shapes are restyled in place
 * rather than rebuilt, and the layer only re-renders when the filter changes.
 */
export const RouteLayer = memo(function RouteLayer({ activeLine }: { activeLine: LineId | null }) {
  const { data: network } = useNetwork()
  if (!network) return null

  const dimmed = (lines: LineId[]) => activeLine !== null && !lines.includes(activeLine)

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
      </Pane>
      <Pane name="stations" style={{ zIndex: 420 }}>
        {network.stations.map((station) => {
          const isTransfer = station.lines.length > 1
          const faded = dimmed(station.lines)
          return (
            <CircleMarker
              key={station.id}
              center={[station.lat, station.lon]}
              radius={isTransfer ? 4.5 : 3.5}
              bubblingMouseEvents={false}
              pathOptions={{
                color: isTransfer ? TRANSFER_STATION_COLOR : getLine(station.lines[0]).color,
                weight: 2,
                fillColor: MAP_BACKGROUND,
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
      </Pane>
    </>
  )
})
