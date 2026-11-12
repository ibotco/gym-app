/**
 * Accounts Note metadata — the note management framework behind the Chart of
 * Accounts source table (accounting_accounts).
 *
 * Every Chart of Accounts row can point at a financial-statement note through
 * its note_no. The note itself carries four metadata columns:
 *
 *   note_description  what the note covers, in words (VARCHAR 500)
 *   note_statement    which statement the note is disclosed on
 *   note_accounts     how many Chart of Accounts rows are assigned to the note
 *                     (auto-calculated from note_no — never typed by hand)
 *   note_status       Active | Inactive (default Active). An Inactive note is
 *                     closed to NEW account assignments but stays on file for
 *                     historical reporting.
 *
 * The register (AccountNote rows) is the single source of truth for the
 * metadata; this module normalises it, derives the automatic count, and
 * produces the column values stamped onto the Chart of Accounts source rows so
 * the table itself can be read by reporting without a join.
 *
 * `note_no` remains the primary identifier — nothing here renumbers notes.
 *
 * A note number covers the whole subtree of the account it is written on: the
 * sub-accounts of a note account belong to the note too (see `noteOwnership`),
 * so `Cash and cash equivalents` with `GCB Bank — Main Current` and
 * `MTN Mobile Money` under it is one note — assigned once, at the top.
 */
import type { Account, AccountNote, NoteStatement, NoteStatus } from '../types'

/* ---------------------------------------------------------------- vocabulary */

/** `accounting_account_type` id 16 = Bank (the rows Banking → Bank Accounts lists). */
export const BANK_ACCOUNT_TYPE_ID = 16

/** Note 1 is a separate disclosure reserved for the Accounting Policies register. */
export const RESERVED_ACCOUNTING_POLICY_NOTE_NO = '1'

/** Whether an account note number would collide with the reserved policy note. */
export function isReservedAccountNoteNo(value: string | number | null | undefined): boolean {
  const text = String(value ?? '').trim()
  return text !== '' && Number.isFinite(Number(text)) && Number(text) === Number(RESERVED_ACCOUNTING_POLICY_NOTE_NO)
}

/**
 * Bank accounts are managed under Banking → Bank Accounts, so the Chart of
 * Accounts lists them **only when they are part of a note hierarchy** — a note
 * account's sub-accounts. `noteNo` is the number the row answers to, its own or
 * the one it inherits. Everything else about them stays the same.
 */
export const listedInChart = (a: Account, noteNo?: string): boolean =>
  Number(a.accountTypeId) !== BANK_ACCOUNT_TYPE_ID || !!noteNo

/* --------------------------------------------------------------- the cascade */

/**
 * Where a row's note number comes from: the row's own Note No. (typed on the
 * chart, via Bulk Actions → Assign note…, or written by Map), or the nearest
 * account above it that carries one.
 */
export type NoteOwnership = {
  noteNo: string
  /** true = no Note No. of its own — the row follows the account above it. */
  inherited: boolean
  /** The account whose own Note No. this row answers to (itself when it owns one). */
  ownerId: string
}

/**
 * The parent link the chart itself declares — a note grouping link is never
 * followed, so an account that leaves a note is not pulled back into it by the
 * row it happened to be grouped under.
 */
const naturalParentId = (a: Account): string | undefined =>
  a.noteParentRestore ? a.noteParentRestore.parentId : a.parentId

/**
 * Every row's note number — assigned, or inherited from its note account.
 *
 * Assigning an account to a note puts **all of its sub-accounts on the note
 * too**, so the note reads as that account's subtree and the work is done once,
 * at the top. The nearest number wins: a sub-account given a Note No. of its
 * own starts its own note and its sub-accounts follow it. Rows belonging to no
 * note are absent from the map.
 */
export function noteOwnership(accounts: Account[]): Map<string, NoteOwnership> {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const out = new Map<string, NoteOwnership>()
  for (const start of accounts) {
    const seen = new Set<string>()
    let cursor: Account | undefined = start
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id)
      if (cursor.noteNo) {
        out.set(
          start.id,
          cursor.id === start.id
            ? { noteNo: cursor.noteNo, inherited: false, ownerId: cursor.id }
            : { noteNo: cursor.noteNo, inherited: true, ownerId: cursor.id },
        )
        break
      }
      cursor = byId.get(naturalParentId(cursor) || '')
    }
  }
  return out
}

/** The note number a row answers to — its own, or the one it inherits. */
export const noteNoOf = (a: Account, ownership: Map<string, NoteOwnership>): string | undefined =>
  ownership.get(a.id)?.noteNo

/**
 * The Chart of Accounts rows a note covers: the rows carrying its Note No. plus
 * every account beneath them. A row with a number of its own starts its own
 * note, so nothing is ever counted twice.
 */
export function coveredAccounts(noteNo: string, accounts: Account[]): Account[] {
  const ownership = noteOwnership(accounts)
  return accounts.filter((a) => ownership.get(a.id)?.noteNo === noteNo)
}

/** Every account beneath `rootId`, any generation (parentId, then parentCode). */
export function descendantIds(accounts: Account[], rootId: string): Set<string> {
  const out = new Set<string>()
  const root = accounts.find((a) => a.id === rootId)
  if (!root) return out
  const visit = (parent: Account) => {
    for (const a of accounts) {
      if (a.id === rootId || out.has(a.id)) continue
      if (a.parentId === parent.id || (!!a.parentCode && a.parentCode === parent.code)) {
        out.add(a.id)
        visit(a)
      }
    }
  }
  visit(root)
  return out
}

export type { NoteStatement, NoteStatus }

export const NOTE_STATEMENTS: NoteStatement[] = [
  'Balance Sheet',
  'Income Statement',
  'Cash Flow Statement',
  'Statement of Changes in Equity',
  'Other',
]

export const NOTE_STATUSES: NoteStatus[] = ['Active', 'Inactive']

/** Column width of note_description (VARCHAR(500)). */
export const NOTE_DESCRIPTION_MAX = 500

export const isNoteStatement = (v?: string): v is NoteStatement =>
  !!v && (NOTE_STATEMENTS as string[]).includes(v)

export const isNoteStatus = (v?: string): v is NoteStatus => v === 'Active' || v === 'Inactive'

/**
 * Note numbers that are disclosures in their own right rather than a monetary
 * caption on a statement face: 1–3 (policies, judgements, risk) and 43–45
 * (related parties, contingencies, commitments) — plus 41–42 which reconcile
 * the cash flow statement.
 */
const CASH_FLOW_NOTE_NUMBERS = new Set(['41', '42'])
const OTHER_NOTE_NUMBERS = new Set(['1', '2', '3', '43', '44', '45'])

/* ---------------------------------------------------------------- derivation */

/** Statement a note belongs to when derived from the account it anchors. */
export const statementForAccountType = (type?: Account['type']): NoteStatement => {
  if (type === 'income' || type === 'expense') return 'Income Statement'
  if (type === 'equity') return 'Statement of Changes in Equity'
  return 'Balance Sheet'
}

/** Default `note_statement` for a note that has none stored yet. */
export const deriveNoteStatement = (
  note: Pick<AccountNote, 'noteNo' | 'statement'>,
  account?: Account,
): NoteStatement => {
  const no = String(note.noteNo ?? '')
  if (CASH_FLOW_NOTE_NUMBERS.has(no)) return 'Cash Flow Statement'
  if (OTHER_NOTE_NUMBERS.has(no)) return 'Other'
  if (account) return statementForAccountType(account.type)
  return note.statement === 'income_statement' ? 'Income Statement' : 'Balance Sheet'
}

/* ------------------------------------------------------------------ readers */

/** `note_description` — stored value, else the register text, else seeded wording. */
export const noteDescriptionOf = (
  note: Pick<AccountNote, 'noteDescription' | 'description' | 'noteNo'>,
): string => (note.noteDescription || note.description || '').trim()

/** `note_status` — falls back to the legacy active/inactive flag. */
export const noteStatusOf = (note: Pick<AccountNote, 'noteStatus' | 'status'>): NoteStatus => {
  if (isNoteStatus(note.noteStatus)) return note.noteStatus
  return note.status === 'inactive' ? 'Inactive' : 'Active'
}

/** An Active note may take new account assignments; an Inactive one may not. */
export const isNoteActive = (note: Pick<AccountNote, 'noteStatus' | 'status'>): boolean =>
  noteStatusOf(note) === 'Active'

/** `note_statement` — stored value, else derived from the note's account. */
export const noteStatementOf = (
  note: Pick<AccountNote, 'noteNo' | 'noteStatement' | 'statement'>,
  account?: Account,
): NoteStatement =>
  isNoteStatement(note.noteStatement) ? note.noteStatement : deriveNoteStatement(note, account)

/**
 * `note_accounts` — the number of Chart of Accounts records assigned to the
 * note, calculated from note_no. Accounts the register says it covers always
 * count, even if a stamp has not reached them yet.
 */
export const noteAccountCountOf = (
  note: Pick<AccountNote, 'noteNo' | 'accountId' | 'accountIds'>,
  accounts: Account[],
): number => {
  const ids = new Set<string>()
  if (note.accountId) ids.add(note.accountId)
  for (const id of note.accountIds || []) ids.add(id)
  // Everything the number reaches: the rows carrying it and their sub-accounts.
  for (const a of coveredAccounts(note.noteNo, accounts)) ids.add(a.id)
  return ids.size
}

/** Accounts the source table shows as belonging to a note (its own and its sub-accounts). */
export const accountsForNote = (noteNo: string, accounts: Account[]): Account[] =>
  coveredAccounts(noteNo, accounts)

export const noteByNo = (notes: AccountNote[], noteNo: string): AccountNote | undefined =>
  notes.find((n) => n.noteNo === noteNo)

export const statementLabel = (s: NoteStatement): string => s

/** Heading used when the disclosures are grouped by statement in a package. */
export const noteGroupHeading = (s: NoteStatement): string =>
  s === 'Other' ? 'OTHER DISCLOSURES' : `NOTES TO THE ${s.toUpperCase()}`

/* ----------------------------------------------------------- normalisation */

/** Legacy `statement` union (2 values) kept in step for older consumers. */
export const legacyStatementValue = (statement: NoteStatement, existing?: AccountNote['statement']): AccountNote['statement'] => {
  if (statement === 'Income Statement') return 'income_statement'
  if (statement === 'Balance Sheet') return 'balance_sheet'
  if (existing === 'income_statement' && statement === 'Other') return 'income_statement'
  return 'balance_sheet'
}

/**
 * Fill the four note columns on a register row and refresh the automatic
 * account count. Idempotent: a normalised note normalises to itself, so effects
 * that persist the result cannot loop. User-entered text is never replaced —
 * note_description is only seeded when the note has none.
 */
export function normalizeNote(note: AccountNote, accounts: Account[]): AccountNote {
  const account = note.accountId ? accounts.find((a) => a.id === note.accountId) : undefined
  const noteDescription = noteDescriptionOf(note).slice(0, NOTE_DESCRIPTION_MAX) || undefined
  const noteStatement = noteStatementOf(note, account)
  const noteStatus = noteStatusOf(note)
  const noteAccounts = noteAccountCountOf(note, accounts)
  return {
    ...note,
    noteDescription,
    noteStatement,
    noteStatus,
    noteAccounts,
    // Legacy mirrors — kept so readers that predate the columns stay correct.
    description: noteDescription,
    statement: legacyStatementValue(noteStatement, note.statement),
    status: noteStatus === 'Inactive' ? 'inactive' : 'active',
  }
}

/** Normalise a whole register; reports whether anything actually changed. */
export function normalizeNotes(
  notes: AccountNote[],
  accounts: Account[],
): { notes: AccountNote[]; changed: boolean } {
  let changed = false
  const next = notes.map((n) => {
    const normalized = normalizeNote(n, accounts)
    if (
      normalized.noteDescription !== n.noteDescription ||
      normalized.noteStatement !== n.noteStatement ||
      normalized.noteStatus !== n.noteStatus ||
      normalized.noteAccounts !== n.noteAccounts ||
      normalized.description !== n.description ||
      normalized.statement !== n.statement ||
      normalized.status !== n.status
    ) {
      changed = true
    }
    return normalized
  })
  return { notes: next, changed }
}

/* --------------------------------------------- the register, from the chart */

/**
 * The Accounts Note register as it comes from the Chart of Accounts.
 *
 * A note exists because the chart refers to it: one note per note number in use
 * on `accounting_accounts`, whose accounts are exactly the rows carrying that
 * number, and whose name is the name of the note's anchor account (the
 * top-level row for the number, or the note's previous account when it is
 * still part of the note).
 *
 * Saved register rows stay authoritative for the metadata — note_description,
 * note_statement and note_status are matched by note number and never
 * overwritten, and nothing is ever renumbered or renamed. Notes the chart no
 * longer refers to are dropped, except Inactive ones, which stay on file for
 * historical reporting.
 */
/**
 * A note with no chart rows behind it is kept when it is Inactive (historical
 * reporting) or **parked** — a definition Unmap kept, or an empty note the user
 * switched back on, waiting for accounts. `parked` is therefore about being kept
 * on file, not about being closed: a parked note may be Active and may be
 * revived by Map or by assigning its number again.
 */
export const keepsWithoutChartRows = (n: Pick<AccountNote, 'noteStatus' | 'status' | 'parked'>): boolean =>
  !isNoteActive(n) || n.parked === true

/** A note Map may assign rows to: one that is open, or a parked definition. */
export const isMapCandidate = (n: Pick<AccountNote, 'noteStatus' | 'status' | 'parked'>): boolean =>
  isNoteActive(n) || n.parked === true

export type ChartNotesResult = {
  notes: AccountNote[]
  changed: boolean
  /** Note numbers that now exist on the chart but had no register row. */
  created: number
  /** Active register rows whose note number has left the chart. */
  removed: number
  /** Inactive notes kept on file with no chart rows. */
  historical: number
}

/** Legacy `statement` values predate the taxonomy — let the derivation redo them. */
const legacyStatement = (v?: AccountNote['statement']): NoteStatement | undefined =>
  v === 'income_statement' ? 'Income Statement' : undefined

/** Legacy active/inactive flag → note_status. */
const legacyStatus = (v?: AccountNote['status']): NoteStatus | undefined =>
  v === 'inactive' ? 'Inactive' : v === 'active' ? 'Active' : undefined

/** Legacy two-value statement bucket for a new row (mirrors are rewritten). */
const deriveLegacyStatement = (account?: Account): AccountNote['statement'] =>
  account && (account.type === 'income' || account.type === 'expense') ? 'income_statement' : 'balance_sheet'

/** Stable ordering for the rows of one note: by code, then name. */
const byChartOrder = (a: Account, b: Account) =>
  String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }) || a.name.localeCompare(b.name)

/** The account that gives the note its name. */
function anchorFor(rows: Account[], previous?: AccountNote): Account {
  const ordered = [...rows].sort(byChartOrder)
  return (
    (previous?.accountId ? rows.find((a) => a.id === previous.accountId) : undefined) ||
    ordered.find((a) => !a.parentId) ||
    ordered[0]
  )
}

export function notesFromChart(accounts: Account[], saved: AccountNote[]): ChartNotesResult {
  const rowsByNo = new Map<string, Account[]>()
  for (const a of accounts) {
    if (!a.noteNo) continue
    const list = rowsByNo.get(a.noteNo)
    if (list) list.push(a)
    else rowsByNo.set(a.noteNo, [a])
  }
  const savedByNo = new Map(saved.map((n) => [n.noteNo, n]))
  const notes: AccountNote[] = []
  let created = 0

  for (const noteNo of Array.from(rowsByNo.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const rows = rowsByNo.get(noteNo)!
    const prev = savedByNo.get(noteNo)
    // A note parked by Unmap comes back the moment a chart row carries its
    // number again — the wording was never thrown away.
    const revived = prev?.parked === true
    if (!prev) created++
    const anchor = anchorFor(rows, prev)
    // Covered accounts are everything the number reaches — the rows carrying it
    // and every account beneath them — minus the anchor, which is the caption.
    const covered = coveredAccounts(noteNo, accounts)
      .filter((a) => a.id !== anchor.id)
      .sort(byChartOrder)
      .map((a) => a.id)
    notes.push(
      normalizeNote(
        {
          id: prev?.id || `note_chart_${noteNo}`,
          companyId: prev?.companyId,
          noteNo,
          accountId: anchor.id,
          name: anchor.name,
          // Structure bookkeeping kept from the register so releases reverse cleanly.
          restoreParentId: prev?.restoreParentId,
          restoreParentCode: prev?.restoreParentCode,
          childRestore: prev?.childRestore,
          parentId: prev?.parentId,
          accountIds: covered.length ? covered : undefined,
          noteDescription: prev?.noteDescription ?? prev?.description,
          noteStatement: prev?.noteStatement ?? legacyStatement(prev?.statement),
          noteStatus: revived ? 'Active' : (prev?.noteStatus ?? legacyStatus(prev?.status)),
          parked: revived ? undefined : prev?.parked,
          // Legacy mirrors — normalizeNote() rewrites both from the fields above.
          statement: prev?.statement ?? deriveLegacyStatement(rows.length ? anchorFor(rows, prev) : undefined),
          status: prev?.status,
        },
        accounts,
      ),
    )
  }

  // Notes kept with no chart rows behind them. Two kinds:
  //   - Inactive ones, kept for historical reporting (or deliberately closed);
  //   - *parked* ones — definitions kept by Unmap, or an empty note the user
  //     activated, waiting to be mapped. Without this an Active note the user
  //     just switched on would vanish on the next pass.
  // An Active note that is not parked and has no chart rows is dropped: a note
  // that is in use exists because the chart refers to it.
  let historical = 0
  for (const n of saved) {
    if (rowsByNo.has(n.noteNo) || !keepsWithoutChartRows(n)) continue
    historical++
    notes.push(normalizeNote({ ...n, accountId: n.accountId, accountIds: n.accountIds }, accounts))
  }

  const signature = (n: AccountNote) =>
    JSON.stringify([n.id, n.noteNo, n.accountId, n.name, (n.accountIds || []).join(','), n.noteDescription, n.noteStatement, n.noteStatus, n.noteAccounts, n.parked === true])
  const before = [...saved].map(signature).sort()
  const after = notes.map(signature).sort()
  const changed = before.length !== after.length || before.some((v, i) => v !== after[i])
  const removed = Array.from(savedByNo.keys())
    .filter((no) => !rowsByNo.has(no) && !keepsWithoutChartRows(savedByNo.get(no)!)).length
  return { notes, changed, created, removed, historical }
}

/* ------------------------------------------------------------- note grouping */

/** A single Chart of Accounts write, ready for `patchAccounts`. */
export type NoteChartWrite = { id: string; patch: Partial<Account> }

/** Would parenting `accountId` under `ancestorId` close a loop? */
function isDescendantOf(accounts: Account[], accountId: string, ancestorId: string): boolean {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const seen = new Set<string>()
  let cursor = byId.get(accountId)
  while (cursor?.parentId && !seen.has(cursor.parentId)) {
    if (cursor.parentId === ancestorId) return true
    seen.add(cursor.parentId)
    cursor = byId.get(cursor.parentId)
  }
  return false
}

/**
 * Every account on a note is a **sub-account of the note's account** in the
 * chart: the note reads as a caption with its accounts beneath it. The note
 * number is what decides this, so the grouping follows every assignment —
 * made from the note form, from Bulk Actions or by typing a number on a row —
 * and a row that leaves the note goes back where it sat before.
 *
 * Writes nothing when the chart already reads correctly, so it is safe to run
 * on every load. Cycles are refused (an account that is an ancestor of the note
 * account is left where it is).
 */
export function planNoteGrouping(accounts: Account[], notes: AccountNote[]): NoteChartWrite[] {
  // No early return on an empty register: rows a note grouped under its account
  // must still find their way home when the last note goes.
  const anchorByNoteNo = new Map(notes.map((n) => [n.noteNo, n.accountId]))
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const out: NoteChartWrite[] = []
  for (const account of accounts) {
    if (account.noteNo) {
      const anchor = anchorByNoteNo.get(account.noteNo)
      const parent = anchor ? byId.get(anchor) : undefined
      // The note's own account is the parent, not a child — and a link that
      // would loop is never written.
      if (!parent || parent.id === account.id) continue
      if (isDescendantOf(accounts, parent.id, account.id)) continue
      if (account.parentId === parent.id && account.noteParentRestore) continue
      if (account.parentId === parent.id) {
        // Already a sub-account; just record where it sat before, when known.
        out.push({ id: account.id, patch: { noteParentRestore: { parentId: account.parentId, parentCode: account.parentCode } } })
        continue
      }
      out.push({
        id: account.id,
        patch: {
          parentId: parent.id,
          parentCode: parent.code || undefined,
          noteParentRestore: { parentId: account.parentId, parentCode: account.parentCode },
        },
      })
    } else if (account.noteParentRestore) {
      // Left the note: put it back where it was, if that parent still exists.
      const restore = account.noteParentRestore
      const targetExists = restore.parentId ? byId.has(restore.parentId) : false
      out.push({
        id: account.id,
        patch: {
          parentId: targetExists ? restore.parentId : undefined,
          parentCode: targetExists ? restore.parentCode : undefined,
          noteParentRestore: undefined,
        },
      })
    }
  }
  return out
}

/** Everything the note columns and the grouping need on the chart, merged per row. */
export function planNoteChartSync(accounts: Account[], notes: AccountNote[]): NoteChartWrite[] {
  const merged = new Map<string, Partial<Account>>()
  for (const { id, patch } of [...noteStampDiffs(notes, accounts), ...planNoteGrouping(accounts, notes)]) {
    merged.set(id, { ...(merged.get(id) || {}), ...patch })
  }
  return Array.from(merged.entries()).map(([id, patch]) => ({ id, patch }))
}

/* ------------------------------------------------------- releasing a note */

/**
 * The patch that takes one chart row off its note and puts it back where it
 * sat: the Note No. goes, the four note columns go, and — the part that is easy
 * to forget — a parent the note's grouping moved it under is restored from the
 * row's `noteParentRestore`. A recorded parent that no longer exists degrades to
 * top level. Everything else about the account (code, name, type, balances,
 * status) is never touched.
 */
export function releaseRowPatch(a: Account, byId: Map<string, Account>): Partial<Account> {
  const patch: Partial<Account> = {
    noteNo: undefined,
    noteDescription: undefined,
    noteStatement: undefined,
    noteStatus: undefined,
    noteAccounts: undefined,
  }
  const restore = a.noteParentRestore
  if (restore) {
    const target = restore.parentId ? byId.get(restore.parentId) : undefined
    patch.parentId = target ? restore.parentId : undefined
    patch.parentCode = target ? restore.parentCode : undefined
    patch.noteParentRestore = undefined
  }
  return patch
}

/**
 * Unmatch one account from a note, taking the descendants that inherit from it
 * out of the note as a branch. Its own note trace is cleared and its previous
 * parent is restored where available. If that parent still carries the same
 * note, move the account to the nearest ancestor outside the note (or to the
 * top level) so the account cannot immediately inherit the number again.
 * Accounts below it with their own Note No. are not changed.
 */
export function planNoteAccountUnmatch(accounts: Account[], accountId: string, noteNo: string): NoteChartWrite[] {
  const byId = new Map(accounts.map((account) => [account.id, account]))
  const account = byId.get(accountId)
  if (!account || noteOwnership(accounts).get(accountId)?.noteNo !== noteNo) return []

  const patch = releaseRowPatch(account, byId)
  const afterRelease = accounts.map((row) => row.id === accountId ? { ...row, ...patch } : row)
  const ownershipAfterRelease = noteOwnership(afterRelease)

  if (ownershipAfterRelease.get(accountId)?.noteNo === noteNo) {
    const projectedById = new Map(afterRelease.map((row) => [row.id, row]))
    let cursor = projectedById.get(accountId)
    let parent = cursor?.parentId ? projectedById.get(cursor.parentId) : undefined
    const seen = new Set([accountId])
    let outsideParent: Account | undefined
    while (parent && !seen.has(parent.id)) {
      if (ownershipAfterRelease.get(parent.id)?.noteNo !== noteNo) {
        outsideParent = parent
        break
      }
      seen.add(parent.id)
      cursor = parent
      parent = cursor.parentId ? projectedById.get(cursor.parentId) : undefined
    }
    patch.parentId = outsideParent?.id
    patch.parentCode = outsideParent?.code || undefined
  }

  return [{ id: accountId, patch }]
}

/** True when a row carries anything the note left on it. */
const hasNoteTrace = (a: Account): boolean =>
  !!(a.noteNo || a.noteDescription || a.noteStatement || a.noteStatus || a.noteAccounts || a.noteParentRestore)

/**
 * Everything the Chart of Accounts has to give back when notes are released —
 * *Unmap* (every note), deleting a note (its number), or clearing the notes
 * from a single row. One write per row, and it is complete: the follow-up sync
 * has nothing left to do, and nothing depends on the register still being there
 * (deleting the last note empties it).
 *
 * `noteNos` limits the release to those numbers; omit it to release every row
 * that carries any note data.
 */
export function planNoteRelease(accounts: Account[], noteNos?: Set<string>): NoteChartWrite[] {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const ownership = noteOwnership(accounts)
  const out: NoteChartWrite[] = []
  for (const a of accounts) {
    // A row answers to its own number, or to the one it inherits.
    const reached = a.noteNo || ownership.get(a.id)?.noteNo
    const released = noteNos ? !!reached && noteNos.has(reached) : hasNoteTrace(a)
    if (!released) continue
    // Only the rows that actually carry something are written.
    if (!hasNoteTrace(a)) continue
    out.push({ id: a.id, patch: releaseRowPatch(a, byId) })
  }
  return out
}

/* -------------------------------------------- source-table (chart) stamping */

export type NoteStamp = { id: string; patch: Partial<Account> }

/**
 * The note columns as they should read on each Chart of Accounts source row:
 * the note metadata for the row's note_no, plus the automatic account count.
 * Rows that already carry the right values are omitted so the caller can write
 * back only real changes. Apply through AppContext.patchAccounts so the write
 * touches nothing but these columns.
 */
export function noteStampDiffs(notes: AccountNote[], accounts: Account[]): NoteStamp[] {
  // No early return on an empty register: rows left holding note columns after
  // the last note was deleted (or unmapped) still have to be cleaned.
  const byNo = new Map(notes.map((n) => {
    const normalized = normalizeNote(n, accounts)
    return [normalized.noteNo, normalized] as const
  }))
  const ownership = noteOwnership(accounts)
  const out: NoteStamp[] = []
  for (const account of accounts) {
    // Own Note No. or inherited from the note account — both belong to the note.
    const noteNo = noteNoOf(account, ownership)
    if (!noteNo) {
      // A row without a note must not keep stale note metadata.
      if (account.noteDescription || account.noteStatement || account.noteStatus || account.noteAccounts) {
        out.push({ id: account.id, patch: { noteDescription: undefined, noteStatement: undefined, noteStatus: undefined, noteAccounts: undefined } })
      }
      continue
    }
    const note = byNo.get(noteNo)
    // The count is the note's, and the note's account is the row that says so:
    // `note_accounts` is written on the note account only, never repeated down
    // the sub-accounts that follow it in the cascade.
    const onNoteAccount = !ownership.get(account.id)?.inherited
    const patch: Partial<Account> = {
      noteDescription: note?.noteDescription,
      noteStatement: note?.noteStatement,
      noteStatus: note?.noteStatus,
      noteAccounts: onNoteAccount
        ? (note ? noteAccountCountOf(note, accounts) : accountsForNote(noteNo, accounts).length)
        : undefined,
    }
    const differs =
      (account.noteDescription || undefined) !== patch.noteDescription ||
      (account.noteStatement || undefined) !== patch.noteStatement ||
      (account.noteStatus || undefined) !== patch.noteStatus ||
      (account.noteAccounts ?? undefined) !== patch.noteAccounts
    if (differs) out.push({ id: account.id, patch })
  }
  return out
}
