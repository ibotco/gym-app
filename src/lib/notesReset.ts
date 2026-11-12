/**
 * One-shot and on-demand clearing of Accounts Note data.
 *
 * A note exists because Chart of Accounts rows carry its Note No., so clearing
 * "the notes" means clearing both sides of that link:
 *
 *   1. the note register (wording, statement, status, note number);
 *   2. the Note No. and note metadata columns on every Chart of Accounts row;
 *   3. the synthetic `FSN-*` accounts an earlier release created to give notes
 *      something to point at — they were never real accounts;
 *   4. the parent/child links that earlier release made for notes, restored
 *      from the `childRestore` / `restoreParent*` bookkeeping it recorded.
 *
 * Real accounts are never deleted — only the note data is removed. The whole
 * thing is idempotent, and `runNotesResetOnce()` runs it once per browser so
 * existing stores still holding the sample notes come up clean.
 */
import { ACCOUNTS_KEY, ACCOUNT_NOTES_KEY } from './accounting'
import { isNoteActive, normalizeNote, planNoteRelease } from './noteMeta'
import type { Account, AccountNote } from '../types'

/** Set once the sample notes have been cleared from a browser's store. */
export const NOTES_RESET_STAMP = 'fitpro_notes_cleared_v1'

/** Key an earlier release used to remember notes the user had deleted. */
const DELETED_NOTES_KEY = 'fitpro_deleted_account_notes'

/** Synthetic accounts the old note engine created (code `FSN-<note no.>`). */
const SYNTHETIC_ACCOUNT = /^FSN-/

export type NoteClearSummary = {
  /** Register rows removed. */
  notes: number
  /** Chart rows the Note No. / note columns were taken off. */
  accounts: number
  /** Synthetic note accounts deleted. */
  syntheticAccounts: number
  /** Accounts put back under the parent they had before a note re-parented them. */
  restored: number
}

/** Minimal storage surface — a real `localStorage` or a test double. */
type Storage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } | undefined

const read = <T,>(storage: Storage, key: string, fallback: T): T => {
  try {
    const raw = storage?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const write = (storage: Storage, key: string, value: unknown) => {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/**
 * Strip every trace of notes from the Chart of Accounts and clear the note
 * register. Accounts themselves are kept; `childRestore` bookkeeping is used to
 * put accounts back where they sat before a note claimed them.
 *
 * Pass a storage to run against something other than the live `localStorage`
 * (used by the tests).
 */
export function clearAllNoteData(storage: Storage = typeof localStorage === 'undefined' ? undefined : localStorage): NoteClearSummary {
  const notes = read<AccountNote[]>(storage, ACCOUNT_NOTES_KEY, [])
  const accounts = read<Account[]>(storage, ACCOUNTS_KEY, [])

  // 1. Parent/child links a note engine made — put them back as they were.
  const parentRestore = new Map<string, { parentId?: string; parentCode?: string }>()
  const syntheticIds = new Set<string>()
  // What the row itself remembers about where it sat before a note grouped it.
  for (const a of accounts) if (a.noteParentRestore) parentRestore.set(a.id, a.noteParentRestore)
  for (const note of notes) {
    if (note.accountId) {
      syntheticIds.add(note.accountId)
      // The note's own account was promoted to top level; give its parent back.
      parentRestore.set(note.accountId, { parentId: note.restoreParentId, parentCode: note.restoreParentCode })
    }
    for (const entry of note.childRestore || []) {
      parentRestore.set(entry.accountId, { parentId: entry.parentId, parentCode: entry.parentCode })
    }
  }

  // 2. Delete only the synthetic note accounts — identifiable by their FSN-
  //    code AND by being a note's anchor. Real accounts are never touched.
  const kept: Account[] = []
  let syntheticAccounts = 0
  for (const a of accounts) {
    if (syntheticIds.has(a.id) && SYNTHETIC_ACCOUNT.test(a.code || '')) {
      syntheticAccounts++
      continue
    }
    kept.push(a)
  }
  const keptIds = new Set(kept.map((a) => a.id))

  // 3. Drop the note columns from every row, and restore the parents where the
  //    note engine had re-parented an account (or dropped a link to a deleted
  //    synthetic account).
  let changedAccounts = 0
  let restored = 0
  const cleaned = kept.map((a) => {
    const restore = parentRestore.get(a.id)
    let parentId = a.parentId
    let parentCode = a.parentCode
    if (restore && (restore.parentId !== a.parentId || restore.parentCode !== a.parentCode)) {
      parentId = restore.parentId
      parentCode = restore.parentCode
      restored++
    }
    // A parent that no longer exists (the synthetic note account) goes.
    if (parentId && !keptIds.has(parentId)) {
      parentId = undefined
      parentCode = undefined
    }
    const hadNoteData = !!(a.noteNo || a.noteDescription || a.noteStatement || a.noteStatus || a.noteAccounts || a.noteParentRestore)
    const parentChanged = parentId !== a.parentId || parentCode !== a.parentCode
    if (!hadNoteData && !parentChanged) return a
    changedAccounts++
    return {
      ...a,
      parentId,
      parentCode,
      noteNo: undefined,
      noteDescription: undefined,
      noteStatement: undefined,
      noteStatus: undefined,
      noteAccounts: undefined,
      noteParentRestore: undefined,
    }
  })

  // 4. Register and bookkeeping. Same key and serialisation as
  //    saveAccountNotes(), so the live store and a test double behave alike.
  write(storage, ACCOUNT_NOTES_KEY, [])
  write(storage, ACCOUNTS_KEY, cleaned)
  try { storage?.setItem(DELETED_NOTES_KEY, JSON.stringify([])) } catch { /* ignore */ }

  return { notes: notes.length, accounts: changedAccounts, syntheticAccounts, restored }
}

/* ------------------------------------------------------------ unmap the chart */

/** A single Chart of Accounts column write. */
export type ChartNoteWrite = { id: string; patch: Partial<Account> }

/**
 * Unmap the Chart of Accounts: every Note No. and note column comes off the
 * rows, while the note register is **kept** — the wording, statement and status
 * are parked as Inactive definitions, so re-assigning a note number later brings
 * the note back exactly as it was written.
 *
 * This is the counterpart of *Map Chart of Accounts*; use *Clear all* to remove
 * the definitions as well. The accounts themselves are never touched.
 */
export function planChartUnmap(accounts: Account[], notes: AccountNote[]): {
  updates: ChartNoteWrite[]
  register: AccountNote[]
  /** Registers parked as historical definitions. */
  parked: number
} {
  // Every row carrying any trace of a note — the number, the columns, or the
  // parent a note's grouping moved it under — is put back as it was: this is the
  // whole release, not just the number, so the chart reads exactly as it did
  // before anything was mapped or assigned.
  const updates = planNoteRelease(accounts) as ChartNoteWrite[]
  // Parked notes become pure definition records: no account links (nothing
  // carries the number any more) and a zero count, but the wording is intact.
  // Notes the user had already deactivated are left unmarked, so a later remap
  // does not silently reactivate a deliberate choice.
  const register = notes.map((n) =>
    normalizeNote(
      {
        ...n,
        accountId: undefined,
        accountIds: undefined,
        noteStatus: 'Inactive',
        status: 'inactive',
        parked: isNoteActive(n) ? true : n.parked,
      },
      [],
    ),
  )
  return { updates, register, parked: register.length }
}

/* ------------------------------------------------------- post-reload notice */

/** Where the cleared-counts are parked so the page can announce them after it reloads. */
export const NOTES_CLEAR_TOAST_KEY = 'fitpro_notes_cleared_toast'

/** Park a summary for the next page load (the clear reloads the app). */
export function stashClearToast(summary: NoteClearSummary, storage: Storage = typeof sessionStorage === 'undefined' ? undefined : sessionStorage) {
  try { storage?.setItem(NOTES_CLEAR_TOAST_KEY, JSON.stringify(summary)) } catch { /* ignore */ }
}

/** Take (and remove) a parked summary, if one is waiting. */
export function takeClearToast(storage: Storage = typeof sessionStorage === 'undefined' ? undefined : sessionStorage): NoteClearSummary | null {
  try {
    const raw = storage?.getItem(NOTES_CLEAR_TOAST_KEY)
    if (!raw) return null
    storage?.setItem(NOTES_CLEAR_TOAST_KEY, '')
    return JSON.parse(raw) as NoteClearSummary
  } catch {
    return null
  }
}

/** One line describing what a clear removed, for the toast and the audit log. */
export function describeClear(summary: NoteClearSummary): string {
  const parts = [`${summary.notes} note(s)`, `${summary.accounts} account reference(s)`]
  if (summary.syntheticAccounts) parts.push(`${summary.syntheticAccounts} note account(s) from earlier releases`)
  if (summary.restored) parts.push(`${summary.restored} parent link(s) restored`)
  return parts.join(' · ')
}

/**
 * Run the clear once per browser, so stores created before notes became
 * chart-driven (with the sample register and the FSN-* accounts) come up clean.
 * Never runs twice: the stamp is written regardless of the outcome.
 */
export function runNotesResetOnce(storage: Storage = typeof localStorage === 'undefined' ? undefined : localStorage): NoteClearSummary | null {
  try {
    if (storage?.getItem(NOTES_RESET_STAMP) === '1') return null
  } catch {
    return null
  }
  let summary: NoteClearSummary
  try {
    summary = clearAllNoteData(storage)
  } catch {
    summary = { notes: 0, accounts: 0, syntheticAccounts: 0, restored: 0 }
  }
  try { storage?.setItem(NOTES_RESET_STAMP, '1') } catch { /* ignore */ }
  return summary
}
