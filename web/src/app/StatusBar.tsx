import { formatAgeLong } from '../domain/freshness'
import { getLine } from '../domain/lines'
import { type FeedStatus, useLiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'
import { useViewParams } from '../hooks/useViewParams'
import { VEHICLE_POLL_MS } from './LiveDataProvider'

const STATUS: Record<FeedStatus, { text: string; dot: string }> = {
  loading: { text: 'loading', dot: 'bg-fg-muted' },
  error: { text: 'offline', dot: 'bg-[#ff6b5e]' },
  live: { text: 'live', dot: 'bg-green-line' },
  'refresh-failed': { text: 'refresh failed', dot: 'bg-accent' },
  stale: { text: 'stale', dot: 'bg-accent' },
  'rate-limited': { text: 'rate limited', dot: 'bg-accent' },
  paused: { text: 'paused', dot: 'bg-fg-muted' },
}

/** The bottom bar: feed status, last update time and vehicle count (R7). */
export function StatusBar() {
  const { status, lastSuccessAt, vehicles, alerts } = useLiveData()
  const { line } = useViewParams()
  const now = useNow(1000)
  const s = STATUS[status]
  const shown = line ? vehicles.filter((v) => v.line === line).length : vehicles.length

  return (
    <footer className="bg-chrome border-border text-fg-muted flex h-6 shrink-0 items-center gap-4 overflow-hidden border-t px-3 font-mono text-[11px] whitespace-nowrap">
      <span className="text-fg inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
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
        {shown} vehicles{line ? ` · ${getLine(line).name}` : ''}
      </span>
      <span className="hidden sm:inline">{alerts.length} alerts</span>
      <span className="ml-auto hidden sm:inline">
        {status === 'paused' ? 'auto-refresh off' : `auto-refresh ${VEHICLE_POLL_MS / 1000} s`}
      </span>
    </footer>
  )
}
