import type { ReactNode } from 'react'
import { CloseIcon } from './Icons'

/**
 * The frame shared by the train and station cards: floats over the map's top-right corner
 * on desktop and becomes a bottom sheet on phones, with a coloured strip along the top.
 */
export function FloatingCard({
  label,
  color,
  onClose,
  closeLabel = 'Close',
  children,
}: {
  label: string
  color?: string
  onClose?: () => void
  closeLabel?: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="card-in bg-card text-fg absolute inset-x-0 bottom-0 z-[1100] flex max-h-[60%] flex-col overflow-hidden rounded-t-2xl shadow-[var(--shadow-float)] lg:inset-auto lg:top-4 lg:right-4 lg:max-h-[calc(100%-2rem)] lg:w-[400px] lg:rounded-xl"
    >
      <div
        aria-hidden="true"
        className="h-[5px] shrink-0"
        style={{ background: color ?? 'var(--color-select)' }}
      />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="text-fg-muted hover:text-fg hover:bg-chip absolute top-3 right-3 z-10 grid h-7 w-7 place-items-center rounded-md"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="min-h-0 overflow-y-auto">{children}</div>
    </section>
  )
}
