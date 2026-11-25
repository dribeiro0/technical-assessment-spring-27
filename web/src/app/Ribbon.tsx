import { NavLink } from 'react-router'
import { ChartIcon, MapIcon } from '../components/Icons'
import { ANALYTICS_PATH, MAP_PATH, useViewParams } from '../hooks/useViewParams'
import { RefreshButtons } from './RefreshButtons'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `grid h-8 w-8 place-items-center rounded-sm ${
    isActive ? 'bg-main text-fg' : 'text-fg-muted hover:text-fg hover:bg-main'
  }`

/** The narrow icon column on the left (desktop only). */
export function Ribbon() {
  const { search } = useViewParams()
  return (
    <div className="bg-chrome border-border hidden w-11 shrink-0 flex-col items-center gap-1 border-r py-2 md:flex">
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
      </nav>
      <div className="bg-border my-1 h-px w-6" aria-hidden="true" />
      <RefreshButtons />
    </div>
  )
}
