import { useCallback, useEffect, useState } from 'react'
import type { Point } from '../domain/commute'

/**
 * - off: the rider has not turned location on (it is never asked for on page load)
 * - asking: waiting for the browser's permission prompt or a position
 * - denied: the rider or the browser refused
 * - unavailable: no position could be found (or the browser has no location support)
 * - ok: a position, and when it was taken
 */
export type LocationState =
  | { status: 'off' }
  | { status: 'asking' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'ok'; here: Point; at: number }

/** Only the rider's choice to use location is remembered, never the position itself. */
const OPT_IN_KEY = 'enroute.useLocation'
/** While a commute is open, the position is refreshed this often. */
const REFRESH_MS = 60_000

const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

function optedIn(): boolean {
  try {
    return window.localStorage.getItem(OPT_IN_KEY) === '1'
  } catch {
    return false
  }
}

function setOptIn(on: boolean) {
  try {
    if (on) window.localStorage.setItem(OPT_IN_KEY, '1')
    else window.localStorage.removeItem(OPT_IN_KEY)
  } catch {
    // Without storage the choice simply lasts this visit.
  }
}

/**
 * The rider's position, for estimating the walk to their station. Used only in this
 * browser: it is never stored or sent anywhere (planning file 09).
 * It asks only when the rider presses "Use my location"; after that, opening a commute
 * locates them again without asking, until they turn it off.
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>(() =>
    !optedIn() ? { status: 'off' } : supported ? { status: 'asking' } : { status: 'unavailable' },
  )

  const locate = useCallback(() => {
    if (!supported) return
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: 'ok',
          here: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          at: Date.now(),
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setOptIn(false)
          setState({ status: 'denied' })
        } else {
          setState({ status: 'unavailable' })
        }
      },
      // City-block accuracy is enough for a walking estimate, and much faster and kinder
      // to the battery than GPS precision. A fix up to a minute old is fine.
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    )
  }, [])

  // Already turned on: locate when the card opens, then once a minute while it stays open.
  const active = supported && state.status !== 'off' && state.status !== 'denied'
  useEffect(() => {
    if (!active) return
    locate()
    const id = window.setInterval(locate, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [active, locate])

  const turnOn = useCallback(() => {
    setOptIn(true)
    setState(supported ? { status: 'asking' } : { status: 'unavailable' })
  }, [])

  const turnOff = useCallback(() => {
    setOptIn(false)
    setState({ status: 'off' })
  }, [])

  return { location: state, turnOn, turnOff }
}
