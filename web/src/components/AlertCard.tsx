import { useState } from 'react'
import { formatAgeLong } from '../domain/freshness'
import { alertWhen, effectText, type LineAlert } from '../domain/lineStatus'
import { getLine } from '../domain/lines'
import { useNetwork } from '../hooks/useNetwork'
import { useNow } from '../hooks/useNow'
import { FloatingCard } from './FloatingCard'
import { StatusMark } from './StatusMark'

/** Descriptions longer than this start folded behind "More details". */
const SHORT_DESCRIPTION = 240

/**
 * One official MBTA alert, in the same floating card as a train, station or commute
 * (?alert=<id>). The map behind it lights up the affected stations or track. Always
 * labelled as the MBTA's own notice (planning file 05, section 1).
 */
export function AlertCard({ alert, onClose }: { alert: LineAlert; onClose: () => void }) {
  const now = useNow(10_000)
  const { data: network } = useNetwork()
  const [expanded, setExpanded] = useState(false)
  const upcoming = alert.timing === 'upcoming'

  const name = (id: string) => network?.stations.find((s) => s.id === id)?.name ?? null
  const closed = unique(
    alert.entities.filter((e) => !e.ride && e.stationId).map((e) => e.stationId!),
  )
  const suspended = unique(
    alert.entities.filter((e) => e.ride && e.stationId).map((e) => e.stationId!),
  )
  const routeWide = alert.entities.some((e) => e.stationId === null)
  const closedNames = closed.map(name).filter((n): n is string => !!n)

  const description = alert.description
  const long = (description?.length ?? 0) > SHORT_DESCRIPTION

  return (
    <FloatingCard
      label={`MBTA alert: ${effectText(alert.effect)}`}
      color={
        upcoming
          ? 'var(--color-control)'
          : alert.level === 'major'
            ? 'var(--color-danger)'
            : 'var(--color-warn)'
      }
      onClose={onClose}
      closeLabel="Close alert"
    >
      <div className="px-4 pt-3 pr-12 pb-3">
        <p className="flex flex-wrap items-center gap-x-2 text-xs">
          {upcoming ? (
            <span className="text-fg-secondary font-semibold">◇ Upcoming</span>
          ) : (
            <StatusMark level={alert.level} />
          )}
          <span className="text-fg-secondary font-semibold">{effectText(alert.effect)}</span>
          <span className="text-fg-muted">
            {alert.lines.map((id) => getLine(id).name).join(', ')}
          </span>
        </p>
        <h2 className="mt-1 text-base leading-snug font-bold">{alert.header}</h2>
        <p className="text-accent mt-1 font-mono text-xs font-semibold">{alertWhen(alert)}</p>
      </div>

      {(closedNames.length > 0 || suspended.length > 0 || routeWide) && (
        <div className="border-border bg-chip border-t px-4 py-2.5 text-xs">
          {closedNames.length > 0 && (
            <p>
              <span className="font-semibold">Closed: </span>
              {closedNames.join(', ')}
            </p>
          )}
          {suspended.length > 0 && (
            <p>
              <span className="font-semibold">No trains: </span>
              {suspended.length} stations, highlighted on the map
            </p>
          )}
          {routeWide && suspended.length === 0 && closedNames.length === 0 && (
            <p className="font-semibold">Affects the whole line</p>
          )}
        </div>
      )}

      {description && (
        <div className="border-border border-t px-4 py-3">
          <p
            className={`text-fg-secondary text-xs leading-relaxed whitespace-pre-line ${
              long && !expanded ? 'line-clamp-4' : ''
            }`}
          >
            {description}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="text-accent mt-1 text-xs font-semibold underline underline-offset-2"
            >
              {expanded ? 'Less' : 'More details'}
            </button>
          )}
        </div>
      )}

      <p className="text-fg-muted border-border bg-main border-t px-4 py-2.5 font-mono text-[11px]">
        Official MBTA alert
        {alert.updatedAt ? ` · updated ${updatedText(alert.updatedAt, now)}` : ''}
      </p>
    </FloatingCard>
  )
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
})

/** "12 min ago" today; a date once it is more than a day old ("Nov 16"), not "300 h ago". */
function updatedText(at: number, now: number): string {
  return now - at < 24 * 3600_000 ? formatAgeLong(at, now) : dayFormat.format(at)
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)]
}
