import { commuteToward } from '../domain/commute'
import { routeColor } from '../domain/lines'
import { useSavedCommutes } from '../hooks/useSavedCommutes'
import { useViewParams } from '../hooks/useViewParams'

/**
 * Saved commutes in the sidebar. Choosing one opens its card over the map (?commute=).
 * Nothing is fetched here: only the open card asks for departures, so a long list costs
 * no requests.
 */
export function MyCommutes({ onChosen }: { onChosen?: () => void }) {
  const { commutes } = useSavedCommutes()
  const { commuteId, selectCommute } = useViewParams()

  return (
    <section aria-labelledby="my-commutes-title" className="px-4 pb-1">
      <h2
        id="my-commutes-title"
        className="text-fg-muted pt-3.5 pb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase"
      >
        My commutes
      </h2>
      {commutes.length === 0 ? (
        <p className="text-fg-muted pb-1 text-xs leading-snug">
          Tap a station on the map, then{' '}
          <span className="text-fg font-semibold">☆ Save as my commute</span>.
        </p>
      ) : (
        <ul className="space-y-1">
          {commutes.map((c) => {
            const open = c.id === commuteId
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={open ? 'true' : undefined}
                  onClick={() => {
                    selectCommute(open ? null : c.id)
                    onChosen?.()
                  }}
                  className={`relative flex w-full items-center gap-2 overflow-hidden rounded-lg border py-1.5 pr-2 pl-3.5 text-left ${
                    open
                      ? 'border-select bg-chip ring-select ring-1'
                      : 'border-border bg-card hover:bg-chip/60'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ background: routeColor(c.routeId) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-fg block truncate text-[13px] font-semibold">
                      <span aria-hidden="true" className="text-brand">
                        ★{' '}
                      </span>
                      {c.name}
                    </span>
                    <span className="text-fg-muted block truncate text-[11px]">
                      {c.stationName} · toward {commuteToward(c)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
