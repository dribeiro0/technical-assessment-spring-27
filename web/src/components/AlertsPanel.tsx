import { alertWhen, effectText, type LineAlert } from '../domain/lineStatus'
import { getLine } from '../domain/lines'
import { useLiveData } from '../hooks/liveData'
import { useViewParams } from '../hooks/useViewParams'
import { StatusMark } from './StatusMark'

/**
 * Official MBTA alerts in the sidebar (Sprint 5): those in effect now, then upcoming ones,
 * ranked by passenger impact. Choosing one opens its card over the map (?alert=), which
 * lights up the affected stations or track.
 */
export function AlertsPanel({ onChosen }: { onChosen?: () => void }) {
  const { alerts, alertsState } = useLiveData()
  const { alertId, selectAlert } = useViewParams()
  const active = alerts.filter((a) => a.timing === 'active')
  const upcoming = alerts.filter((a) => a.timing === 'upcoming')

  const choose = (id: string) => {
    selectAlert(alertId === id ? null : id)
    onChosen?.()
  }

  return (
    <section aria-labelledby="alerts-title" className="px-4 pb-1">
      <h2
        id="alerts-title"
        className="text-fg-muted flex items-baseline justify-between pt-3.5 pb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase"
      >
        <span>MBTA alerts</span>
        {alertsState === 'ok' && (
          <span className="font-mono tracking-normal normal-case">
            {active.length} now · {upcoming.length} upcoming
          </span>
        )}
      </h2>
      {alertsState === 'loading' ? (
        <p className="text-fg-muted pb-1 text-xs">Loading alerts…</p>
      ) : alertsState === 'unavailable' ? (
        // Never "no disruptions": we simply don't know (05, section 9).
        <p role="status" className="text-warn pb-1 text-xs font-semibold">
          Alerts are unavailable right now, so disruptions may not be shown.
        </p>
      ) : alerts.length === 0 ? (
        <p className="text-fg-muted pb-1 text-xs">No disruptions reported by the MBTA.</p>
      ) : (
        <>
          <AlertItems alerts={active} openId={alertId} onChoose={choose} />
          {upcoming.length > 0 && (
            <>
              <h3 className="text-fg-muted pt-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                Upcoming
              </h3>
              <AlertItems alerts={upcoming} openId={alertId} onChoose={choose} />
            </>
          )}
        </>
      )}
    </section>
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
