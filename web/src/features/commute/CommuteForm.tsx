import { useId, useMemo, useState, type FormEvent } from 'react'
import { MAX_BUFFER_MIN, MAX_WALK_MIN, type Commute } from '../../domain/commute'
import { directionDestination } from '../../domain/lines'
import { useRoutesAtStation, useStationsOnRoute } from '../../hooks/useCommuteOptions'
import { useNetwork } from '../../hooks/useNetwork'
import type { CommuteInput } from '../../hooks/useSavedCommutes'
import { routeLabel } from './routeLabel'

const field = 'border-fg-muted bg-card text-fg h-9 w-full rounded-md border px-2 text-sm'
const label = 'text-fg mb-1 block text-xs font-semibold'
const hint = 'text-fg-muted mt-1 text-[11px]'

/**
 * Add or edit a commute (C1). Station by name, so no location permission is ever needed.
 * Each choice narrows the next: station -> the routes that stop there -> direction ->
 * optional destination on that route.
 */
export function CommuteForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Commute
  onSave: (input: CommuteInput) => { ok: true } | { ok: false; error: string }
  onCancel?: () => void
}) {
  const id = useId()
  const { data: network, isError: networkFailed } = useNetwork()
  const [name, setName] = useState(initial?.name ?? '')
  const [stationId, setStationId] = useState(initial?.stationId ?? '')
  const [routeId, setRouteId] = useState(initial?.routeId ?? '')
  const [directionId, setDirectionId] = useState<0 | 1 | null>(initial?.directionId ?? null)
  const [destinationId, setDestinationId] = useState(initial?.destinationId ?? '')
  const [walkMin, setWalkMin] = useState(String(initial?.walkMin ?? 5))
  const [bufferMin, setBufferMin] = useState(String(initial?.bufferMin ?? 2))
  const [error, setError] = useState<string | null>(null)

  const stations = useMemo(() => {
    const list = [...(network?.stations ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    // Editing while the station list is unavailable: still show the saved station.
    if (initial && !list.some((s) => s.id === initial.stationId)) {
      list.unshift({ id: initial.stationId, name: initial.stationName, lat: 0, lon: 0, lines: [] })
    }
    return list
  }, [network, initial])
  const routes = useRoutesAtStation(stationId || null)
  const destinationsQuery = useStationsOnRoute(routeId || null)
  const routeChoices = routes.data ?? (initial && routeId ? [routeId] : [])

  // The destination list comes from the network. If it has not loaded (slow or failing),
  // keep the saved destination as a choice, so saving an edit never quietly drops it.
  const destinations = useMemo(() => {
    const list = destinationsQuery.data ?? []
    const saved =
      initial?.destinationId && initial.destinationName && routeId === initial.routeId
        ? { id: initial.destinationId, name: initial.destinationName }
        : null
    return saved && !list.some((s) => s.id === saved.id) ? [saved, ...list] : list
  }, [destinationsQuery.data, initial, routeId])

  const pickStation = (next: string) => {
    setStationId(next)
    setRouteId('')
    setDirectionId(null)
    setDestinationId('')
  }
  const pickRoute = (next: string) => {
    setRouteId(next)
    setDirectionId(null)
    setDestinationId('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!stationId || !routeId || directionId === null) {
      setError('Choose a station, a line and a direction.')
      return
    }
    const station = stations.find((s) => s.id === stationId)
    const destination = destinations.find((s) => s.id === destinationId)
    const result = onSave({
      name,
      stationId,
      stationName: station?.name ?? initial?.stationName ?? stationId,
      routeId,
      directionId,
      destinationId: destination ? destination.id : null,
      destinationName: destination ? destination.name : null,
      walkMin: Number(walkMin),
      bufferMin: Number(bufferMin),
    })
    setError(result.ok ? null : result.error)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-describedby={`${id}-intro`}>
      <p id={`${id}-intro`} className="text-fg-muted text-xs">
        Pick your station by name (no location needed). Everything is saved on this device only.
      </p>

      <div>
        <label htmlFor={`${id}-name`} className={label}>
          Name
        </label>
        <input
          id={`${id}-name`}
          className={field}
          value={name}
          maxLength={40}
          placeholder="Work"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor={`${id}-station`} className={label}>
          Station you board at
        </label>
        <select
          id={`${id}-station`}
          className={field}
          value={stationId}
          onChange={(e) => pickStation(e.target.value)}
          disabled={stations.length === 0}
        >
          <option value="">
            {stations.length > 0
              ? 'Choose a station'
              : networkFailed
                ? 'Stations unavailable, try again shortly'
                : 'Loading stations…'}
          </option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className={hint}>Type the first letters to jump to a station.</p>
      </div>

      {stationId && (
        <fieldset>
          <legend className={label}>Line</legend>
          {routes.isPending && routeChoices.length === 0 ? (
            <p className={hint}>Finding lines at this station…</p>
          ) : routes.isError && routeChoices.length === 0 ? (
            <p className="text-danger text-xs" role="alert">
              Could not load the lines for this station. Try again in a minute.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {routeChoices.map((r) => (
                <Choice
                  key={r}
                  name={`${id}-route`}
                  checked={routeId === r}
                  onChange={() => pickRoute(r)}
                >
                  {routeLabel(r)}
                </Choice>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {routeId && (
        <fieldset>
          <legend className={label}>Direction</legend>
          <div className="flex flex-wrap gap-2">
            {([0, 1] as const).map((d) => (
              <Choice
                key={d}
                name={`${id}-direction`}
                checked={directionId === d}
                onChange={() => setDirectionId(d)}
              >
                Toward {directionDestination(routeId, d)}
              </Choice>
            ))}
          </div>
        </fieldset>
      )}

      {routeId && (
        <div>
          <label htmlFor={`${id}-destination`} className={label}>
            Where you get off <span className="text-fg-muted font-normal">(optional)</span>
          </label>
          <select
            id={`${id}-destination`}
            className={field}
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
          >
            <option value="">No destination</option>
            {destinations
              .filter((s) => s.id !== stationId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <p className={hint}>Lets you flip the commute for the trip home.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-walk`} className={label}>
            Walk to station (min)
          </label>
          <input
            id={`${id}-walk`}
            className={field}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_WALK_MIN}
            step={1}
            value={walkMin}
            onChange={(e) => setWalkMin(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-buffer`} className={label}>
            Extra buffer (min)
          </label>
          <input
            id={`${id}-buffer`}
            className={field}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_BUFFER_MIN}
            step={1}
            value={bufferMin}
            onChange={(e) => setBufferMin(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm font-semibold">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-chrome text-chrome-fg h-9 rounded-md px-4 text-sm font-semibold"
        >
          {initial ? 'Save changes' : 'Save commute'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border-control text-fg h-9 rounded-md border px-4 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

/** A radio button styled as a pill; the native input keeps keyboard and screen-reader support. */
function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string
  checked: boolean
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-brand)] ${
        checked ? 'border-chrome bg-chrome text-chrome-fg font-semibold' : 'border-control text-fg'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  )
}
