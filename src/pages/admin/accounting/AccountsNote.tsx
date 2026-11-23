import { Fragment, useEffect, useMemo, useState } from 'react'
import { Plus, Search, RotateCcw, ChevronsUpDown, ChevronDown, ChevronRight, WandSparkles, Info } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Switch, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { loadAccountNotes, saveAccountNotes } from '../../../lib/accounting'
import { clearAllNoteData, describeClear, planChartUnmap, stashClearToast, takeClearToast } from '../../../lib/notesReset'
import { describeMapping, matchAccountsToNotes } from '../../../lib/noteMapping'
import { nextNoteNumber, planNoteSave } from '../../../lib/noteSave'
import { indentFor, orderByParent } from '../../../lib/hierarchy'
import {
  NOTE_DESCRIPTION_MAX,
  NOTE_STATEMENTS,
  NOTE_STATUSES,
  isNoteActive,
  noteAccountCountOf,
  coveredAccounts,
  descendantIds,
  isMapCandidate,
  isReservedAccountNoteNo,
  noteOwnership,
  planNoteAccountUnmatch,
  planNoteRelease,
  releaseRowPatch,
  normalizeNote,
  noteDescriptionOf,
  notesFromChart,
  planNoteChartSync,
  noteStatementOf,
  noteStatusOf,
} from '../../../lib/noteMeta'
import type { Account, AccountNote, NoteStatement, NoteStatus } from '../../../types'

/** Filter options — note_statement (all five statements the notes can sit on). */
const STATEMENTS: { value: NoteStatement; label: string }[] = NOTE_STATEMENTS.map((s) => ({ value: s, label: s }))
const statementLabel = (v: NoteStatement) => v

type Form = {
  id?: string
  noteNo: string
  /** The chart-of-accounts account chosen as this note (its parent account). */
  accountId: string
  name: string
  /** Which statement the note is disclosed on (note_statement). Blank = derive
   *  it from the account type when the note is created. */
  noteStatement: NoteStatement | ''
  parentId: string
  accountIds: string[]
  /** Purpose/business function of the note (note_description, 500 chars). */
  noteDescription: string
  /** Availability for new assignments (note_status) — defaults to Active. */
  noteStatus: NoteStatus
}

const blank = (): Form => ({
  noteNo: '', accountId: '', name: '', noteStatement: '', parentId: '',
  accountIds: [], noteDescription: '', noteStatus: 'Active',
})

/**
 * Accounting → Chart of Accounts → Accounts Note.
 *
 * The numbered disclosures the financial statements refer to, **as they come
 * from the Chart of Accounts**: one note per Note No. in use on the chart, its
 * accounts being the rows that carry that number. This page owns the wording —
 * description, statement and status — and nothing else: note numbers are never
 * renumbered, accounts are never created, and a note stops existing when the
 * chart stops referring to it (unless it is Inactive and kept for history).
 *
 * The list mirrors Master Accounts: the same filter bar, the same hover
 * Edit | Delete actions, the same parent-first list, and the same modal form.
 */
export function AccountsNote() {
  const app = useApp()
  const { accounts } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()

  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

  /**
   * The register is saved metadata keyed by note number. Which notes exist, what
   * they are called and which accounts they carry all come from the Chart of
   * Accounts (see the sync effect below) — nothing here renumbers or renames.
   */
  const [notes, setNotes] = useState<AccountNote[]>(() => loadAccountNotes())

  const persist = (next: AccountNote[]) => { setNotes(next); saveAccountNotes(next) }

  /**
   * Notes as they come from the Chart of Accounts: one note per Note No.
   * (`note_no`) in use on the chart, its accounts being the Chart of Accounts
   * rows carrying that number. Saved metadata is kept per note number, so
   * descriptions, statements and statuses survive, and inactive notes whose
   * number has left the chart stay on file for historical reporting.
   *
   * Also keeps the four note columns and the automatic note_accounts count in
   * step on the source rows. Idempotent — the effect stops when nothing differs.
   */
  useEffect(() => {
    const derived = notesFromChart(accounts, notes)
    if (derived.changed) persist(derived.notes)
    // note columns + the grouping that makes every account on a note a
    // sub-account of the note account, in one write.
    const sync = planNoteChartSync(accounts, derived.notes)
    if (sync.length) app.patchAccounts(sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, accounts])

  const [noteQ, setNoteQ] = useState('')
  const [statementFilter, setStatementFilter] = useState('')
  // note_status filter — defaults to Active so the working register shows first.
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Inactive' | ''>('Active')
  const [applied, setApplied] = useState<{ noteQ: string; statement: '' | NoteStatement; status: '' | NoteStatus }>({ noteQ: '', statement: '', status: 'Active' })
  const [sortBy, setSortBy] = useState<'noteNo' | 'name' | 'statement' | 'status'>('noteNo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(() => new Set())
  const [editing, setEditing] = useState<Form | null>(null)
  const [coverQ, setCoverQ] = useState('')
  const [deleting, setDeleting] = useState<AccountNote | null>(null)
  const [unmatching, setUnmatching] = useState<{ note: AccountNote; account: Account } | null>(null)
  const [clearAllOpen, setClearAllOpen] = useState(false)

  /** Every Chart of Accounts account is available, including bank accounts. */
  const linkableAccounts = useMemo(
    () => [...accounts]
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name)),
    [accounts],
  )
  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.code ? `${a.code} - ` : ''}${a.name}` : id
  }
  /** The account a note is anchored to (its "note name"). */
  const accountOf = (n: AccountNote) => accounts.find((a) => a.id === n.accountId)
  // A stored note_statement always wins; the account type only supplies the
  // default for a note that has not been categorised yet.
  /** A note is an account: always label it with the chart account's name. */
  const noteName = (n: AccountNote) => accountOf(n)?.name || n.name
  const noteStatement = (n: AccountNote): NoteStatement => noteStatementOf(n, accountOf(n))
  /** note_status — Active unless the register says otherwise. */
  const noteStatus = (n: AccountNote): NoteStatus => noteStatusOf(n)
  /** note_accounts — the automatic count of Chart of Accounts rows on the note. */
  const noteAccounts = (n: AccountNote): number => noteAccountCountOf(n, accounts)
  /**
   * Where each chart row's note number comes from — its own Note No., or the
   * note account above it. Assigning an account to a note puts its whole
   * subtree on the note, so the count below includes the sub-accounts.
   */
  const ownership = useMemo(() => noteOwnership(accounts), [accounts])
  /** The note account's chart descendants, ordered parent-first for its expand row. */
  const subAccountsByNoteId = useMemo(() => {
    const result = new Map<string, { rows: Account[]; depthOf: Map<string, number> }>()
    for (const note of notes) {
      const anchor = accountOf(note)
      if (!anchor) { result.set(note.id, { rows: [], depthOf: new Map() }); continue }
      const descendants = descendantIds(accounts, anchor.id)
      const children = accounts.filter((account) =>
        descendants.has(account.id) && ownership.get(account.id)?.noteNo === note.noteNo)
      const ordered = orderByParent(children, {
        parentIdOf: (account) => account.parentId || (account.parentCode ? accounts.find((parent) => parent.code === account.parentCode)?.id : undefined),
        compare: (a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }) || a.name.localeCompare(b.name),
      })
      result.set(note.id, ordered)
    }
    return result
  }, [notes, accounts, ownership])
  /** How many chart rows a note number actually covers — the cascade included. */
  const coverOf = (noteNo: string): number => coveredAccounts(noteNo, accounts).length
  /** The number the open form will leave on the chart: what is typed, else the note's own. */
  const liveNoteNoOf = (form: Form | null): string =>
    form ? (form.noteNo || '').trim() || (form.id ? notes.find((n) => n.id === form.id)?.noteNo || '' : '') : ''
  /** note_description — the stored wording for the note. */
  const noteDescription = (n: AccountNote): string => noteDescriptionOf(n)

  /** Every note sits directly under its parent note, one indent per generation. */
  const { rows, depthOf } = useMemo(() => {
    const matched = notes.filter((n) => {
      // Search covers note number, note name and note description.
      if (applied.noteQ && !`${n.noteNo} ${noteName(n)} ${noteDescription(n)}`.toLowerCase().includes(applied.noteQ.toLowerCase())) return false
      if (applied.statement && noteStatement(n) !== applied.statement) return false
      if (applied.status && noteStatus(n) !== applied.status) return false
      return true
    })
    const key = (n: AccountNote) =>
      sortBy === 'name' ? noteName(n)
        : sortBy === 'statement' ? statementLabel(noteStatement(n))
          : sortBy === 'status' ? noteStatus(n)
            : n.noteNo
    const cmp = (a: AccountNote, b: AccountNote) => {
      const c = key(a).localeCompare(key(b), undefined, { numeric: true })
      return sortDir === 'asc' ? c : -c
    }
    return orderByParent(matched, { parentIdOf: (n) => n.parentId, compare: cmp })
  }, [notes, applied, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const headerSort = (col: 'noteNo' | 'name' | 'statement' | 'status') => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }
  const toggleExpandedNote = (noteId: string) => setExpandedNoteIds((current) => {
    const next = new Set(current)
    if (next.has(noteId)) next.delete(noteId)
    else next.add(noteId)
    return next
  })

  const doSearch = () => setApplied({ noteQ: noteQ.trim(), statement: statementFilter as '' | NoteStatement, status: statusFilter })
  const doReset = () => {
    setNoteQ(''); setStatementFilter(''); setStatusFilter('Active')
    setApplied({ noteQ: '', statement: '', status: 'Active' })
  }

  /**
   * Assign Chart of Accounts rows to the notes on file. This is an assistant,
   * not a generator: it only fills rows that have no Note No. yet, matches them
   * against the active notes' names and wording, and never invents a note,
   * edits a note or overwrites an existing assignment. Anything it cannot place
   * confidently is left for you and reported.
   */
  const autoMapAccounts = () => {
    // Open notes **and parked definitions** — after Unmap every note is parked,
    // and pressing Map is exactly how they are meant to come back.
    const candidates = notes.filter((n) => isMapCandidate(n))
    if (!candidates.length) {
      toast.error('No notes to map to', 'Add your notes first — Map assigns Chart of Accounts rows to the notes you have entered. It never creates note numbers.')
      return
    }
    const result = matchAccountsToNotes(accounts, notes)
    if (!result.updates.length) {
      toast.info(
        'Nothing left to map',
        result.unmatched.length
          ? `${result.unmatched.length} account(s) carry no Note No. and none of your note names matched — assign those by hand.`
          : 'Every account already has a Note No.',
      )
      return
    }
    app.patchAccounts(result.updates)
    const covered = Array.from(result.byNoteNo.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    // Parked notes that just got rows back come out of this Active — the
    // derivation does that as soon as the chart refers to them again.
    const revived = notes.filter((n) => n.parked && result.byNoteNo.has(n.noteNo)).map((n) => n.noteNo)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    toast.success(
      `${result.updates.length} account(s) mapped to your notes`,
      [
        `${describeMapping(result)} — notes ${covered.join(', ')}.`,
        revived.length ? `${revived.length} note(s) (${revived.join(', ')}) were parked after Unmap and are back Active now.` : '',
        result.unmatched.length ? ' The rest had no name match; assign them from the chart or the note form.' : '',
      ].filter(Boolean).join(' '),
    )
    app.log(user?.id || 'system', 'UPDATE', 'Account note', `Mapped chart accounts to existing notes — ${describeMapping(result)}`)
  }

  /**
   * Unmap the Chart of Accounts: every Note No. is taken off the rows and the
   * notes that came from them stop listing, but their definitions — wording,
   * statement, status — are parked as Inactive so re-assigning a number brings
   * the note straight back. Nothing is deleted and no account is touched.
   */
  const unmapChartAccounts = () => {
    const { updates, register, parked } = planChartUnmap(accounts, notes)
    if (!updates.length) {
      toast.info('Nothing to unmap', 'No Chart of Accounts row carries a Note No. at the moment.')
      return
    }
    app.patchAccounts(updates)
    persist(register)
    // Nothing was deleted — the notes are parked, so show them rather than
    // leaving the list looking emptied by the Active-only filter.
    setStatusFilter('')
    setStatementFilter('')
    setNoteQ('')
    setApplied({ noteQ: '', statement: '', status: '' })
    app.log(user?.id || 'system', 'UPDATE', 'Account note', `Unmapped the Chart of Accounts — ${updates.length} row(s) released, ${parked} note definition(s) kept as inactive`)
    toast.success(
      `${updates.length} chart row(s) unmapped — the notes are still here`,
      parked
        ? `Your ${parked} note definition(s) are listed below, wording intact. Press Map Chart of Accounts — or switch a note on and give an account a Note No. — and they come back exactly as written.`
        : 'The chart no longer refers to any note.',
    )
  }

  /** Confirm before wiping: every note, description and note number goes. */
  const clearEverything = () => {
    const summary = clearAllNoteData()
    app.log(user?.id || 'system', 'DELETE', 'Account note', `Cleared all note data — ${describeClear(summary)}`)
    // The clear reloads the app so the Chart of Accounts comes back with a clean
    // store; the summary waits in sessionStorage and is announced on the way in.
    stashClearToast(summary)
    setClearAllOpen(false)
    window.location.reload()
  }

  // Announce a clear that happened just before the reload.
  useEffect(() => {
    const summary = takeClearToast()
    if (!summary) return
    toast.success('Accounts Note cleared', `${describeClear(summary)}. Nothing else was touched — add your own notes whenever you are ready.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openNew = () => { setCoverQ(''); setEditing(blank()) }
  const openEdit = (n: AccountNote) => {
    setCoverQ('')
    setEditing({
      id: n.id, noteNo: n.noteNo,
      // Prefer the stored link; fall back to matching a legacy note by its name.
      accountId: n.accountId || linkableAccounts.find((a) => a.name === n.name)?.id || '',
      name: n.name,
      noteStatement: noteStatement(n),
      parentId: n.parentId || '',
      // The note's accounts are the chart rows carrying its number.
      accountIds: accounts.filter((a) => a.noteNo === n.noteNo).map((a) => a.id),
      noteDescription: noteDescription(n), noteStatus: noteStatus(n),
    })
  }

  const save = () => {
    if (!editing) return
    const plan = planNoteSave({ editing, notes, accounts, companyId: app.activeCompanyId })
    if (!plan.ok) { toast.error(plan.title, plan.desc); return }
    persist(plan.register)
    if (plan.chartUpdates.length) app.patchAccounts(plan.chartUpdates)
    app.log(
      user?.id || 'system',
      plan.isNew ? 'CREATE' : 'UPDATE',
      'Account note',
      `${plan.isNew ? 'Created' : 'Updated'} note ${plan.note.noteNo} ${plan.note.name} — ${plan.chartUpdates.length} chart row(s) changed`,
    )
    toast.success(
      plan.isNew ? 'Note created' : 'Note updated',
      `Note ${plan.note.noteNo} covers ${plan.coveredCount} chart account(s).${plan.newAssignments ? ` ${plan.newAssignments} account(s) joined the note.` : ''}`,
    )
    setEditing(null)
  }

  /**
   * Remove this note number from the account being edited. The account keeps
   * everything else — only its note reference goes. If no chart row carries the
   * number afterwards the note stops existing (unless it is inactive and kept
   * for historical reporting).
   */
  const reverse = () => {
    if (!editing?.id) return
    const note = notes.find((n) => n.id === editing.id)
    if (!note || !editing.accountId) return
    const account = accounts.find((a) => a.id === editing.accountId)
    // Read the chart as it will be: the sub-accounts that followed this account
    // are released with it, the ones under another numbered row stay.
    const projected = accounts.map((a) => (a.id === editing.accountId ? { ...a, noteNo: undefined } : a))
    const remaining = coveredAccounts(note.noteNo, projected).length
    // One complete write for the row — number, note columns and the parent it
    // sat under before the note grouped it.
    if (account) {
      const byId = new Map(accounts.map((a) => [a.id, a]))
      app.patchAccounts([{ id: account.id, patch: releaseRowPatch(account, byId) }])
    }
    persist(notes.map((n) => (n.id === note.id ? { ...n, accountId: undefined } : n)))
    app.log(user?.id || 'system', 'UPDATE', 'Account note', `Removed note ${note.noteNo} from ${account?.name || note.name}`)
    toast.success(
      `Note ${note.noteNo} removed from ${account?.name || note.name}`,
      remaining
        ? `The note still covers ${remaining} other chart account(s), sub-accounts included. The account is back where it sat before the note, itself untouched.`
        : 'No chart row carries this note number now, so the note no longer appears — the account is back where it sat before the note, itself untouched.',
    )
    setEditing(null)
  }

  /**
   * Delete the note: every chart row is released from the note number, so the
   * note stops coming from the chart. The accounts themselves are kept.
   */
  const doDelete = () => {
    if (!deleting) return
    // The release is complete in one write: the Note No. comes off the rows that
    // carry it, the note columns come off everything the note reached (the
    // sub-accounts included) and any row the note's grouping moved is put back
    // under the parent it sat under before. Nothing is left for a later pass —
    // which matters here, because deleting the last note empties the register.
    const covered = coverOf(deleting.noteNo)
    const release = planNoteRelease(accounts, new Set([deleting.noteNo]))
    if (release.length) app.patchAccounts(release)
    persist(notes.filter((n) => n.id !== deleting.id))
    app.log(user?.id || 'system', 'DELETE', 'Account note', `Deleted note ${deleting.noteNo} ${deleting.name} — ${covered} account(s) released`)
    toast.success(
      'Note deleted',
      `${deleting.name} was removed and ${covered} chart account(s) released — each one is back where it sat before the note, with its code, balance and status untouched.`,
    )
    setDeleting(null)
  }

  const doUnmatchSubAccount = () => {
    if (!unmatching) return
    const { note, account: requestedAccount } = unmatching
    const account = accounts.find((row) => row.id === requestedAccount.id)
    if (!account) {
      toast.info('Account no longer available', 'Refresh the list and try again.')
      setUnmatching(null)
      return
    }
    const beforeOwnership = noteOwnership(accounts)
    const writes = planNoteAccountUnmatch(accounts, account.id, note.noteNo)
    if (!writes.length) {
      toast.info('Account is no longer on this note', `${account.name} is not currently assigned to Note ${note.noteNo}.`)
      setUnmatching(null)
      return
    }
    const projected = accounts.map((row) => row.id === account.id ? { ...row, ...writes[0].patch } : row)
    const afterOwnership = noteOwnership(projected)
    const releasedDescendants = accounts.filter((row) =>
      row.id !== account.id && beforeOwnership.get(row.id)?.noteNo === note.noteNo && afterOwnership.get(row.id)?.noteNo !== note.noteNo).length

    app.patchAccounts(writes)
    app.log(user?.id || 'system', 'UPDATE', 'Account note', `Unmatched ${account.name} and its inheriting sub-accounts from Note ${note.noteNo}`)
    toast.success(
      'Sub-account unmatched',
      `${account.name} and ${releasedDescendants} inheriting sub-account(s) are no longer on Note ${note.noteNo}. Other accounts assigned to the note remain linked.`,
    )
    setUnmatching(null)
  }

  const toggleAccount = (id: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      accountIds: editing.accountIds.includes(id)
        ? editing.accountIds.filter((x) => x !== id)
        : [...editing.accountIds, id],
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts Note"
        desc="The notes the Chart of Accounts refers to through Note No. — one note per note number in use, with the terminology and wording the statement disclosures need."
        actions={canManage ? <div className="flex gap-2"><Button variant="outline" onClick={autoMapAccounts} title="Assign Chart of Accounts rows that have no Note No. yet to the notes you have entered — it never creates or overwrites a note"><WandSparkles className="size-4" /> Map Chart of Accounts</Button><Button variant="outline" onClick={unmapChartAccounts} title="Take every Note No. off the Chart of Accounts but keep your note definitions (wording, statement, status) on file as inactive">Unmap Chart of Accounts</Button><Button variant="outline" onClick={() => setClearAllOpen(true)} title="Remove every note, description and note number — your accounts are kept">Clear all</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button></div> : undefined}
      />

      {(notes.some((note) => isReservedAccountNoteNo(note.noteNo)) || accounts.some((account) => isReservedAccountNoteNo(account.noteNo))) && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
          <Info className="size-4 shrink-0" />
          <span>Note No. 1 is reserved for Accounting Policies. An existing Accounts Note or Chart of Accounts row still uses 1; edit the note and change it to 2 or higher to renumber its assignments.</span>
        </div>
      )}

      {/* The chart is where notes come from — say so plainly when it carries none. */}
      {notes.length > 0 && !accounts.some((a) => a.noteNo) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
          <Info className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            The Chart of Accounts is unmapped — no account carries a Note No., so none of these notes is in use right now. Your{' '}
            {notes.length} definition{notes.length === 1 ? '' : 's'} (wording, statement, status) {notes.length === 1 ? 'is' : 'are'} kept below. Press{' '}
            <span className="font-semibold">Map Chart of Accounts</span> to put them back on the rows they fit, switch a note on and give an account its Note No. under{' '}
            <span className="font-semibold">Chart of Accounts</span> — either way a note comes back exactly as written.
          </span>
        </div>
      )}

      {/* Filters — same bar as Master Accounts */}
      <div className="rounded-2xl border border-line bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Note">
            <Input value={noteQ} onChange={(e) => setNoteQ(e.target.value)} placeholder="Search by note number, name or description" onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
          </Field>
          <Field label="Note statement">
            <Select value={statementFilter} onChange={(e) => setStatementFilter(e.target.value)}>
              <option value="">Nothing selected</option>
              {STATEMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Note status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | NoteStatus)}>
              <option value="">All</option>
              {NOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button onClick={doSearch}><Search className="size-4" /> Search</Button>
            <Button variant="outline" onClick={doReset}><RotateCcw className="size-4" /> Reset</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-24">
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <ExportButtons
          filename="accounts-note"
          rows={rows.map((n) => ({
            'Note No.': n.noteNo,
            Name: noteName(n),
            'Note description': noteDescription(n),
            'Note statement': statementLabel(noteStatement(n)),
            'Note accounts': noteAccounts(n),
            'Note status': noteStatus(n),
          }))}
          onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        {/* Keep Note No. tight to its sort control. The two text columns take
            the remaining width rather than leaving a large gutter before Name. */}
        <table className="w-full min-w-[1160px] table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 96 }} />
            <col />
            <col style={{ width: 320 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 200 }} />
          </colgroup>
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist">
            <tr>
              <th className="w-10 px-2 py-2.5" aria-label="Expand note accounts" />
              <th className="cursor-pointer select-none whitespace-nowrap px-2 py-2.5" onClick={() => headerSort('noteNo')}>
                <span className="inline-flex items-center gap-0.5">Note No. <ChevronsUpDown className="size-3 text-mist" /></span>
              </th>
              <th className="cursor-pointer select-none px-2 py-2.5" onClick={() => headerSort('name')}>Name</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('statement')}>
                <span className="inline-flex items-center gap-1">Statement <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
              <th className="px-3 py-2.5 text-center" title="Chart of Accounts records on this note — the rows carrying the number and the sub-accounts beneath them (auto)">Note accounts</th>
              <th className="cursor-pointer select-none px-3 py-2.5 text-center" onClick={() => headerSort('status')}>
                <span className="inline-flex items-center gap-1">Status <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paged.map((n) => {
              const accountTree = subAccountsByNoteId.get(n.id)
              const subAccounts = accountTree?.rows || []
              const expanded = expandedNoteIds.has(n.id)
              return (
                <Fragment key={n.id}>
                  <tr>
                    <td className="px-2 py-2.5 text-center">
                      {subAccounts.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpandedNote(n.id)}
                          className="inline-grid size-7 place-items-center rounded-md text-mist transition hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-sky-300"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Collapse' : 'Expand'} sub-accounts for ${noteName(n)}`}
                          title={`${expanded ? 'Collapse' : 'Show'} sub-accounts`}
                        >
                          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                      ) : <span className="inline-block size-7" />}
                    </td>
                    <td className="px-2 py-2.5 font-mono" title={`Note ${n.noteNo}`}>{n.noteNo}</td>
                    <td className="group px-2 py-2.5 font-semibold" style={{ paddingLeft: indentFor(depthOf.get(n.id)) }}>
                      <div className="text-sm font-semibold leading-snug">{noteName(n)}</div>
                      <div className="mt-0.5 hidden items-center gap-2 text-[13px] group-hover:flex">
                        {canManage && (
                          <button type="button" className="font-medium text-mist transition hover:text-lime" onClick={() => openEdit(n)}>Edit</button>
                        )}
                        {canManage && canDelete && <span className="text-mist/40">|</span>}
                        {canDelete && (
                          <button type="button" className="font-semibold text-red-600 transition hover:text-red-700" onClick={() => setDeleting(n)}>Delete</button>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[320px] px-3 py-2.5 text-mist">
                      <span className="line-clamp-2" title={noteDescription(n) || undefined}>{noteDescription(n) || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">{statementLabel(noteStatement(n))}</td>
                    <td className="px-3 py-2.5 text-center text-mist" title="Chart of Accounts rows carrying this note number (auto)">
                      {noteAccounts(n) ? noteAccounts(n) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        {n.parked && (
                          <span
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                            title="Unmapped: this definition has no chart accounts right now. Map Chart of Accounts, or assign its Note No. to an account, and it comes back in use."
                          >
                            Unmapped
                          </span>
                        )}
                        <Switch
                          checked={noteStatus(n) === 'Active'}
                          disabled={!canManage}
                          onChange={(next) => {
                            const noteStatus: NoteStatus = next ? 'Active' : 'Inactive'
                            // A note with no chart rows behind it can still be switched
                            // on — it is a definition waiting to be mapped. The parked
                            // flag is what keeps it on file until rows arrive, so a
                            // parked note never vanishes by being reactivated.
                            const hasRows = accounts.some((a) => a.noteNo === n.noteNo)
                            persist(notes.map((x) => (x.id === n.id
                              ? normalizeNote({
                                ...x,
                                noteStatus,
                                status: next ? 'active' : 'inactive',
                                parked: next ? (hasRows ? undefined : true) : x.parked,
                              }, accounts)
                              : x)))
                            toast.success(next ? 'Note activated' : 'Note deactivated',
                              next
                                ? (hasRows
                                  ? n.name
                                  : `${n.name} has no chart accounts yet — switch to Map Chart of Accounts, or give an account its Note No., to bring its accounts back.`)
                                : `${n.name} — closed to new assignments, kept for historical reporting.`)
                          }}
                          aria-label={`Toggle ${n.name} active`}
                        />
                      </div>
                    </td>
                  </tr>
                  {expanded && subAccounts.length > 0 && (
                    <tr className="bg-zinc-50/70 dark:bg-white/[0.02]">
                      <td className="px-0 py-0" colSpan={7}>
                        <div className="px-6 py-3">
                          <p className="mb-2 text-xs font-semibold text-mist">Sub-accounts under {noteName(n)} ({subAccounts.length})</p>
                          <table className="w-full min-w-[760px] text-xs">
                            <thead>
                              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-mist">
                                <th className="py-1.5 pr-3">Account Code</th>
                                <th className="py-1.5 pr-3">Sub-account Name</th>
                                <th className="py-1.5 pr-3">Account Type</th>
                                <th className="py-1.5 pr-3 text-right">Note No.</th>
                                <th className="py-1.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subAccounts.map((account) => {
                                const childDepth = accountTree?.depthOf.get(account.id) || 0
                                return (
                                  <tr key={account.id} className="border-t border-line/50">
                                    <td className="py-1.5 pr-3 font-mono">{account.code || '—'}</td>
                                    <td className="py-1.5 pr-3" style={{ paddingLeft: 12 + childDepth * 20 }}>{account.name}</td>
                                    <td className="py-1.5 pr-3 text-mist">{account.detailType || account.type}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono">{ownership.get(account.id)?.noteNo || '—'}</td>
                                    <td className="py-1.5 text-right">
                                      {canManage && (
                                        <button
                                          type="button"
                                          onClick={() => setUnmatching({ note: n, account })}
                                          className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                                          title={`Unmatch ${account.name} and descendants inheriting Note ${n.noteNo}`}
                                        >
                                          Unmatch
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!paged.length && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-mist">
                  {notes.length > 0 ? (
                    <>
                      No notes match the current filters — {notes.length} note{notes.length === 1 ? '' : 's'} {notes.length === 1 ? 'is' : 'are'} on file
                      {applied.status || applied.statement || applied.noteQ ? ` (showing ${applied.status ? applied.status.toUpperCase() : 'all statuses'}${applied.statement ? `, ${applied.statement}` : ''})` : ''}.{' '}
                      <button
                        type="button"
                        className="font-semibold text-lime underline"
                        onClick={doReset}
                      >
                        Show all notes
                      </button>
                    </>
                  ) : (
                    <>
                      No notes yet — a note appears here as soon as a Chart of Accounts row carries its Note No. Give an account a note number under <span className="font-semibold">Chart of Accounts</span>, or use <span className="font-semibold">Add</span>.
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
        <span>
          {rows.length
            ? `Showing ${(curPage - 1) * pageSize + 1} to ${Math.min(curPage * pageSize, rows.length)} of ${rows.length} entries`
            : 'Showing 0 to 0 of 0 entries'}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>Next</Button>
        </div>
      </div>

      {/* Add / Edit — the Master Accounts form, for notes */}
      {/* wide: the form's helper text and the coverage list need the room —
          at the default width the longest hint alone wrapped to four lines. */}
      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing?.id ? 'Edit Accounts Note' : 'Add Accounts Note'}>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Note account (from the Chart of Accounts)" required>
                  <Select
                    value={editing.accountId}
                    onChange={(e) => {
                      const acc = accounts.find((a) => a.id === e.target.value)
                      setEditing({
                        ...editing,
                        accountId: e.target.value,
                        name: acc?.name || '',
                      })
                    }}
                    placeholder="Select an account…"
                  >
                    <option value="">Please Select…</option>
                    {/* Any account may name a note — except one that already
                        answers to a different note number. */}
                    {linkableAccounts.map((a) => {
                      // The account's own note is fine — that is the current value,
                      // and it is what a renumber looks like while you type it.
                      // An account that *inherits* a note (a sub-account of a note
                      // account) answers to that note too, so it is just as blocked.
                      const owned = ownership.get(a.id)
                      const owner = owned ? notes.find((n) => n.noteNo === owned.noteNo) : undefined
                      const blocked = !!owner && owner.id !== editing.id
                      return (
                        <option key={a.id} value={a.id} disabled={blocked}>
                          {accountLabel(a.id)}{blocked ? ` — on Note ${owner!.noteNo}${owned!.inherited ? ' (sub-account)' : ''}` : ''}
                        </option>
                      )
                    })}
                  </Select>
                </Field>
              </div>
              <Field label="Note No." hint="Note 1 is reserved for Accounting Policies; automatic Accounts Notes start at 2.">
                <Input
                  value={editing.noteNo}
                  onChange={(e) => setEditing({ ...editing, noteNo: e.target.value })}
                  className="font-mono"
                  placeholder="Auto (starts at 2)"
                  list="accounts-note-numbers"
                />
                <datalist id="accounts-note-numbers">
                  {accounts.map((a) => a.noteNo).filter((v, i, arr): v is string => !!v && !isReservedAccountNoteNo(v) && arr.indexOf(v) === i)
                    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
                    .map((no) => <option key={no} value={no} />)}
                </datalist>
              </Field>
              {/* Full width, under both fields: the sentence reads in two lines
                  here instead of wrapping to four inside the account column. */}
              <p className="text-xs text-mist sm:col-span-3">
                The note is named by this account, and the account joins the note — the other accounts on the note become its sub-accounts in the Chart of Accounts. Accounts already on another note are listed greyed out.
              </p>
            </div>

            <Field label="Chart of Accounts in this note">
              {(() => {
                // The note's accounts are the Chart of Accounts rows carrying its
                // Note No. Ticking a box assigns the number to that row (unticking
                // removes it) — the note itself is always built from the chart, so
                // nothing here re-parents an account.
                const anchor = accounts.find((a) => a.id === editing.accountId)
                // The note number this modal will leave on the chart: the one
                // being typed, else the note's own — what a sub-account follows.
                const liveNo = liveNoteNoOf(editing)
                /**
                 * A row is on this note when it carries the number or inherits
                 * it (a sub-account of any account carrying the number). Rows on
                 * a *different* note follow it — shown (greyed) so they can be
                 * found, but not selectable here.
                 */
                const ownerNoteOf = (a: Account) => {
                  const owned = ownership.get(a.id)
                  if (!owned) return undefined
                  const owner = notes.find((n) => n.noteNo === owned.noteNo)
                  return owner && owner.id !== editing.id ? owner : undefined
                }
                const inheritsNoteOf = (a: Account) => {
                  const owned = ownership.get(a.id)
                  return !!owned && owned.inherited && !!liveNo && owned.noteNo === liveNo
                }
                const available = linkableAccounts.filter((a) => a.id !== editing.accountId)
                const t = coverQ.trim().toLowerCase()
                const shown = t ? available.filter((a) => accountLabel(a.id).toLowerCase().includes(t)) : available
                const ownedElsewhere = shown.filter(ownerNoteOf).length
                const inherited = shown.filter(inheritsNoteOf).length
                // Business rule: an Inactive note cannot take on new accounts.
                const lockedAdd = editing.noteStatus === 'Inactive'
                const count = new Set([
                  ...editing.accountIds,
                  ...accounts.filter((a) => inheritsNoteOf(a)).map((a) => a.id),
                  editing.accountId,
                ].filter(Boolean)).size
                return (
                  <>
                    {lockedAdd && (
                      <p className="mb-2 rounded-lg border border-amber-300/40 bg-amber-50/60 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        This note is <span className="font-semibold">inactive</span>. Existing accounts stay linked for historical reporting; switch the status to Active to assign new ones.
                      </p>
                    )}
                    <SearchField value={coverQ} onChange={setCoverQ} placeholder="Search accounts…" className="mb-2 max-w-full" />
                    <div className="max-h-48 space-y-1 overflow-auto rounded-xl border border-line p-2" data-testid="note-accounts">
                      {anchor && (
                        <label className="flex items-center gap-2 rounded bg-blue-500/5 px-1 py-0.5 text-sm">
                          <input type="checkbox" className="size-4 accent-blue-600" checked disabled aria-label={`${anchor.name} is the note account`} />
                          <span className="min-w-0 truncate font-semibold">{accountLabel(anchor.id)}</span>
                          <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide text-mist">note account</span>
                        </label>
                      )}
                      {shown.map((a) => {
                        const owner = ownerNoteOf(a)
                        // A sub-account of a note account is on the note already:
                        // ticked, and not something to untick here — its number
                        // lives on the account above it.
                        const viaNote = !owner && inheritsNoteOf(a)
                        const viaName = viaNote ? accounts.find((x) => x.id === ownership.get(a.id)!.ownerId)?.name || '' : ''
                        return (
                          <label key={a.id} className={`flex items-center gap-2 rounded px-1 py-0.5 text-sm ${owner ? 'opacity-60' : viaNote ? 'cursor-default opacity-80' : 'cursor-pointer hover:bg-white/[0.04]'}`}>
                            <input
                              type="checkbox"
                              className="size-4 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                              checked={editing.accountIds.includes(a.id) || viaNote}
                              disabled={!!owner || viaNote || (lockedAdd && !editing.accountIds.includes(a.id))}
                              onChange={() => toggleAccount(a.id)}
                              aria-label={`Include ${a.name}`}
                            />
                            <span className="min-w-0 truncate">{accountLabel(a.id)}</span>
                            {owner && <span className="ml-auto shrink-0 text-[11px] text-mist">on Note {owner.noteNo}</span>}
                            {viaNote && (
                              <span className="ml-auto shrink-0 text-[11px] text-mist" title={`Sub-account of ${viaName || 'the note account'} — it follows Note ${liveNo} from there`}>
                                sub-account
                              </span>
                            )}
                          </label>
                        )
                      })}
                      {shown.length === 0 && (
                        <p className="px-1 py-2 text-sm text-mist">
                          {available.length === 0 ? 'No other accounts available.' : `No accounts match “${coverQ}”.`}
                        </p>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-mist">
                      {count} Chart of Accounts record{count === 1 ? '' : 's'} on this note — the Note No. column on the chart is what puts an account here, and every account on the note is a <span className="font-semibold text-inherit">sub-account of the note account</span> in the Chart of Accounts. Sub-accounts of a note account join the note automatically.
                      {ownedElsewhere > 0 && ' Accounts marked “on Note …” belong to another note; release them there first.'}
                    </p>
                  </>
                )
              })()}
            </Field>

            <Field label="Note description" required>
              <Textarea
                rows={3}
                maxLength={NOTE_DESCRIPTION_MAX}
                value={editing.noteDescription}
                onChange={(e) => setEditing({ ...editing, noteDescription: e.target.value })}
                placeholder="Describe the purpose or business function of this note"
                className="min-h-[42px] max-w-full resize placeholder:italic placeholder:text-rose-400"
              />
              <p className="mt-1 text-right text-xs text-mist">
                {editing.noteDescription.length}/{NOTE_DESCRIPTION_MAX}
              </p>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Note statement" required>
                <Select
                  value={editing.noteStatement}
                  onChange={(e) => setEditing({ ...editing, noteStatement: e.target.value as NoteStatement | '' })}
                >
                  <option value="">Auto — from the account type</option>
                  {STATEMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Note status" required>
                <Select value={editing.noteStatus} onChange={(e) => setEditing({ ...editing, noteStatus: e.target.value as NoteStatus })}>
                  {NOTE_STATUSES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </Select>
              </Field>
            </div>

            <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-xs text-mist">
              Note accounts: <span className="font-semibold text-inherit">{(liveNoteNoOf(editing) ? coverOf(liveNoteNoOf(editing)) : new Set([...editing.accountIds, editing.accountId].filter(Boolean)).size)}</span>
              {' '}Chart of Accounts record(s) assigned to this note number, its sub-accounts included — calculated automatically.
              {editing.noteStatus === 'Inactive' && ' This note is inactive: existing links are kept for historical reporting, but new assignments are blocked.'}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button className="h-11 flex-1 bg-blue-600 text-base font-semibold text-white hover:bg-blue-700" onClick={save}>Save</Button>
              {editing.id && canDelete && (
                <Button
                  variant="outline"
                  className="h-11 sm:flex-none"
                  onClick={reverse}
                  title="Remove this note number from the account — the account itself is kept"
                >
                  <RotateCcw className="size-4" /> Remove note No. from account
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!unmatching} onClose={() => setUnmatching(null)} title="Unmatch sub-account?">
        {unmatching && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Unmatch <span className="font-semibold text-inherit">{unmatching.account.name}</span> from Note{' '}
              <span className="font-semibold text-inherit">{unmatching.note.noteNo}</span>? Its sub-accounts that inherit this note will leave with it; accounts below it carrying their own Note No. stay assigned.
            </p>
            <p className="text-sm text-mist">The account is kept. Its previous parent is restored where available; if that parent still belongs to this note, it moves to the nearest parent outside the note (or to the top level).</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUnmatching(null)}>Cancel</Button>
              <Button variant="danger" onClick={doUnmatchSubAccount}>Unmatch</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={clearAllOpen} onClose={() => setClearAllOpen(false)} title="Clear all Accounts Note data?">
        <div className="space-y-3">
          <p className="text-sm text-mist">This removes every note so you can add your own:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-mist">
            <li>{notes.length} note{notes.length === 1 ? '' : 's'} — all descriptions, statements and statuses</li>
            <li>the Note No. on {accounts.filter((a) => ownership.has(a.id)).length} Chart of Accounts row(s) — the rows carrying a number and the sub-accounts that follow them</li>
            <li>any note accounts earlier releases created for you</li>
          </ul>
          <p className="text-sm text-mist">Your Chart of Accounts itself is kept — no real account is deleted, and account balances, codes and parents stay as they are.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClearAllOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={clearEverything}>Clear all</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete note?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete note <span className="font-semibold text-inherit">{deleting.noteNo} {deleting.name}</span>? Its Note No. is cleared from
              {' '}<span className="font-semibold text-inherit">{coverOf(deleting.noteNo)}</span> chart account(s), its sub-accounts included —
              the accounts are kept, they simply stop referring to the note. The wording entered here cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
