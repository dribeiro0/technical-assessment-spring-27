import { LINES } from '../domain/lines'
import { useLiveData } from '../hooks/liveData'
import { useViewParams } from '../hooks/useViewParams'
import { StatusMark } from './StatusMark'

/**
 * Four badges with each line's status from official MBTA alerts. Each badge is also a
 * filter button: clicking one shows only that line, clicking it again shows all.
 */
export function LineStatusBadges() {
  const { lineStatus } = useLiveData()
  const { line: activeLine, setLine } = useViewParams()

  return (
    <section aria-label="Line status" className="px-4 pb-1">
      <h2 className="text-fg-muted pt-3.5 pb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
        Line status
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {LINES.map((line) => {
          const active = activeLine === line.id
          return (
            <button
              key={line.id}
              type="button"
              aria-pressed={active}
              onClick={() => setLine(active ? null : line.id)}
              title={active ? 'Show all lines' : `Show only the ${line.name}`}
              className={`relative flex flex-col gap-0.5 overflow-hidden rounded-lg border py-2 pr-2 pl-3.5 text-left ${
                active
                  ? 'border-select bg-chip ring-select ring-1'
                  : 'border-border bg-card hover:bg-chip/60'
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: line.color }}
              />
              <span className="text-[13px] font-semibold">{line.name.replace(' line', '')}</span>
              <StatusMark level={lineStatus?.[line.id].level ?? null} withText />
            </button>
          )
        })}
      </div>
    </section>
  )
}
