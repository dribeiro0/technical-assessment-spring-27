import { useState } from 'react'
import type { Commute } from '../../domain/commute'
import { useSavedCommutes, type CommuteInput } from '../../hooks/useSavedCommutes'
import { CommuteDetail } from './CommuteDetail'
import { CommuteForm } from './CommuteForm'

type Mode = { kind: 'view' } | { kind: 'add' } | { kind: 'edit'; id: string }

const pill = 'h-8 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap'
const action = 'border-control text-fg h-8 rounded-md border px-3 text-xs font-semibold'

/**
 * My Commute (Sprint 4). Saved commutes appear as pills; only the open one fetches
 * departures (C7). Everything saved can be seen, renamed, reversed and deleted here (C3).
 */
export function CommuteView() {
  const { commutes, persisted, add, update, remove, reverse } = useSavedCommutes()
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const open = commutes.find((c) => c.id === openId) ?? commutes[0] ?? null
  const showForm = mode.kind !== 'view' || commutes.length === 0

  const choose = (id: string) => {
    setOpenId(id)
    setMode({ kind: 'view' })
    setConfirmDelete(false)
  }

  const saveNew = (input: CommuteInput) => {
    const result = add(input)
    if (result.ok) choose(result.commute.id)
    return result
  }

  const saveEdit = (id: string) => (input: CommuteInput) => {
    const result = update(id, input)
    if (result.ok) setMode({ kind: 'view' })
    return result
  }

  return (
    <div className="bg-main h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
        <header>
          <h2 className="text-fg text-lg font-bold tracking-tight">My commute</h2>
          <p className="text-fg-muted text-xs">
            Your stop, your direction, and when to leave. Saved on this device only: no account,
            nothing sent anywhere.
          </p>
          {!persisted && (
            <p role="alert" className="text-warn mt-2 text-xs font-semibold">
              This browser is not allowing storage, so commutes will be forgotten when you close the
              page.
            </p>
          )}
        </header>

        {commutes.length > 0 && (
          <nav aria-label="Saved commutes" className="flex gap-2 overflow-x-auto pb-1">
            {commutes.map((c) => {
              const current = open?.id === c.id && mode.kind !== 'add'
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c.id)}
                  aria-current={current ? 'true' : undefined}
                  className={`${pill} ${
                    current
                      ? 'border-chrome bg-chrome text-chrome-fg font-semibold'
                      : 'border-control text-fg'
                  }`}
                >
                  {c.name}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setMode({ kind: 'add' })}
              aria-current={mode.kind === 'add' ? 'true' : undefined}
              className={`${pill} border-dashed ${
                mode.kind === 'add' ? 'border-chrome font-semibold' : 'border-control'
              } text-fg`}
            >
              + Add commute
            </button>
          </nav>
        )}

        {showForm ? (
          <section
            aria-labelledby="commute-form-title"
            className="border-border bg-card rounded-xl border p-4"
          >
            <h3 id="commute-form-title" className="text-fg mb-3 text-sm font-semibold">
              {mode.kind === 'edit'
                ? 'Edit commute'
                : commutes.length === 0
                  ? 'Save your first commute'
                  : 'Add a commute'}
            </h3>
            {commutes.length === 0 && (
              <p className="text-fg-secondary mb-3 text-sm">
                Save the station you leave from and which way you go. EnRoute will show your next
                trains and tell you when to head out.
              </p>
            )}
            {mode.kind === 'edit' ? (
              <CommuteForm
                key={mode.id}
                initial={commutes.find((c) => c.id === mode.id)}
                onSave={saveEdit(mode.id)}
                onCancel={() => setMode({ kind: 'view' })}
              />
            ) : (
              <CommuteForm
                key="new"
                onSave={saveNew}
                onCancel={commutes.length > 0 ? () => setMode({ kind: 'view' }) : undefined}
              />
            )}
          </section>
        ) : (
          open && (
            <>
              <CommuteDetail key={open.id} commute={open} />
              <Actions
                commute={open}
                confirmDelete={confirmDelete}
                onEdit={() => setMode({ kind: 'edit', id: open.id })}
                onReverse={() => reverse(open.id)}
                onAskDelete={() => setConfirmDelete(true)}
                onCancelDelete={() => setConfirmDelete(false)}
                onDelete={() => {
                  remove(open.id)
                  setOpenId(null)
                  setConfirmDelete(false)
                }}
              />
            </>
          )
        )}
      </div>
    </div>
  )
}

function Actions({
  commute,
  confirmDelete,
  onEdit,
  onReverse,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  commute: Commute
  confirmDelete: boolean
  onEdit: () => void
  onReverse: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  if (confirmDelete) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-fg font-semibold">Delete “{commute.name}” from this device?</span>
        <button
          type="button"
          onClick={onDelete}
          className="bg-danger h-8 rounded-md px-3 text-xs font-semibold text-white"
        >
          Delete
        </button>
        <button type="button" onClick={onCancelDelete} autoFocus className={action}>
          Keep it
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onEdit} className={action}>
        Edit or rename
      </button>
      <button
        type="button"
        onClick={onReverse}
        className={action}
        aria-label={
          commute.destinationName
            ? `Reverse: ${commute.destinationName} to ${commute.stationName}`
            : 'Reverse direction'
        }
      >
        ⇄ Reverse
      </button>
      <button type="button" onClick={onAskDelete} className={`${action} text-danger`}>
        Delete
      </button>
    </div>
  )
}
