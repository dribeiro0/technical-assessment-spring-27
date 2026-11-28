import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { isLineId, type LineId } from '../domain/lines'

export const MAP_PATH = '/'
export const ANALYTICS_PATH = '/analytics'

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
  const commuteId = params.get('commute')
  const alertId = params.get('alert')

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
      // Picking a line filter closes an open commute, so the two never compete over what
      // the map highlights.
      const changes: Record<string, string | null> = { line: next, commute: null, alert: null }
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
      // A train, a station and a commute are never selected together: one card at a time.
      const changes: Record<string, string | null> = {
        vehicle: id,
        stop: null,
        commute: null,
        alert: null,
      }
      if (id && vehicleLine && line && line !== vehicleLine) changes.line = vehicleLine
      update(changes, id ? MAP_PATH : location.pathname)
    },
    [update, line, location.pathname],
  )

  /** Selects a station (?stop=place-pktrm) to show when the next trains leave it. */
  const selectStation = useCallback(
    (id: string | null) =>
      update(
        { stop: id, vehicle: null, commute: null, alert: null },
        id ? MAP_PATH : location.pathname,
      ),
    [update, location.pathname],
  )

  /** Opens a saved commute's card over the map (?commute=<id>). */
  const selectCommute = useCallback(
    (id: string | null) =>
      update(
        { commute: id, vehicle: null, stop: null, alert: null },
        id ? MAP_PATH : location.pathname,
      ),
    [update, location.pathname],
  )

  /** Opens an official alert's card over the map (?alert=<id>). */
  const selectAlert = useCallback(
    (id: string | null) =>
      update(
        { alert: id, vehicle: null, stop: null, commute: null },
        id ? MAP_PATH : location.pathname,
      ),
    [update, location.pathname],
  )

  return {
    line,
    vehicleId,
    stationId,
    commuteId,
    alertId,
    setLine,
    selectVehicle,
    selectStation,
    selectCommute,
    selectAlert,
    search: location.search,
  }
}
