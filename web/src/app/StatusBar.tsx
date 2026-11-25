import { formatAgeLong } from '../domain/freshness'
import { getLine } from '../domain/lines'
import { type FeedStatus, useLiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'
import { VEHICLE_POLL_MS } from '../hooks/polling'
import { useViewParams } from '../hooks/useViewParams'

// The dot shows state by colour and the word beside it says it, so it is never colour alone.
const STATUS: Record<FeedStatus, { text: string; dot: string; pulse?: boolean }> = {
  loading: { text: 'loading', dot: 'bg-chrome-muted' },
  error: { text: 'offline', dot: 'bg-danger' },
  live: { text: 'live', dot: 'bg-live', pulse: true },
  'refresh-failed': { text: 'refresh failed', dot: 'bg-brand' },
  stale: { text: 'stale', dot: 'bg-brand' },
  'rate-limited': { text: 'rate limited', dot: 'bg-brand' },
  paused: { text: 'paused', dot: 'bg-chrome-muted' },
}

/** The navy bottom bar: feed status, last update time and train count (R7). */
export function StatusBar() {
  const { status, lastSuccessAt, vehicles, alerts, retryAt } = useLiveData()
  const { line } = useViewParams()
  const now = useNow(1000)
  // A rate limit on the very first load shows the error panel, but the bar says why.
  const s = status === 'error' && retryAt ? STATUS['rate-limited'] : STATUS[status]
  const shown = line ? vehicles.filter((v) => v.line === line).length : vehicles.length

  return (
    <footer className="bg-chrome border-chrome-border text-chrome-muted flex h-6 shrink-0 items-center gap-4 overflow-hidden border-t px-3 font-mono text-[11px] whitespace-nowrap">
      <span className="text-chrome-fg inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${s.dot} ${s.pulse ? 'live-pulse' : ''}`}
        />
        {s.text}
      </span>
      {/* Announced to screen readers only when the status changes, not every second. */}
      <span className="sr-only" aria-live="polite">
        Feed {s.text}
      </span>
      <span>
        updated{' '}
        {lastSuccessAt
          ? `${formatAgeLong(lastSuccessAt, now)} · ${new Date(lastSuccessAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`
          : '–'}
      </span>
      <span>
        {lastSuccessAt === null ? '–' : shown} trains{line ? ` · ${getLine(line).name}` : ''}
      </span>
      <span className="hidden sm:inline">{alerts.length} alerts</span>
      <span className="ml-auto hidden sm:inline">
        {status === 'paused' ? 'auto-refresh off' : `auto-refresh ${VEHICLE_POLL_MS / 1000} s`}
      </span>
    </footer>
  )
}
