import type { Commute } from '../domain/commute'
import { useCommuteChaos } from '../hooks/useChaosScores'
import { useNow } from '../hooks/useNow'
import { ChaosBadge, ChaosExplanation } from './ChaosScore'

/**
 * The commute's experimental chaos score (step e, DEC-062): its own line and direction,
 * with alerts judged against the stretch it rides. Collapsed by default; the departures
 * and advice above stay the main answer.
 */
export function CommuteChaos({ commute }: { commute: Commute }) {
  const score = useCommuteChaos(commute)
  const now = useNow(15_000)
  if (!score) return null
  return (
    <details className="border-border border-t">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
        <span className="text-fg-secondary text-xs font-semibold">
          Chaos score{' '}
          <span className="text-fg-muted text-[10px] font-normal tracking-wide uppercase">
            experimental
          </span>
        </span>
        <ChaosBadge score={score} />
      </summary>
      <div className="px-4 pb-3">
        <ChaosExplanation score={score} now={now} />
      </div>
    </details>
  )
}
