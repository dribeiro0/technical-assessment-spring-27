import { STATUS_TEXT, type StatusLevel } from '../domain/lineStatus'

// Line status shown by shape and text, never colour alone:
// good = hollow circle, minor = triangle, major = filled square.
const MARK: Record<StatusLevel, { symbol: string; className: string }> = {
  good: { symbol: '○', className: 'text-fg-muted' },
  minor: { symbol: '▲', className: 'text-warn' },
  major: { symbol: '■', className: 'text-danger' },
}

interface Props {
  level: StatusLevel | null
  /** Show the words next to the symbol (otherwise they are for screen readers only). */
  withText?: boolean
}

export function StatusMark({ level, withText = false }: Props) {
  if (!level) {
    return (
      <span className="text-fg-muted text-xs" title="Status unavailable">
        {withText ? 'Status unavailable' : <span className="sr-only">Status unavailable</span>}
      </span>
    )
  }
  const mark = MARK[level]
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${mark.className}`}
      title={STATUS_TEXT[level]}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {mark.symbol}
      </span>
      {withText ? (
        <span className={`text-xs ${level === 'good' ? '' : 'font-medium'}`}>
          {STATUS_TEXT[level]}
        </span>
      ) : (
        <span className="sr-only">{STATUS_TEXT[level]}</span>
      )}
    </span>
  )
}
