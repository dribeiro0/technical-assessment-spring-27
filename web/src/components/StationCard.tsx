import { useState } from 'react'
import { alertWhen, effectText } from '../domain/lineStatus'
import { groupDepartures, type DepartureGroup } from '../domain/departures'
import { formatAgeLong } from '../domain/freshness'
import { getLine } from '../domain/lines'
import { minutesAway, shortEta } from '../domain/predictions'
import { useNetwork } from '../hooks/useNetwork'
import { useLiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'
import { useSavedCommutes } from '../hooks/useSavedCommutes'
import { useStationDepartures } from '../hooks/useStationDepartures'
import { useViewParams } from '../hooks/useViewParams'
import { CommuteForm } from './CommuteForm'
import { FloatingCard } from './FloatingCard'

/**
 * The station card: tap a station on the map (or a stop on a train's strip) to see
 * when the next trains leave it, grouped by line and destination, with countdowns.
 * From here a rider can save the station as a commute; the form opens in the card.
 */
export function StationCard({ stationId, onClose }: { stationId: string; onClose: () => void }) {
  const now = useNow(1000)
  const { data: network, isPending: networkLoading } = useNetwork()
  const { data, isPending, isError, dataUpdatedAt } = useStationDepartures(stationId)
  const station = network?.stations.find((s) => s.id === stationId)
  // Names come with the line data; until it loads, say so rather than show a blank title.
  const name = station?.name ?? (networkLoading ? 'Loading station…' : 'Station')
  const groups = data ? groupDepartures(data, now) : []
  // A one-line station takes that line's colour; transfer stations stay navy.
  const color = station && station.lines.length === 1 ? getLine(station.lines[0]).color : undefined
  const { commutes, add } = useSavedCommutes()
  const { selectCommute, selectAlert } = useViewParams()
  const [saving, setSaving] = useState(false)
  const savedHere = commutes.filter((c) => c.stationId === stationId)
  // Official alerts that name this station (closures, suspensions through it).
  const { alerts } = useLiveData()
  const stationAlerts = alerts.filter((a) => a.entities.some((e) => e.stationId === stationId))

  if (saving) {
    return (
      <FloatingCard
        label={`Save ${name} as a commute`}
        color={color}
        onClose={onClose}
        closeLabel="Close"
      >
        <div className="px-4 pt-3 pb-4">
          <h2 className="mb-3 pr-10 text-base font-bold">Save {name} as my commute</h2>
          <CommuteForm
            presetStationId={stationId}
            onSave={(input) => {
              const result = add(input)
              if (result.ok) selectCommute(result.commute.id)
              return result
            }}
            onCancel={() => setSaving(false)}
          />
        </div>
      </FloatingCard>
    )
  }

  return (
    <FloatingCard
      label={`${name} departures`}
      color={color}
      onClose={onClose}
      closeLabel="Close station departures"
    >
      <div className="px-4 pt-3 pr-12">
        <div className="flex flex-wrap gap-1.5">
          {(station?.lines ?? []).map((id) => {
            const line = getLine(id)
            return (
              <span
                key={id}
                className="bg-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: line.color }}
                />
                {line.name}
              </span>
            )
          })}
        </div>
        <h2 className="mt-1.5 text-xl font-bold tracking-tight">{name}</h2>
        <p className="text-fg-muted text-xs">Next trains leaving this station</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {savedHere.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCommute(c.id)}
              className="bg-chrome text-chrome-fg h-7 rounded-full px-3 text-xs font-semibold"
            >
              <span aria-hidden="true">★ </span>
              {c.name}
              <span className="sr-only">: open this saved commute</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="border-control text-fg h-7 rounded-full border px-3 text-xs font-semibold"
          >
            <span aria-hidden="true">☆ </span>
            {savedHere.length > 0 ? 'Save another commute here' : 'Save as my commute'}
          </button>
        </div>
      </div>

      {stationAlerts.length > 0 && (
        <section aria-label="MBTA alerts at this station" className="bg-chip mt-2.5 px-4 py-2">
          {stationAlerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => selectAlert(alert.id)}
              className="block w-full py-1 text-left text-xs"
            >
              <span
                className={`font-semibold ${
                  alert.timing === 'upcoming' ? 'text-fg-secondary' : 'text-warn'
                }`}
              >
                <span aria-hidden="true">{alert.timing === 'upcoming' ? '◇ ' : '▲ '}</span>
                {alert.timing === 'upcoming' ? 'Upcoming · ' : ''}
                {effectText(alert.effect)} · {alertWhen(alert)}
              </span>
              <span className="text-fg line-clamp-2">{alert.header}</span>
            </button>
          ))}
        </section>
      )}

      <div className="mt-2.5">
        {isPending ? (
          <p className="text-fg-muted border-border border-t px-4 py-4 text-sm">
            Loading departures…
          </p>
        ) : isError && !data ? (
          <p className="text-fg-muted border-border border-t px-4 py-4 text-sm">
            Departures are unavailable right now.
          </p>
        ) : groups.length === 0 ? (
          <p className="text-fg-muted border-border border-t px-4 py-4 text-sm">
            No trains are expected to leave here right now.
          </p>
        ) : (
          <ul aria-label="Next departures">
            {groups.map((group) => (
              <DepartureRow key={group.key} group={group} now={now} />
            ))}
          </ul>
        )}
      </div>

      <p className="text-fg-muted border-border bg-main border-t px-4 py-2.5 font-mono text-[11px]">
        From MBTA predictions
        {data && dataUpdatedAt ? ` · updated ${formatAgeLong(dataUpdatedAt, now)}` : ''}
      </p>
    </FloatingCard>
  )
}

function DepartureRow({ group, now }: { group: DepartureGroup; now: number }) {
  const line = getLine(group.line)
  const [first, ...later] = group.times
  const next = minutesAway(first, now)
  const destination = `${group.branch ? `${group.branch} · ` : ''}${group.headsign}`
  const laterText = later.map((t) => shortEta(t, now)).join(' · ')

  return (
    <li className="border-border grid grid-cols-[4px_1fr_auto] items-center gap-3 border-t py-2.5 pr-4 pl-4">
      <span
        aria-hidden="true"
        className="h-full min-h-8 rounded-full"
        style={{ background: line.color }}
      />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold">
          <span aria-hidden="true" className="text-fg-muted font-normal">
            →{' '}
          </span>
          {destination}
        </p>
        <p className="text-fg-muted text-xs">{line.name}</p>
      </div>
      <div className="text-right">
        <p className="text-accent leading-none font-bold">
          <span className="text-xl">{next.value}</span>
          {next.unit && <span className="ml-0.5 text-xs font-semibold">{next.unit}</span>}
        </p>
        {laterText && <p className="text-fg-muted mt-1 font-mono text-[11px]">then {laterText}</p>}
      </div>
      <span className="sr-only">
        {line.name} to {destination}: {next.unit ? `${next.value} minutes` : 'now'}
        {laterText ? `, then ${laterText}` : ''}.
      </span>
    </li>
  )
}
