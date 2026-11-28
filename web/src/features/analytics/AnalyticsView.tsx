import { useNavigate } from 'react-router'
import { AlertList } from '../../components/AlertList'
import { ErrorPanel } from '../../components/FeedNotices'
import { StatusMark } from '../../components/StatusMark'
import { countByLine } from '../../domain/counts'
import {
  DAY_TYPE_TEXT,
  MIN_TRAINS_TO_COMPARE,
  dateRangeText,
  usualTrains,
} from '../../domain/baselines'
import { formatAgeLong } from '../../domain/freshness'
import { useLiveData } from '../../hooks/liveData'
import { useBaselines } from '../../hooks/useHistoryStatus'
import { useNow } from '../../hooks/useNow'
import { MAP_PATH } from '../../hooks/useViewParams'
import { ChaosPanel } from './ChaosPanel'
import { HistoryPanel } from './HistoryPanel'
import { ReliabilityChart } from './ReliabilityChart'
import { VehiclesByLineChart } from './VehiclesByLineChart'

/**
 * Analytics view (R8). The chart compares every in-scope line and ignores the
 * map's line filter (DEC-019); counts come from the same data as the map.
 */
export function AnalyticsView() {
  const { vehicles, status, lastSuccessAt, lineStatus, alerts } = useLiveData()
  const navigate = useNavigate()
  const now = useNow(1000)
  const counts = countByLine(vehicles)
  const hasData = status !== 'loading' && status !== 'error'
  // "Is now worse than usual?" (Sprint 7, B4): only when the live data is current.
  const { data: baselines } = useBaselines()
  const current = status === 'live' || status === 'refresh-failed'
  const usual = (line: (typeof counts)[number]['line']) =>
    baselines ? usualTrains(baselines, line, now) : null
  const slot = baselines ? counts.map((c) => usual(c.line)).find((u) => u !== null) : null

  const openLine = (line: string) => navigate({ pathname: MAP_PATH, search: `?line=${line}` })

  return (
    <div className="bg-main relative h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <section
          aria-labelledby="chart-title"
          className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_1px_3px_rgb(29_43_68_/0.08)]"
        >
          <header className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 id="chart-title" className="text-fg text-sm font-semibold">
                Active vehicles by subway line
              </h2>
              <p className="text-fg-muted mt-0.5 text-xs">
                Trains reporting right now, all lines (the map filter does not apply). Green
                branches combined.
              </p>
            </div>
            <p className="text-fg-muted font-mono text-[11px]">
              {lastSuccessAt ? `updated ${formatAgeLong(lastSuccessAt, now)}` : '–'}
            </p>
          </header>
          <div className="px-2 py-4 md:px-4">
            {hasData ? (
              <VehiclesByLineChart counts={counts} onPickLine={openLine} />
            ) : (
              <p className="text-fg-muted grid h-72 place-items-center text-xs">
                {status === 'loading' ? 'Loading live trains…' : 'No data to chart yet.'}
              </p>
            )}
          </div>

          {/* The same numbers as a table, for screen readers and exact values. */}
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Active vehicles and service status by line</caption>
            <thead className="text-fg-muted border-border border-t">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Line
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Vehicles
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Usually
                </th>
                <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">
                  Branches
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.line} className="border-border border-t">
                  <th scope="row" className="px-4 py-2 font-normal">
                    <button
                      type="button"
                      onClick={() => openLine(c.line)}
                      className="text-fg inline-flex items-center gap-2 hover:underline"
                      title={`Show the ${c.name} on the map`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5"
                        style={{ background: c.color }}
                      />
                      {c.name}
                    </button>
                  </th>
                  <td className="text-fg px-4 py-2 font-mono">{hasData ? c.count : '–'}</td>
                  <UsualCell count={hasData && current ? c.count : null} usual={usual(c.line)} />
                  <td className="text-fg-muted hidden px-4 py-2 font-mono sm:table-cell">
                    {Object.keys(c.branches).length
                      ? Object.entries(c.branches)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([b, n]) => `${b} ${n}`)
                          .join(' · ')
                      : '–'}
                  </td>
                  <td className="px-4 py-2">
                    <StatusMark level={lineStatus?.[c.line].level ?? null} withText />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {baselines && (
            <p className="text-fg-muted border-border border-t px-4 py-2 text-[11px]">
              “Usually” is the typical number of trains running mid-hour
              {slot ? ` on ${DAY_TYPE_TEXT[slot.dayType]} at this hour` : ''}, from MBTA LAMP data,{' '}
              {dateRangeText(baselines.source.fromDate, baselines.source.toDate)}. “–” means there
              is not enough history for this hour.
            </p>
          )}
        </section>

        <ChaosPanel />

        <section
          aria-labelledby="alerts-title"
          className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_1px_3px_rgb(29_43_68_/0.08)]"
        >
          <header className="border-border border-b px-4 py-3">
            <h2 id="alerts-title" className="text-fg text-sm font-semibold">
              Service alerts
            </h2>
            <p className="text-fg-muted mt-0.5 text-xs">
              Official MBTA alerts affecting riders. Minor notices (severity under 3) are hidden.
            </p>
          </header>
          <div className="p-4">
            <AlertList
              alerts={alerts}
              unavailable={lineStatus === null}
              emptyText="No service alerts. Good service on all lines."
            />
          </div>
        </section>
        <ReliabilityChart />
        <HistoryPanel />
      </div>
      <ErrorPanel />
    </div>
  )
}

/** The typical count for this hour, flagging a line running well below it (B4). */
function UsualCell({
  count,
  usual,
}: {
  count: number | null
  usual: { typical: number; days: number } | null
}) {
  if (!usual) {
    return (
      <td className="text-fg-muted px-4 py-2 font-mono" title="Not enough history for this hour">
        –
      </td>
    )
  }
  // Tiny counts (the last trains of the night) vary too much to flag.
  const fewer =
    count !== null && usual.typical >= MIN_TRAINS_TO_COMPARE && count < usual.typical * 0.75
  return (
    <td className="px-4 py-2 font-mono">
      <span className="text-fg-secondary">{usual.typical}</span>
      {fewer && (
        <span className="text-warn ml-2 font-sans font-semibold">
          <span aria-hidden="true">▼ </span>fewer than usual
        </span>
      )}
    </td>
  )
}
