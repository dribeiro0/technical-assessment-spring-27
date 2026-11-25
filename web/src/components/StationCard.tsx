import { groupDepartures, type DepartureGroup } from '../domain/departures'
import { formatAgeLong } from '../domain/freshness'
import { getLine } from '../domain/lines'
import { minutesAway, shortEta } from '../domain/predictions'
import { useNetwork } from '../hooks/useNetwork'
import { useNow } from '../hooks/useNow'
import { useStationDepartures } from '../hooks/useStationDepartures'
import { FloatingCard } from './FloatingCard'

/**
 * The station card: tap a station on the map (or a stop on a train's strip) to see
 * when the next trains leave it, grouped by line and destination, with countdowns.
 */
export function StationCard({ stationId, onClose }: { stationId: string; onClose: () => void }) {
  const now = useNow(1000)
  const { data: network } = useNetwork()
  const { data, isPending, isError, dataUpdatedAt } = useStationDepartures(stationId)
  const station = network?.stations.find((s) => s.id === stationId)
  const name = station?.name ?? 'Station'
  const groups = data ? groupDepartures(data, now) : []
  // A one-line station takes that line's colour; transfer stations stay navy.
  const color = station && station.lines.length === 1 ? getLine(station.lines[0]).color : undefined

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
      </div>

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
