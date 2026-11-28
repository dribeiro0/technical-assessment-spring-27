import { AlertIcon } from '../components/Icons'
import { useLiveData } from '../hooks/liveData'
import { ALL_ALERTS, useViewParams } from '../hooks/useViewParams'

/**
 * Opens the list of MBTA alerts as a card over the map (DEC-056). Sits with refresh and
 * pause on the navy frame, with a badge counting alerts in effect now; a warning dot
 * when alerts could not be loaded, so "unavailable" never reads as "none".
 */
export function AlertsButton() {
  const { alerts, alertsState } = useLiveData()
  const { alertId, selectAlert } = useViewParams()
  const now = alerts.filter((a) => a.timing === 'active').length
  const upcoming = alerts.length - now
  const open = alertId !== null

  const label =
    alertsState === 'unavailable'
      ? 'MBTA alerts: unavailable right now'
      : alertsState === 'loading'
        ? 'MBTA alerts: loading'
        : `MBTA alerts: ${now} now, ${upcoming} upcoming`

  return (
    <button
      type="button"
      onClick={() => selectAlert(open ? null : ALL_ALERTS)}
      aria-pressed={open}
      aria-label={label}
      title={label}
      className={`text-chrome-muted hover:text-chrome-fg relative grid h-8 w-8 place-items-center rounded-md hover:bg-white/10 ${
        open ? 'text-chrome-fg bg-white/10' : ''
      }`}
    >
      <AlertIcon />
      {alertsState === 'ok' && now > 0 && (
        <span
          aria-hidden="true"
          className="bg-danger absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[10px] leading-none font-semibold text-white"
        >
          {now}
        </span>
      )}
      {alertsState === 'unavailable' && (
        <span
          aria-hidden="true"
          className="bg-warn absolute top-0.5 right-0.5 h-2 w-2 rounded-full"
        />
      )}
    </button>
  )
}
