import { BAND_TEXT, type Band, type ChaosScore, type FactorStatus } from '../domain/chaos'
import { formatAgeLong } from '../domain/freshness'

// The experimental Chaos Score (step e, DEC-062), shown the same way wherever it appears.
// The band is always in words, never colour alone; UNKNOWN is said plainly.

const BAND_CLASS: Record<Band, string> = {
  smooth: 'text-fg-secondary',
  minor: 'text-warn',
  moderate: 'text-warn',
  high: 'text-danger',
  critical: 'text-danger',
}

const STATUS_TEXT: Record<FactorStatus, string> = {
  available: 'Measured',
  partial: 'Partly measured',
  unavailable: 'Not measured',
}

/** "34 · Minor chaos" or "Unknown", with "provisional" when part of the model is missing. */
export function ChaosBadge({ score, size = 'sm' }: { score: ChaosScore; size?: 'sm' | 'lg' }) {
  if (score.value === null || !score.band) {
    return <span className="text-fg-muted text-xs font-semibold">Unknown</span>
  }
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${BAND_CLASS[score.band]}`}>
      <span className={`font-mono font-bold ${size === 'lg' ? 'text-3xl' : 'text-sm'}`}>
        {score.value}
      </span>
      <span className={`font-semibold ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
        {BAND_TEXT[score.band]}
      </span>
      {score.provisional && (
        <span className="text-fg-muted text-[11px] font-normal">provisional</span>
      )}
    </span>
  )
}

/** Everything behind a score (03 section 7): factors, confidence, times, limits, version. */
export function ChaosExplanation({ score, now }: { score: ChaosScore; now: number }) {
  const scope =
    score.scope === 'network'
      ? 'Whole subway, from the line scores'
      : score.scope === 'commute'
        ? 'This commute: its line, its direction, alerts on its stretch'
        : 'This line, both directions'
  return (
    <div className="space-y-2 text-xs">
      <p className="text-fg-secondary">
        <span className="font-semibold">Scope:</span> {scope}.
      </p>
      <table className="w-full text-left">
        <caption className="sr-only">Factors behind the score for {score.label}</caption>
        <thead className="text-fg-muted">
          <tr>
            <th scope="col" className="py-1 pr-2 font-medium">
              {score.scope === 'network' ? 'Line' : 'Factor'}
            </th>
            <th scope="col" className="py-1 pr-2 font-medium">
              Weight
            </th>
            <th scope="col" className="py-1 pr-2 font-medium">
              Value
            </th>
            <th scope="col" className="hidden py-1 font-medium sm:table-cell">
              What was seen
            </th>
          </tr>
        </thead>
        <tbody>
          {score.factors.map((f) => (
            <tr key={f.key} className="border-border border-t align-top">
              <th scope="row" className="text-fg py-1.5 pr-2 font-normal">
                {f.label}
                <span className="text-fg-muted block text-[11px]">{STATUS_TEXT[f.status]}</span>
              </th>
              <td className="text-fg-secondary py-1.5 pr-2 font-mono">
                {Math.round(f.weight * 100)}%
              </td>
              <td className="text-fg py-1.5 pr-2 font-mono">
                {f.value === null ? '–' : Math.round(f.value)}
              </td>
              <td className="text-fg-muted hidden py-1.5 sm:table-cell">{f.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* On phones the details column is hidden above; list it here instead. */}
      <ul className="text-fg-muted space-y-1 sm:hidden">
        {score.factors.map((f) => (
          <li key={f.key}>
            <span className="text-fg-secondary font-semibold">{f.label}:</span> {f.detail}
          </li>
        ))}
      </ul>
      {score.floor && <p className="text-danger font-semibold">{score.floor}</p>}
      <p className="text-fg-secondary">
        <span className="font-semibold">Confidence:</span>{' '}
        {score.confidence ? `${score.confidence}. ` : ''}
        {score.confidenceReason}
      </p>
      {score.limitations.length > 0 && (
        <ul className="text-fg-muted list-disc pl-4">
          {score.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <p className="text-fg-muted font-mono text-[11px]">
        {score.observedAt ? `newest input ${formatAgeLong(score.observedAt, now)} · ` : ''}
        computed {formatAgeLong(score.computedAt, now)} · model {score.modelVersion}, experimental
      </p>
    </div>
  )
}
