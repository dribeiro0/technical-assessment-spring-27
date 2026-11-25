import { effectText, type LineAlert } from '../domain/lineStatus'
import { getLine } from '../domain/lines'
import { StatusMark } from './StatusMark'

interface Props {
  alerts: readonly LineAlert[]
  /** Text shown when there are no alerts. */
  emptyText: string
  unavailable?: boolean
}

/** Official MBTA alerts, most severe first. */
export function AlertList({ alerts, emptyText, unavailable = false }: Props) {
  if (unavailable) {
    return <p className="text-fg-muted text-xs">Alerts are unavailable right now.</p>
  }
  if (alerts.length === 0) {
    return <p className="text-fg-muted text-xs">{emptyText}</p>
  }
  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className={`border-l-[3px] pl-2.5 ${alert.level === 'major' ? 'border-danger' : 'border-warn'}`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <StatusMark level={alert.level} />
            <span className="text-fg-secondary font-medium">{effectText(alert.effect)}</span>
            <span className="text-fg-muted">
              {alert.lines.map((id) => getLine(id).name).join(', ')}
            </span>
          </div>
          <p className="text-fg mt-0.5 text-xs leading-relaxed">{alert.header}</p>
        </li>
      ))}
    </ul>
  )
}
