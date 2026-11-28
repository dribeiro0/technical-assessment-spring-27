import { ChaosBadge, ChaosExplanation } from '../../components/ChaosScore'
import { MODEL_VERSION, WEIGHTS } from '../../domain/chaos'
import { LINES } from '../../domain/lines'
import { useChaosScores } from '../../hooks/useChaosScores'
import { useNow } from '../../hooks/useNow'

/**
 * The experimental Chaos Score (Sprint 7 step e, DEC-062): the whole subway and each line,
 * every score openable to the factors behind it (03 section 12).
 */
export function ChaosPanel() {
  const scores = useChaosScores()
  const now = useNow(15_000)

  return (
    <section
      aria-labelledby="chaos-title"
      className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_1px_3px_rgb(29_43_68_/0.08)]"
    >
      <header className="border-border border-b px-4 py-3">
        <h2 id="chaos-title" className="text-fg flex items-center gap-2 text-sm font-semibold">
          Chaos score
          <span className="bg-chip text-fg-secondary rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Experimental
          </span>
        </h2>
        <p className="text-fg-muted mt-0.5 text-xs">
          How far service is from usual for this hour, 0 (as usual) to 100 (severe failure). Weights
          are not yet calibrated. Open any score to see what it rests on.
        </p>
      </header>

      {!scores ? (
        <p className="text-fg-muted px-4 py-6 text-xs">Loading the inputs…</p>
      ) : (
        <>
          <details className="border-border group border-b">
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span className="text-fg text-sm font-semibold">Whole subway</span>
              <ChaosBadge score={scores.network} size="lg" />
            </summary>
            <div className="px-4 pb-3">
              <ChaosExplanation score={scores.network} now={now} />
            </div>
          </details>
          <ul>
            {scores.routes.map((s, i) => (
              <li key={LINES[i].id} className="border-border border-t first:border-t-0">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="text-fg inline-flex items-center gap-2 text-xs">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5"
                        style={{ background: LINES[i].color }}
                      />
                      {s.label}
                    </span>
                    <ChaosBadge score={s} />
                  </summary>
                  <div className="px-4 pb-3">
                    <ChaosExplanation score={s} now={now} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="border-border border-t">
        <summary className="text-fg-secondary cursor-pointer px-4 py-2.5 text-xs font-semibold">
          How we measure chaos
        </summary>
        <div className="text-fg-muted space-y-2 px-4 pb-3 text-xs">
          <p>
            Model {MODEL_VERSION}: five factors, each 0–100, weighted{' '}
            {Math.round(WEIGHTS.wait * 100)}% excess waiting,{' '}
            {Math.round(WEIGHTS.disruptions * 100)}% disruptions, {Math.round(WEIGHTS.travel * 100)}
            % excess travel time, {Math.round(WEIGHTS.unpredictability * 100)}% unpredictability and{' '}
            {Math.round(WEIGHTS.availability * 100)}% availability.
          </p>
          <p>
            <span className="text-fg-secondary font-semibold">Waiting:</span> the expected wait for
            a rider arriving at random, E[H²] ÷ 2E[H], from gaps between trains at every stop in the
            last 30 minutes (EnRoute&apos;s own collector), against the same figure from MBTA LAMP
            history for this hour and kind of day. Twice the usual wait scores 100.
          </p>
          <p>
            <span className="text-fg-secondary font-semibold">Unpredictability:</span> the longest
            1-in-10 gap now against usual.{' '}
            <span className="text-fg-secondary font-semibold">Availability:</span> trains running
            against the usual count; half as many scores 100.{' '}
            <span className="text-fg-secondary font-semibold">Disruptions:</span> the worst active
            official alert (several alerts for one incident do not add up). A suspension or shuttle
            keeps its line at “High” or worse.
          </p>
          <p>
            Travel time is not measured yet, so every score is provisional and rests on the 80% that
            is. Without alerts, or with less than half the model measured, the score is Unknown —
            missing data is never shown as smooth service. The whole-subway score weights each line
            by the trains it usually runs at this hour.
          </p>
        </div>
      </details>
    </section>
  )
}
