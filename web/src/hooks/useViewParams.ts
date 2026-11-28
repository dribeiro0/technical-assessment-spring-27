import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { isLineId, type LineId } from '../domain/lines'

export const MAP_PATH = '/'
export const ANALYTICS_PATH = '/analytics'
export const COMMUTE_PATH = '/commute'

/**
 * The line filter (?line=Red) and selected vehicle (?vehicle=R-548CD8D6) live in the URL,
 * so they survive switching views and reloading the page (DEC-025).
 */
export function useViewParams() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const lineParam = params.get('line')
  const line: LineId | null = isLineId(lineParam) ? lineParam : null
  const vehicleId = params.get('vehicle')
  const stationId = params.get('stop')

  /** Applies changes to the URL parameters, optionally moving to another view. */
  const update = useCallback(
    (changes: Record<string, string | null>, pathname = location.pathname) => {
      const next = new URLSearchParams(location.search)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      const search = next.toString()
      navigate(
        { pathname, search: search ? `?${search}` : '' },
        { replace: pathname === location.pathname },
      )
    },
    [location.pathname, location.search, navigate],
  )

  /**
   * Sets the line filter. Pass the selected train's line so that a train on another line
   * is deselected: otherwise its card would stay open while its marker is filtered away.
   */
  const setLine = useCallback(
    (next: LineId | null, selectedVehicleLine?: LineId | null) => {
      const changes: Record<string, string | null> = { line: next }
      if (next && vehicleId && selectedVehicleLine && selectedVehicleLine !== next) {
        changes.vehicle = null
      }
      update(changes)
    },
    [update, vehicleId],
  )

  /**
   * Selects a vehicle and shows it on the map. If the line filter would hide it,
   * the filter moves to the vehicle's line.
   */
  const selectVehicle = useCallback(
    (id: string | null, vehicleLine?: LineId) => {
      // A train and a station are never selected at the same time: one card at a time.
      const changes: Record<string, string | null> = { vehicle: id, stop: null }
      if (id && vehicleLine && line && line !== vehicleLine) changes.line = vehicleLine
      update(changes, id ? MAP_PATH : location.pathname)
    },
    [update, line, location.pathname],
  )

  /** Selects a station (?stop=place-pktrm) to show when the next trains leave it. */
  const selectStation = useCallback(
    (id: string | null) => update({ stop: id, vehicle: null }, id ? MAP_PATH : location.pathname),
    [update, location.pathname],
  )

  return {
    line,
    vehicleId,
    stationId,
    setLine,
    selectVehicle,
    selectStation,
    search: location.search,
  }
}
