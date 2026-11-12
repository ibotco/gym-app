/**
 * Turning the Accounts Note form into what should happen.
 *
 * The edit path is where notes are easiest to break: a note number belongs to
 * exactly one note, an account carries exactly one note number, and a note only
 * exists while the chart refers to it. This planner decides the register row and
 * the Chart of Accounts writes for one Save, or explains — precisely — why the
 * save cannot go through. The page stays a thin shell around it.
 */
import type { Account, AccountNote, NoteStatement, NoteStatus } from '../types'
import {
  NOTE_DESCRIPTION_MAX,
  coveredAccounts,
  isNoteActive,
  isReservedAccountNoteNo,
  legacyStatementValue,
  normalizeNote,
  noteOwnership,
  statementForAccountType,
} from './noteMeta'
import { uid } from './utils'

/** The fields the Add/Edit modal carries. */
export type NoteFormValues = {
  id?: string
  noteNo: string
  accountId: string
  noteStatement: NoteStatement | ''
  accountIds: string[]
  noteDescription: string
  noteStatus: NoteStatus
}

export type NoteChartWrite = { id: string; patch: Partial<Account> }

export type NoteSavePlan =
  | { ok: false; title: string; desc?: string }
  | {
      ok: true
      isNew: boolean
      /** The saved note, normalised. */
      note: AccountNote
      /** The register after the save. */
      register: AccountNote[]
      /** Note Number writes for the Chart of Accounts (only rows that change). */
      chartUpdates: NoteChartWrite[]
      /** Rows newly joining the note (for the inactive-note rule and the toast). */
      newAssignments: number
      /** Chart rows the note covers once saved. */
      coveredCount: number
    }

/** Next free Accounts Note number; 1 is reserved for Accounting Policies. */
export function nextNoteNumber(accounts: Account[], notes: AccountNote[]): string {
  const used = [
    ...accounts.map((a) => Number(a.noteNo)),
    ...notes.map((n) => Number(n.noteNo)),
  ].filter((v) => Number.isFinite(v))
  const highest = used.reduce((max, value) => Math.max(max, value), 1)
  return String(highest + 1)
}

export function planNoteSave(input: {
  editing: NoteFormValues
  notes: AccountNote[]
  accounts: Account[]
  companyId?: string
}): NoteSavePlan {
  const { editing, notes, accounts, companyId } = input
  const prev = editing.id ? notes.find((n) => n.id === editing.id) : undefined

  // A blank Note No. keeps the note's own number (never renumbers behind your
  // back); a brand-new note takes the next free one.
  const noteNo = (editing.noteNo || '').trim() || prev?.noteNo || nextNoteNumber(accounts, notes)
  if (isReservedAccountNoteNo(noteNo)) {
    return {
      ok: false,
      title: 'Note No. 1 is reserved',
      desc: 'Note 1 is used by Accounting Policies. Accounts Note numbers start at 2; choose another number.',
    }
  }

  // One note per number: a number in use by a different note is never taken.
  const clash = notes.find((n) => n.noteNo === noteNo && n.id !== editing.id)
  if (clash) {
    return {
      ok: false,
      title: `Note ${noteNo} already exists`,
      desc: `It belongs to “${clash.name}”. Notes are identified by their number — choose a free one, or edit that note instead.`,
    }
  }

  const anchor = editing.accountId ? accounts.find((a) => a.id === editing.accountId) : undefined
  if (editing.accountId && !anchor) {
    return { ok: false, title: 'That account no longer exists', desc: 'Pick another chart account for this note.' }
  }

  const rowsOnNumber = accounts.filter((a) => a.noteNo === noteNo)
  // Where each row's note number comes from — its own, or its note account's.
  const ownership = noteOwnership(accounts)
  // A note that still has chart rows must be named by one of them. A historical
  // note (its number has left the chart) may be edited without an anchor.
  if (!anchor && (rowsOnNumber.length > 0 || !prev)) {
    return { ok: false, title: 'Select a chart account for this note', desc: 'The note is named by the account that carries its Note No.' }
  }
  // An account already answering to a *different* note cannot be taken silently
  // — whether it carries that number or inherits it from its note account.
  // (Its own note's number is fine: that is what renumbering a note looks like.)
  const anchorOwnership = anchor ? ownership.get(anchor.id) : undefined
  const anchorOwner = anchorOwnership ? notes.find((n) => n.noteNo === anchorOwnership.noteNo) : undefined
  if (anchor && anchorOwner && anchorOwner.id !== editing.id) {
    return {
      ok: false,
      title: anchorOwnership!.inherited
        ? `${anchor.name} is already part of Note ${anchorOwnership!.noteNo}`
        : `${anchor.name} already carries Note ${anchorOwnership!.noteNo}`,
      desc: anchorOwnership!.inherited
        ? `It is a sub-account of the account carrying Note ${anchorOwnership!.noteNo}, so it already belongs to “${anchorOwner.name}”. Give the account above it a number of its own on the chart, or use Bulk Actions → Assign note….`
        : `Release it from “${anchorOwner.name}” first, then assign it here — or use Bulk Actions → Assign note… in the Chart of Accounts.`,
    }
  }

  // The note's accounts: every box ticked, plus the account that names it.
  const assigned = Array.from(new Set([...(editing.accountIds || []), ...(anchor ? [anchor.id] : [])]))
  const assignedAccounts = assigned.map((id) => accounts.find((a) => a.id === id)).filter(Boolean) as Account[]
  // Rows that will *join* the note. A row that already answers to the number —
  // as its own Note No., or inherited from its note account — is not new.
  const newAssignments = assignedAccounts.filter((a) => ownership.get(a.id)?.noteNo !== noteNo)
  // An Inactive note takes no new accounts — but switching it Active in this very
  // save is the reactivation, so what matters is the status being saved, not the
  // one on file. (Reading the stored status here is what used to make a parked
  // note impossible to reactivate through this form.)
  const savedStatus: NoteStatus = editing.noteStatus || 'Active'
  if (savedStatus === 'Inactive' && newAssignments.length) {
    return {
      ok: false,
      title: `Note ${prev?.noteNo || noteNo} is inactive`,
      desc: 'Inactive notes keep their existing links for historical reporting but cannot take new accounts. Set the status to Active first.',
    }
  }

  // ---- chart writes -------------------------------------------------------
  const assignedSet = new Set(assigned)
  const chartUpdates: NoteChartWrite[] = []
  const write = (id: string, patch: Partial<Account>) => chartUpdates.push({ id, patch })
  for (const a of assignedAccounts) if (a.noteNo !== noteNo) write(a.id, { noteNo })
  for (const a of rowsOnNumber) if (!assignedSet.has(a.id)) write(a.id, { noteNo: undefined })
  // Renumbering: rows the note leaves behind are released, so the old number
  // does not linger on the chart as a note nobody wrote.
  const renumberedFrom = prev && prev.noteNo !== noteNo ? prev.noteNo : undefined
  if (renumberedFrom) {
    for (const a of accounts.filter((x) => x.noteNo === renumberedFrom)) {
      if (!assignedSet.has(a.id)) write(a.id, { noteNo: undefined })
    }
  }

  // What the note covers once saved: the rows that will carry its number plus
  // every account beneath them — the cascade, read off the chart as it will be.
  const written = new Map(chartUpdates.map((u) => [u.id, u.patch]))
  const projected = accounts.map((a) => {
    const patch = written.get(a.id)
    return patch ? { ...a, ...patch } : a
  })
  const coveredCount = coveredAccounts(noteNo, projected).length

  // ---- register row -------------------------------------------------------
  const description = (editing.noteDescription || '').trim().slice(0, NOTE_DESCRIPTION_MAX)
  const statement: NoteStatement =
    editing.noteStatement || (anchor ? statementForAccountType(anchor.type) : prev?.noteStatement) || 'Other'
  // With no chart rows behind it after this save the note is a *definition*:
  // keep it parked so it stays on file — a note the user just switched Active
  // must not vanish on the next derivation pass. Rows arriving clear the flag.
  const parkedAfter: boolean | undefined = coveredCount > 0
    ? undefined
    : (prev?.parked ?? (savedStatus === 'Active' ? true : undefined))
  const draft: AccountNote = {
    id: prev?.id || uid('note'),
    companyId,
    noteNo,
    accountId: anchor?.id ?? prev?.accountId,
    name: anchor?.name || prev?.name || '',
    parentId: prev?.parentId,
    parked: parkedAfter,
    noteDescription: description || undefined,
    noteStatement: statement,
    noteStatus: editing.noteStatus || 'Active',
    // Legacy mirrors keep older readers on the same values.
    description: description || undefined,
    statement: legacyStatementValue(statement, prev?.statement),
    status: (editing.noteStatus || 'Active') === 'Inactive' ? 'inactive' : 'active',
  }
  const saved = normalizeNote(draft, accounts)
  const register = (prev ? notes.map((n) => (n.id === prev.id ? saved : n)) : [...notes, saved])
    .map((n) => normalizeNote(n, accounts))

  return {
    ok: true,
    isNew: !prev,
    note: saved,
    register,
    chartUpdates,
    newAssignments: newAssignments.length,
    coveredCount,
  }
}
