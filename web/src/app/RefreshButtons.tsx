import { PauseIcon, PlayIcon, RefreshIcon } from '../components/Icons'
import { useLiveData } from '../hooks/liveData'

const buttonClass =
  'text-fg-muted hover:text-fg hover:bg-main grid h-8 w-8 place-items-center rounded-sm disabled:opacity-40 disabled:hover:bg-transparent'

/** Manual refresh and the auto-refresh pause toggle (R7, DEC-027). */
export function RefreshButtons() {
  const { refresh, canRefresh, isFetching, paused, setPaused } = useLiveData()
  return (
    <>
      <button
        type="button"
        onClick={refresh}
        disabled={!canRefresh}
        aria-label="Refresh now"
        title="Refresh now"
        className={buttonClass}
      >
        <RefreshIcon className={isFetching ? 'animate-spin' : ''} />
      </button>
      <button
        type="button"
        onClick={() => setPaused(!paused)}
        aria-pressed={paused}
        aria-label="Pause auto-refresh"
        title={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
        className={`${buttonClass} ${paused ? 'text-accent' : ''}`}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
    </>
  )
}
