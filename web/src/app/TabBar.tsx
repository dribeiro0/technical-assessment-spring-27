import { NavLink } from 'react-router'
import { MenuIcon } from '../components/Icons'
import { ANALYTICS_PATH, COMMUTE_PATH, MAP_PATH, useViewParams } from '../hooks/useViewParams'
import { RefreshButtons } from './RefreshButtons'

// The active tab turns paper-white with an orange bar on top; the others sit on the navy frame.
const tabClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-full items-center whitespace-nowrap border-r border-chrome-border px-3 text-xs sm:px-4 ${
    isActive
      ? 'bg-main text-fg font-semibold before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-brand'
      : 'text-chrome-muted hover:text-chrome-fg'
  }`

/** Tabs across the top of the main area, plus the transit-mode selector. */
export function TabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { search } = useViewParams()
  return (
    <div className="bg-chrome border-chrome-border flex h-9 shrink-0 items-stretch border-b">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open lines and trains"
        className="text-chrome-muted hover:text-chrome-fg border-chrome-border grid w-10 place-items-center border-r md:hidden"
      >
        <MenuIcon />
      </button>
      <nav aria-label="Views" className="flex">
        <NavLink to={{ pathname: MAP_PATH, search }} end className={tabClass}>
          Live map
        </NavLink>
        <NavLink to={{ pathname: ANALYTICS_PATH, search }} className={tabClass}>
          Analytics
        </NavLink>
        <NavLink to={{ pathname: COMMUTE_PATH, search }} className={tabClass}>
          My commute
        </NavLink>
      </nav>
      <div className="ml-auto flex items-center gap-1 px-2">
        <label className="sr-only" htmlFor="mode-select">
          Transit mode
        </label>
        {/* Only Subway exists for now, so on narrow phones the selector gives way to the controls. */}
        <select
          id="mode-select"
          defaultValue="subway"
          className="bg-main border-chrome-border text-fg hidden h-6 rounded-md border px-1.5 text-xs sm:block"
        >
          <option value="subway">Subway</option>
          <option value="bus" disabled>
            Bus (coming soon)
          </option>
          <option value="rail" disabled>
            Commuter Rail (coming soon)
          </option>
        </select>
        <div className="flex md:hidden">
          <RefreshButtons />
        </div>
      </div>
    </div>
  )
}
