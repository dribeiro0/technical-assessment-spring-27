import { useState } from 'react'
import { walkFromHere, type Commute } from '../domain/commute'
import { routeColor } from '../domain/lines'
import { useLocation, type LocationState } from '../hooks/useLocation'
import { useNetwork } from '../hooks/useNetwork'
import { useSavedCommutes } from '../hooks/useSavedCommutes'
import { CommuteDetail, type WalkTime } from './CommuteDetail'
import { CommuteForm } from './CommuteForm'
import { FloatingCard } from './FloatingCard'

const action = 'border-control text-fg h-8 rounded-md border px-3 text-xs font-semibold'

/**
 * A saved commute, in the same floating card as a train or a station (?commute=<id>).
 * Shows when to leave and the next departures; edit, reverse and delete happen in the
 * card itself. The walk to the station comes from the rider's location when they have
 * turned it on, and from the minutes they typed otherwise.
 */
export function CommuteCard({ commute, onClose }: { commute: Commute; onClose: () => void }) {
  const { update, remove, reverse } = useSavedCommutes()
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const { location, turnOn, turnOff } = useLocation()
  const { data: network } = useNetwork()
  const station = network?.stations.find((s) => s.id === commute.stationId)

  const estimate = location.status === 'ok' && station ? walkFromHere(location.here, station) : null
  const walk: WalkTime =
    estimate?.kind === 'walk'
      ? { minutes: estimate.minutes, source: 'location' }
      : { minutes: commute.walkMin, source: 'setting' }

  return (
    <FloatingCard
      label={`My commute: ${commute.name}`}
      color={routeColor(commute.routeId)}
      onClose={onClose}
      closeLabel="Close commute"
    >
      {mode === 'edit' ? (
        <div className="px-4 pt-3 pb-4">
          <h2 className="mb-3 pr-10 text-base font-bold">Edit {commute.name}</h2>
          <CommuteForm
            initial={commute}
            onSave={(input) => {
              const result = update(commute.id, input)
              if (result.ok) setMode('view')
              return result
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      ) : (
        <>
          <CommuteDetail
            commute={commute}
            walk={walk}
            walkControl={
              <WalkControl
                location={location}
                estimate={estimate}
                stationKnown={Boolean(station)}
                typedMin={commute.walkMin}
                onTurnOn={turnOn}
                onTurnOff={turnOff}
              />
            }
          />
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {mode === 'delete' ? (
              <>
                <span className="text-fg text-sm font-semibold">Delete “{commute.name}”?</span>
                <button
                  type="button"
                  onClick={() => {
                    remove(commute.id)
                    onClose()
                  }}
                  className="bg-danger h-8 rounded-md px-3 text-xs font-semibold text-white"
                >
                  Delete
                </button>
                <button type="button" autoFocus onClick={() => setMode('view')} className={action}>
                  Keep it
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode('edit')} className={action}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => reverse(commute.id)}
                  className={action}
                  aria-label={
                    commute.destinationName
                      ? `Reverse: ${commute.destinationName} to ${commute.stationName}`
                      : 'Reverse direction'
                  }
                >
                  ⇄ Reverse
                </button>
                <button
                  type="button"
                  onClick={() => setMode('delete')}
                  className={`${action} text-danger`}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </>
      )}
    </FloatingCard>
  )
}

/** Where the walking time comes from, and the switch to use location for it. */
function WalkControl({
  location,
  estimate,
  stationKnown,
  typedMin,
  onTurnOn,
  onTurnOff,
}: {
  location: LocationState
  estimate: ReturnType<typeof walkFromHere> | null
  stationKnown: boolean
  typedMin: number
  onTurnOn: () => void
  onTurnOff: () => void
}) {
  const usual = `your usual ${typedMin} min walk`
  const link = 'text-accent font-semibold underline underline-offset-2'
  let text: React.ReactNode

  switch (location.status) {
    case 'off':
      return (
        <div className="border-border border-t px-4 py-2.5 text-xs">
          <button type="button" onClick={onTurnOn} className={link}>
            Use my location for the walk
          </button>
          <span className="text-fg-muted">
            {' '}
            · now using {usual}. Your location stays on this device.
          </span>
        </div>
      )
    case 'asking':
      text = 'Finding your location…'
      break
    case 'denied':
      text = `Location is blocked for this site, so ${usual} is used. You can allow it in your browser’s site settings.`
      break
    case 'unavailable':
      text = `Couldn’t find your location, so ${usual} is used.`
      break
    case 'ok':
      text = !stationKnown
        ? `Station position not loaded yet, so ${usual} is used.`
        : estimate?.kind === 'too-far'
          ? `You’re about ${(estimate.metres / 1000).toFixed(1)} km away, too far to walk, so ${usual} is used.`
          : `≈ ${estimate?.kind === 'walk' ? estimate.minutes : typedMin} min walk from where you are (straight-line estimate).`
      break
  }

  return (
    <div className="border-border text-fg-muted border-t px-4 py-2.5 text-xs">
      {text}{' '}
      {location.status === 'denied' ? (
        <button type="button" onClick={onTurnOn} className={link}>
          Try again
        </button>
      ) : (
        <button type="button" onClick={onTurnOff} className={link}>
          Stop using location
        </button>
      )}
    </div>
  )
}
