import {
  commuteToward,
  recommendDeparture,
  type Commute,
  type CommuteDeparture,
  type LeaveAdvice,
} from '../domain/commute'
import { formatAgeLong } from '../domain/freshness'
import { routeLabel } from '../domain/lines'
import { minutesAway } from '../domain/predictions'
import { useCommuteDepartures } from '../hooks/useCommuteDepartures'
import { useNow } from '../hooks/useNow'

/** The walking time the advice uses, and where it came from. */
export interface WalkTime {
  minutes: number
  /** "location": estimated from where the rider is now; "setting": the minutes they typed. */
  source: 'location' | 'setting'
}

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
})

/**
 * The body of a commute card: when to leave, the next departures with where each time
 * comes from (LIVE prediction or SCHEDULED timetable), and the source and age of the data.
 * The card around it (CommuteCard) supplies the frame, the walking time and the actions.
 */
export function CommuteDetail({
  commute,
  walk,
  walkControl,
}: {
  commute: Commute
  walk: WalkTime
  /** Shown under the advice: the "use my location" control and its status. */
  walkControl?: React.ReactNode
}) {
  const now = useNow(1000)
  const { status, departures, updatedAt, stale, errorMessage } = useCommuteDepartures(commute, now)
  const scheduled = departures[0]?.source === 'scheduled'
  const toward = commuteToward(commute)

  return (
    <div>
      <header className="px-4 pt-3 pr-12 pb-3">
        <p className="text-fg-muted text-xs font-semibold">
          <span aria-hidden="true">★ </span>My commute · {routeLabel(commute.routeId)} · toward{' '}
          {toward}
        </p>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight">{commute.name}</h2>
        <p className="text-fg-secondary text-sm">
          {commute.stationName}
          {commute.destinationName && (
            <>
              {' '}
              <span aria-hidden="true">→</span>
              <span className="sr-only">to</span> {commute.destinationName}
            </>
          )}
        </p>
      </header>

      {status === 'ok' && (
        <Advice
          departures={departures}
          now={now}
          commute={commute}
          walk={walk}
          stale={stale}
          updatedAt={updatedAt}
        />
      )}
      {walkControl}

      <div className="border-border border-t">
        {status === 'loading' ? (
          <Message>Loading departures…</Message>
        ) : status === 'error' ? (
          <Message role="alert">
            Departures are unavailable right now. {errorMessage ?? ''} Your commute is still saved.
          </Message>
        ) : status === 'none' ? (
          <Message>No more trains are expected in this direction right now.</Message>
        ) : (
          <ul aria-label={`Next trains from ${commute.stationName} toward ${toward}`}>
            {departures.map((d) => (
              <DepartureRow key={d.tripId} departure={d} now={now} stale={stale} />
            ))}
          </ul>
        )}
      </div>

      {/* The data source only means something once departures have loaded. */}
      {(status === 'ok' || status === 'none') && (
        <p className="text-fg-muted border-border bg-main border-t px-4 py-2.5 font-mono text-[11px]">
          {scheduled
            ? 'From the MBTA timetable: no live predictions right now'
            : 'From MBTA live predictions'}
          {updatedAt ? ` · updated ${formatAgeLong(updatedAt, now)}` : ''}
          {errorMessage && status === 'ok' && (
            <span className="text-warn block font-sans font-semibold">
              Latest refresh failed: {errorMessage}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function Advice({
  departures,
  now,
  commute,
  walk,
  stale,
  updatedAt,
}: {
  departures: CommuteDeparture[]
  now: number
  commute: Commute
  walk: WalkTime
  stale: boolean
  updatedAt: number | null
}) {
  // Advice built on old data could make someone miss a train, so stale data gets none.
  if (stale) {
    return (
      <div className="bg-chip text-warn px-4 py-3 text-sm font-semibold">
        Times may be out of date
        {updatedAt ? ` (updated ${formatAgeLong(updatedAt, now)})` : ''}. No leave-time advice until
        fresh data arrives.
      </div>
    )
  }

  const rec = recommendDeparture(departures, now, walk.minutes, commute.bufferMin)
  const budget = `${walk.minutes} min walk${
    walk.source === 'location' ? ' from where you are' : ''
  } + ${commute.bufferMin} min buffer`
  if (!rec) {
    return (
      <div className="bg-chip px-4 py-3">
        <p className="text-danger text-lg font-bold">You may miss these trains</p>
        <p className="text-fg-muted text-xs">
          With {budget}, none of the listed trains is reachable.
        </p>
      </div>
    )
  }

  const source = rec.departure.source === 'scheduled' ? ' Based on the timetable.' : ''
  return (
    <div className="bg-chip px-4 py-3">
      {rec.missed > 0 && (
        <p className="text-warn text-xs font-semibold">
          {rec.missed === 1
            ? 'You may miss the next train. Aim for this one:'
            : `You may miss the next ${rec.missed} trains. Aim for this one:`}
        </p>
      )}
      <p className="text-accent text-2xl leading-tight font-bold">{adviceText(rec.advice)}</p>
      <p className="text-fg-muted text-xs">
        For the {clock.format(rec.departure.at)} train ({budget}).{source}
      </p>
    </div>
  )
}

function adviceText(advice: LeaveAdvice): string {
  if (advice.kind === 'leave-now') return 'Leave now'
  if (advice.kind === 'leave-in') return `Leave in ${advice.minutes} min`
  return 'You may miss this one'
}

function DepartureRow({
  departure,
  now,
  stale,
}: {
  departure: CommuteDeparture
  now: number
  stale: boolean
}) {
  const live = departure.source === 'live'
  const away = minutesAway(departure.at, now)
  const time = clock.format(departure.at)
  const destination = `${departure.branch ? `${departure.branch} · ` : ''}${departure.headsign}`

  return (
    <li className="border-border grid grid-cols-[1fr_auto] items-center gap-3 border-t px-4 py-2.5 first:border-t-0">
      {/* Screen readers get one clear sentence; the visual pieces below are hidden from them. */}
      <span className="sr-only">
        {destination}: {live ? 'live prediction' : 'scheduled time'}, {time}
        {stale
          ? ', may be out of date'
          : away.unit
            ? `, in ${away.value} minutes`
            : ', leaving now'}
        .
      </span>
      <div aria-hidden="true" className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold">
          <span aria-hidden="true" className="text-fg-muted font-normal">
            →{' '}
          </span>
          {destination}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs">
          <span
            className={`rounded px-1.5 py-px font-mono text-[10px] font-semibold tracking-wide ${
              live ? 'bg-chrome text-chrome-fg' : 'border-control text-fg-secondary border'
            }`}
          >
            {live ? 'LIVE' : 'SCHEDULED'}
          </span>
          <span className="text-fg-muted font-mono">{time}</span>
        </p>
      </div>
      {/* Stale live times stop counting down: a ticking number would look live when it isn't. */}
      <p aria-hidden="true" className="text-accent text-right leading-none font-bold">
        {stale ? (
          <span className="text-fg-muted text-sm">{time}</span>
        ) : (
          <>
            <span className="text-xl">{away.value}</span>
            {away.unit && <span className="ml-0.5 text-xs font-semibold">{away.unit}</span>}
          </>
        )}
      </p>
    </li>
  )
}

function Message({ children, role }: { children: React.ReactNode; role?: 'alert' }) {
  return (
    <p role={role} className="text-fg-muted px-4 py-4 text-sm">
      {children}
    </p>
  )
}
