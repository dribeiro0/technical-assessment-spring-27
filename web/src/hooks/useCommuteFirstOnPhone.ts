import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useSavedCommutes } from './useSavedCommutes'
import { MAP_PATH, useViewParams } from './useViewParams'

/** Phones: below Tailwind's md breakpoint, the same width at which the sidebar becomes a drawer. */
const PHONE_QUERY = '(max-width: 767px)'

/**
 * A returning phone rider with a saved commute opens with its card already up, as the
 * bottom sheet over the map (00 section 5). Only on the plain landing page and only once
 * per visit: a shared link such as ?line=Red opens as shared, and desktop opens on the
 * map with nothing selected.
 */
export function useCommuteFirstOnPhone() {
  const { commutes } = useSavedCommutes()
  const { selectCommute } = useViewParams()
  const { pathname, search } = useLocation()
  const decided = useRef(false)

  useEffect(() => {
    if (decided.current) return
    decided.current = true
    const phone = window.matchMedia?.(PHONE_QUERY).matches ?? false
    if (phone && commutes.length > 0 && pathname === MAP_PATH && !search) {
      selectCommute(commutes[0].id)
    }
    // Decided once, on the first render of the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
