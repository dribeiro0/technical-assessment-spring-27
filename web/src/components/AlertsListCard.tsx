import { alertWhen, effectText, type LineAlert } from '../domain/lineStatus'
import { getLine } from '../domain/lines'
import { useLiveData } from '../hooks/liveData'
import { useViewParams } from '../hooks/useViewParams'
import { FloatingCard } from './FloatingCard'
import { StatusMark } from './StatusMark'

/**
 * Every MBTA alert, as a card over the map (DEC-056): opened from the alerts button on the
 * navy frame. In effect now first, then upcoming, ranked by passenger impact. Choosing one
 * opens its own card (?alert=<id>), which lights up the affected stations or track.
 */
export function AlertsListCard({ onClose }: { onClose: () => void }) {
  const { alerts, alertsState } = useLiveData()
  const { selectAlert } = useViewParams()
  const active = alerts.filter((a) => a.timing === 'active')
  const upcoming = alerts.filter((a) => a.timing === 'upcoming')

  return (
    <FloatingCard label="MBTA alerts" onClose={onClose} closeLabel="Close alerts">
      <div className="px-4 pt-3 pr-12 pb-1">
        <h2 className="text-base font-bold">MBTA alerts</h2>
        {alertsState === 'ok' && (
          <p className="text-fg-muted font-mono text-[11px]">
            {active.length} now · {upcoming.length} upcoming
          </p>
        )}
      </div>
      <div className="px-4 pt-2 pb-4">
        {alertsState === 'loading' ? (
          <p className="text-fg-muted text-xs">Loading alerts…</p>
        ) : alertsState === 'unavailable' ? (
          // Never "no disruptions": we simply don't know (05, section 9).
          <p role="status" className="text-warn text-xs font-semibold">
            Alerts are unavailable right now, so disruptions may not be shown.
          </p>
        ) : alerts.length === 0 ? (
          <p className="text-fg-muted text-xs">No disruptions reported by the MBTA.</p>
        ) : (
          <>
            <AlertItems alerts={active} openId={null} onChoose={selectAlert} />
            {upcoming.length > 0 && (
              <>
                <h3 className="text-fg-muted pt-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                  Upcoming
                </h3>
                <AlertItems alerts={upcoming} openId={null} onChoose={selectAlert} />
              </>
            )}
          </>
        )}
      </div>
    </FloatingCard>
  )
}

function AlertItems({
  alerts,
  openId,
  onChoose,
}: {
  alerts: LineAlert[]
  openId: string | null
  onChoose: (id: string) => void
}) {
  if (alerts.length === 0) return null
  return (
    <ul className="space-y-1">
      {alerts.map((alert) => {
        const open = alert.id === openId
        const upcoming = alert.timing === 'upcoming'
        return (
          <li key={alert.id}>
            <button
              type="button"
              aria-current={open ? 'true' : undefined}
              onClick={() => onChoose(alert.id)}
              className={`relative flex w-full flex-col gap-0.5 overflow-hidden rounded-lg border py-1.5 pr-2 pl-3.5 text-left ${
                open
                  ? 'border-select bg-chip ring-select ring-1'
                  : 'border-border bg-card hover:bg-chip/60'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1 ${
                  upcoming ? 'bg-control' : alert.level === 'major' ? 'bg-danger' : 'bg-warn'
                }`}
              />
              <span className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
                {upcoming ? (
                  <span className="text-fg-secondary font-semibold">◇ Upcoming</span>
                ) : (
                  <StatusMark level={alert.level} />
                )}
                <span className="text-fg-secondary font-medium">{effectText(alert.effect)}</span>
                <span className="text-fg-muted">
                  · {alert.lines.map((id) => getLine(id).name.replace(' line', '')).join(', ')}
                </span>
              </span>
              <span className="text-fg line-clamp-2 text-xs leading-snug">{alert.header}</span>
              <span className="text-fg-muted font-mono text-[10.5px]">{alertWhen(alert)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
