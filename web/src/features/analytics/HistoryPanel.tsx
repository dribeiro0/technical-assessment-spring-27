import { useHistoryStatus } from '../../hooks/useHistoryStatus'

const when = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function minutes(ms: number): string {
  const m = Math.round(ms / 60_000)
  return m < 120 ? `${m} min` : `${(m / 60).toFixed(1)} h`
}

/**
 * History collection (Sprint 6, H6). Until there is enough history, this says what is
 * being collected and since when, instead of showing trend charts (07, section 7).
 * Gaps are listed as gaps, never smoothed over.
 */
export function HistoryPanel() {
  const { data, isPending, isError } = useHistoryStatus()

  return (
    <section
      aria-labelledby="history-title"
      className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_1px_3px_rgb(29_43_68_/0.08)]"
    >
      <header className="border-border border-b px-4 py-3">
        <h2 id="history-title" className="text-fg text-sm font-semibold">
          History
        </h2>
        <p className="text-fg-muted mt-0.5 text-xs">
          EnRoute records every train every minute, even when nobody has the site open. Trends
          appear here once there is enough history.
        </p>
      </header>
      <div className="space-y-1.5 p-4 text-xs">
        {isPending ? (
          <p className="text-fg-muted">Checking history collection…</p>
        ) : isError || !data ? (
          <p className="text-warn font-semibold">
            History is unavailable right now. Live data on the map is not affected.
          </p>
        ) : data.collectingSince === null ? (
          <p className="text-fg-muted">History collection has not started yet.</p>
        ) : (
          <>
            <p className="text-fg">
              <span className="font-semibold">Collecting data since </span>
              {when.format(data.collectingSince)}
            </p>
            <p className="text-fg-secondary">
              {data.last24h.successful} of {data.last24h.runs} collection runs succeeded in the last
              24 hours
              {data.health !== 'ok' && (
                <span className="text-warn font-semibold">
                  {' '}
                  · collection is {data.health === 'down' ? 'not running' : 'behind'} right now
                </span>
              )}
            </p>
            {data.gaps.length === 0 ? (
              <p className="text-fg-muted">No gaps recorded.</p>
            ) : (
              <div>
                <p className="text-fg-secondary">
                  {data.gaps.length === 1 ? '1 gap' : `${data.gaps.length} gaps`} with no data
                  (shown as gaps, never filled in):
                </p>
                <ul className="text-fg-muted mt-0.5 font-mono text-[11px]">
                  {data.gaps.slice(0, 5).map((g) => (
                    <li key={g.start}>
                      {when.format(g.start)} – {when.format(g.end)} ({minutes(g.end - g.start)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
