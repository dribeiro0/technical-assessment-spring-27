import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useSavedCommutes } from './useSavedCommutes'
import { COMMUTE_PATH, MAP_PATH } from './useViewParams'

/** Phones: below Tailwind's md breakpoint, the same width at which the sidebar becomes a drawer. */
const PHONE_QUERY = '(max-width: 767px)'

/**
 * A returning phone rider with a saved commute opens on it instead of the map
 * (00 section 5, C8). Only on the plain landing page and only once per visit: a shared
 * link such as ?line=Red still opens the map, and desktop always starts on the map.
 */
export function useCommuteFirstOnPhone() {
  const { commutes } = useSavedCommutes()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const decided = useRef(false)

  useEffect(() => {
    if (decided.current) return
    decided.current = true
    const phone = window.matchMedia?.(PHONE_QUERY).matches ?? false
    if (phone && commutes.length > 0 && pathname === MAP_PATH && !search) {
      navigate(COMMUTE_PATH, { replace: true })
    }
    // Decided once, on the first render of the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
