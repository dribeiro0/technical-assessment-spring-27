import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { CloseIcon } from '../components/Icons'
import { LineTree } from '../components/LineTree'
import { PropertiesPanel } from '../components/PropertiesPanel'
import { MAP_PATH, useViewParams } from '../hooks/useViewParams'
import { Ribbon } from './Ribbon'
import { StatusBar } from './StatusBar'
import { TabBar } from './TabBar'

export const APP_TITLE = 'Chaos Meter'
export const APP_DESCRIPTION =
  'Every MBTA subway train, live: where it is, where it’s headed and what’s going wrong.'

function Brand() {
  return (
    <div className="border-border border-b px-4 py-3">
      <h1 className="text-fg text-sm font-semibold tracking-tight">{APP_TITLE}</h1>
      <p className="text-fg-muted mt-0.5 text-xs leading-snug">{APP_DESCRIPTION}</p>
    </div>
  )
}

/**
 * The V5 app frame. Desktop: ribbon | sidebar tree | tabs + view | properties, with a
 * status bar underneath. Phone: tabs on top, the tree in a drawer and properties
 * in a bottom sheet, so the map always comes first.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const { vehicleId } = useViewParams()
  const onMap = pathname === MAP_PATH
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close the phone drawer with Escape.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="flex h-full flex-col">
      {/* Phone header: the title and description stay visible on the landing view (R2). */}
      <header className="bg-chrome border-border border-b px-3 py-2 md:hidden">
        <p className="text-fg text-sm font-semibold">{APP_TITLE}</p>
        <p className="text-fg-muted text-[11px] leading-snug">{APP_DESCRIPTION}</p>
      </header>

      <div className="flex min-h-0 flex-1">
        <Ribbon />

        <aside className="bg-side border-border hidden w-64 shrink-0 flex-col border-r md:flex">
          <Brand />
          <LineTree />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <TabBar onOpenMenu={() => setDrawerOpen(true)} />
          <div className="relative min-h-0 flex-1">
            <Outlet />

            {/* Bottom sheet for vehicle details on phones and tablets. */}
            {onMap && vehicleId && (
              <div className="bg-side border-border absolute inset-x-0 bottom-0 z-[1100] flex max-h-[45%] flex-col border-t lg:hidden">
                <PropertiesPanel />
              </div>
            )}
          </div>
        </main>

        {onMap && (
          <aside className="bg-side border-border hidden w-72 shrink-0 flex-col border-l lg:flex">
            <PropertiesPanel />
          </aside>
        )}
      </div>

      <StatusBar />

      {/* Phone drawer with the line tree. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[2000] md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lines and vehicles"
            className="bg-side border-border absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col border-r"
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
            <LineTree onVehicleChosen={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
