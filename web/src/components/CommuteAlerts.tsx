import { useMemo } from 'react'
import { alertRelevance } from '../domain/alertRelevance'
import type { Commute } from '../domain/commute'
import { commuteFocus } from '../domain/commuteRoute'
import { alertWhen, effectText } from '../domain/lineStatus'
import { useLiveData } from '../hooks/liveData'
import { useNetwork } from '../hooks/useNetwork'
import { useViewParams } from '../hooks/useViewParams'

/**
 * Official alerts as they bear on one commute (Sprint 5, A4): the ones that affect the
 * trip, listed and openable; a count of those elsewhere on the route; nothing for other
 * routes. "Can't tell" and "unavailable" are said plainly, never shown as "no impact".
 */
export function CommuteAlerts({ commute }: { commute: Commute }) {
  const { alerts, alertsState } = useLiveData()
  const { data: network } = useNetwork()
  const { selectAlert } = useViewParams()
  const stretch = useMemo(
    () => (network ? (commuteFocus(network, commute)?.stationIds ?? null) : null),
    [network, commute],
  )

  if (alertsState === 'unavailable') {
    return (
      <Section>
        <p className="text-warn text-xs font-semibold">
          Alerts are unavailable right now, so disruptions on this trip may not be shown.
        </p>
      </Section>
    )
  }
  if (alertsState === 'loading') return null

  const rated = alerts.map((alert) => ({
    alert,
    relevance: alertRelevance(alert, commute, stretch),
  }))
  const direct = rated.filter((r) => r.relevance === 'direct').map((r) => r.alert)
  const unknown = rated.filter((r) => r.relevance === 'unknown').map((r) => r.alert)
  const elsewhere = rated.filter((r) => r.relevance === 'indirect').length
  if (direct.length === 0 && unknown.length === 0 && elsewhere === 0) return null

  return (
    <Section>
      {direct.length > 0 && (
        <>
          <p className="text-danger text-xs font-bold">
            <span aria-hidden="true">⚠ </span>
            {direct.length === 1
              ? 'An MBTA alert affects your trip'
              : `${direct.length} MBTA alerts affect your trip`}
          </p>
          <ul className="mt-1 space-y-1">
            {direct.map((alert) => (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => selectAlert(alert.id)}
                  className="hover:bg-chip w-full rounded-md text-left text-xs"
                >
                  <span className="text-fg-secondary font-semibold">
                    {alert.timing === 'upcoming' ? '◇ Upcoming · ' : ''}
                    {effectText(alert.effect)} · {alertWhen(alert)}
                  </span>
                  <span className="text-fg line-clamp-2 leading-snug">{alert.header}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {unknown.length > 0 && (
        <p className="text-fg-secondary mt-1 text-xs">
          {unknown.length === 1 ? '1 alert on this line' : `${unknown.length} alerts on this line`}{' '}
          may affect your trip; checking once the line map loads.
        </p>
      )}
      {elsewhere > 0 && (
        <p className="text-fg-muted mt-1 text-xs">
          {elsewhere === 1 ? '1 other alert' : `${elsewhere} other alerts`} on this line, away from
          your trip. See MBTA alerts in the sidebar.
        </p>
      )}
    </Section>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Alerts for this commute" className="border-border border-t px-4 py-2.5">
      {children}
    </section>
  )
}
