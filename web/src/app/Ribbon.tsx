import { NavLink } from 'react-router'
import { ChartIcon, MapIcon, PinIcon } from '../components/Icons'
import { ANALYTICS_PATH, COMMUTE_PATH, MAP_PATH, useViewParams } from '../hooks/useViewParams'
import { RefreshButtons } from './RefreshButtons'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `grid h-8 w-8 place-items-center rounded-md ${
    isActive ? 'bg-main text-fg' : 'text-chrome-muted hover:text-chrome-fg hover:bg-white/10'
  }`

/** The narrow navy icon column on the left (desktop only). */
export function Ribbon() {
  const { search } = useViewParams()
  return (
    <div className="bg-chrome border-chrome-border hidden w-11 shrink-0 flex-col items-center gap-1 border-r py-2 md:flex">
      <nav aria-label="Views" className="flex flex-col gap-1">
        <NavLink
          to={{ pathname: MAP_PATH, search }}
          end
          aria-label="Live map"
          title="Live map"
          className={linkClass}
        >
          <MapIcon />
        </NavLink>
        <NavLink
          to={{ pathname: ANALYTICS_PATH, search }}
          aria-label="Analytics"
          title="Analytics"
          className={linkClass}
        >
          <ChartIcon />
        </NavLink>
        <NavLink
          to={{ pathname: COMMUTE_PATH, search }}
          aria-label="My commute"
          title="My commute"
          className={linkClass}
        >
          <PinIcon />
        </NavLink>
      </nav>
      <div className="bg-chrome-border my-1 h-px w-6" aria-hidden="true" />
      <RefreshButtons />
    </div>
  )
}
