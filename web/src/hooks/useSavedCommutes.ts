import { useSyncExternalStore } from 'react'
import {
  MAX_COMMUTES,
  STORAGE_KEY,
  createCommute,
  parseCommutes,
  reverseCommute,
  serializeCommutes,
  type Commute,
} from '../domain/commute'

// Saved commutes live in this browser only (localStorage): no account, nothing sent
// anywhere (planning file 09). One small store is shared by every screen that shows
// them, so an edit in one place appears everywhere at once.

let cache: Commute[] | null = null
/** False when the browser refuses storage (some private windows): commutes then last one visit. */
let persisted = true
const listeners = new Set<() => void>()

function read(): Commute[] {
  if (cache) return cache
  try {
    cache = parseCommutes(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    persisted = false
    cache = []
  }
  return cache
}

function write(next: Commute[]) {
  cache = next
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeCommutes(next))
    persisted = true
  } catch {
    persisted = false
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab saved or deleted a commute: read storage again.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    cache = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type Result = { ok: true; commute: Commute } | { ok: false; error: string }

export type CommuteInput = Omit<Commute, 'id'>

/** The saved commutes and every way to change them (C1-C3). */
export function useSavedCommutes() {
  const commutes = useSyncExternalStore(subscribe, read)

  const add = (input: CommuteInput): Result => {
    if (read().length >= MAX_COMMUTES) {
      return { ok: false, error: `You can save up to ${MAX_COMMUTES} commutes.` }
    }
    const result = createCommute(input, newId())
    if (result.ok) write([...read(), result.commute])
    return result
  }

  const update = (id: string, input: CommuteInput): Result => {
    const result = createCommute(input, id)
    if (result.ok) write(read().map((c) => (c.id === id ? result.commute : c)))
    return result
  }

  const remove = (id: string) => write(read().filter((c) => c.id !== id))

  const reverse = (id: string) => write(read().map((c) => (c.id === id ? reverseCommute(c) : c)))

  return { commutes, persisted, add, update, remove, reverse }
}
