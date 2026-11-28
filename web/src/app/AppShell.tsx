import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { CloseIcon } from '../components/Icons'
import { LineStatusBadges } from '../components/LineStatusBadges'
import { LineTree } from '../components/LineTree'
import { MyCommutes } from '../components/MyCommutes'
import { TrainCard } from '../components/TrainCard'
import { useCommuteFirstOnPhone } from '../hooks/useCommuteFirstOnPhone'
import { MAP_PATH } from '../hooks/useViewParams'
import { Ribbon } from './Ribbon'
import { StatusBar } from './StatusBar'
import { TabBar } from './TabBar'

export const APP_TITLE = 'EnRoute'
export const APP_DESCRIPTION =
  'Every MBTA subway train, live: where it is, where it’s headed and what’s going wrong.'

/** The EnRoute mark: an arrow on a burnt-orange tile. */
function Logo({ size = 26 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="bg-brand grid shrink-0 place-items-center rounded-md"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16">
        <path d="M8 2.5 13 13 8 10.4 3 13z" fill="#FFFDF8" />
      </svg>
    </span>
  )
}

function Brand() {
  return (
    <div className="border-border flex gap-2.5 border-b px-4 py-3.5">
      <Logo />
      <div>
        <h1 className="text-fg text-[15px] font-bold tracking-tight">{APP_TITLE}</h1>
        <p className="text-fg-muted mt-0.5 text-xs leading-snug">{APP_DESCRIPTION}</p>
      </div>
    </div>
  )
}

/** Sidebar contents, shared by the desktop sidebar and the phone drawer. */
function SidebarContent({ onVehicleChosen }: { onVehicleChosen?: () => void }) {
  return (
    <>
      <LineStatusBadges />
      <MyCommutes onChosen={onVehicleChosen} />
      <LineTree onVehicleChosen={onVehicleChosen} />
    </>
  )
}

/**
 * The app frame. Desktop: navy ribbon | sidebar (brand, line status, trains) | navy tab bar
 * over the view, with a navy status bar underneath. The selected train's card floats over
 * the map. Phone: the sidebar moves into a drawer and the card becomes a bottom sheet, so
 * the map always comes first.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const onMap = pathname === MAP_PATH
  const [drawerOpen, setDrawerOpen] = useState(false)
  useCommuteFirstOnPhone()

  // Close the phone drawer with Escape.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Phone header: the title and description stay visible on the landing view (R2). */}
      <header className="bg-chrome border-chrome-border flex items-center gap-2.5 border-b px-3 py-2 md:hidden">
        <Logo size={28} />
        <div>
          <p className="text-chrome-fg text-sm font-bold">{APP_TITLE}</p>
          <p className="text-chrome-muted text-[11px] leading-snug">{APP_DESCRIPTION}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Ribbon />

        <aside className="bg-side border-border hidden min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r md:flex">
          <Brand />
          <SidebarContent />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <TabBar onOpenMenu={() => setDrawerOpen(true)} />
          <div className="relative min-h-0 flex-1">
            <Outlet />
            {onMap && <TrainCard />}
          </div>
        </main>
      </div>

      <StatusBar />

      {/* Phone drawer with the line status and train list. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[2000] md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lines and trains"
            className="bg-side absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col shadow-[var(--shadow-float)]"
          >
            <div className="flex items-start justify-between">
              <Brand />
              <button
                type="button"
                autoFocus
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="text-fg-muted hover:text-fg m-2 grid h-8 w-8 shrink-0 place-items-center"
              >
                <CloseIcon />
              </button>
            </div>
            <SidebarContent onVehicleChosen={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
