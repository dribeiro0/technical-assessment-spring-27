import { useLiveData } from '../hooks/liveData'
import { useNow } from '../hooks/useNow'

const clock = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/**
 * Error panel for a failed first load (DEC-024): a small panel, never a blank page.
 */
export function ErrorPanel() {
  const { status, errorMessage, refresh, canRefresh } = useLiveData()
  if (status !== 'error') return null
  return (
    <div className="absolute inset-0 z-[1000] grid place-items-center p-4">
      <div
        role="alert"
        className="bg-card w-full max-w-sm rounded-xl p-5 shadow-[var(--shadow-float)]"
      >
        <h2 className="text-fg text-sm font-semibold">Can't load live trains</h2>
        <p className="text-fg-secondary mt-1 text-xs leading-relaxed">
          {errorMessage ?? 'The MBTA feed did not respond.'}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={!canRefresh}
          className="bg-chrome text-chrome-fg mt-4 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

/** Loading notice for the first fetch. */
export function LoadingNotice() {
  const { status } = useLiveData()
  if (status !== 'loading') return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
      <p
        role="status"
        className="bg-card text-fg-secondary rounded-full px-4 py-1.5 text-xs shadow-[var(--shadow-float)]"
      >
        Loading live trains…
      </p>
    </div>
  )
}

/**
 * Explains why on-screen data may be old, while keeping it visible:
 * a failed refresh, stale data, a rate limit or a paused feed.
 */
export function StaleBanner() {
  const { status, lastSuccessAt, retryAt, errorMessage } = useLiveData()
  const now = useNow(1000)
  if (lastSuccessAt === null) return null

  let message: string | null = null
  if (status === 'rate-limited' && retryAt) {
    const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
    message = `MBTA rate limit reached. Retrying in ${seconds} s. Showing data from ${clock(lastSuccessAt)}.`
  } else if (status === 'stale') {
    message = `Data may be out of date. Last update ${clock(lastSuccessAt)}.`
  } else if (status === 'refresh-failed') {
    message = `${errorMessage ?? 'Refresh failed.'} Showing data from ${clock(lastSuccessAt)}.`
  } else if (status === 'paused') {
    message = `Auto-refresh paused. Showing data from ${clock(lastSuccessAt)}.`
  }
  if (!message) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
      <p
        role="status"
        className="bg-card text-fg border-brand max-w-full rounded-full border px-4 py-1.5 text-center text-xs shadow-[var(--shadow-float)]"
      >
        {message}
      </p>
    </div>
  )
}
