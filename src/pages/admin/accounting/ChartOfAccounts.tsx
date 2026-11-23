import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Search, RotateCcw, ChevronRight, ChevronsUpDown, CheckCircle2, XCircle, Tags } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, MultiSelect, Textarea, DatePicker, Switch } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_DEFS, accountTypeName, loadAccountNotes, saveAccountNotes } from '../../../lib/accounting'
import {
  isNoteActive,
  noteAccountCountOf,
  noteByNo,
  noteDescriptionOf,
  planNoteChartSync,
  normalizeNote,
  noteStatementOf,
  noteStatusOf,
  isReservedAccountNoteNo,
  notesFromChart,
  listedInChart,
  noteOwnership,
  coveredAccounts,
  NOTE_STATEMENTS,
} from '../../../lib/noteMeta'
import { indentFor, orderByParent } from '../../../lib/hierarchy'
import type { Account, AccountType } from '../../../types'
import { accountLabel } from './common'
import { useFundAccounting } from '../../../components/FundField'
import { calculatePrimaryBalances, codeGroupFor, nextCodeForGroup, validateAccount } from '../../../lib/chartOfAccounts'

/** accounting_account_type id 16 = Bank — the rows Banking → Bank Accounts lists. */
const BANK_TYPE_ID = 16

type Form = {
  id?: string; code: string; name: string; type: AccountType; accountTypeId: string; parentCode: string; parentId: string; detailType: string
  primaryBalance: string; bankBalance: string; description: string; status: 'active' | 'inactive'
  noteNo: string; fundId: string; balanceAsOf: string
  /** Ownership level — who can see this account. */
  /* -- Bank columns (Account Type 16 = Bank). Same row as Banking → Bank Accounts. -- */
  bank: string; accountNumber: string; bankBranch: string
  bankAccountType: 'current' | 'savings' | 'momo'
  routing: string; contactNo: string; email: string; country: string
}

const blank = (): Form => ({ code: '', name: '', type: 'asset', accountTypeId: '2', parentCode: '', parentId: '', detailType: '', primaryBalance: '0', bankBalance: '', description: '', status: 'active', noteNo: '', fundId: '', balanceAsOf: new Date().toISOString().slice(0, 10), bank: '', accountNumber: '', bankBranch: '', bankAccountType: 'current', routing: '', contactNo: '', email: '', country: '' })

function typeLabel(t: AccountType): string {
  if (t === 'asset') return 'Assets'
  if (t === 'liability') return 'Liabilities'
  if (t === 'equity') return 'Equity'
  if (t === 'income') return 'Income'
  return 'Expenses'
}

export function ChartOfAccounts() {
  const app = useApp()
  const { accounts, accountHistory, funds, detailTypes: detailTypeDefs, upsertAccount, patchAccounts, deleteAccount, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()


  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  /** Company-level Fund Accounting switch (Settings → General → App Enables). */
  const fundOn = useFundAccounting()
  const canDelete = hasRole('super_admin', 'gym_manager')

  // Filters (draft)
  const [accountQ, setAccountQ] = useState('')
  // Parent account, Type and Detail type each accept SEVERAL values at once.
  const [parentFilter, setParentFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [detailFilter, setDetailFilter] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState('')
  // Note filters — the source table carries note_no, so note number, note
  // statement and note status are all filterable from here.
  const [noteFilter, setNoteFilter] = useState('')
  const [noteStatementFilter, setNoteStatementFilter] = useState('')
  const [noteStatusFilter, setNoteStatusFilter] = useState('')
  // Applied
  const [applied, setApplied] = useState<{ accountQ: string; parent: string[]; type: string[]; detail: string[]; active: string; note: string; noteStatement: string; noteStatus: string }>({ accountQ: '', parent: [], type: [], detail: [], active: '', note: '', noteStatement: '', noteStatus: '' })

  const [editing, setEditing] = useState<Form | null>(null)

  // Accounts that take part in an Accounts Note hierarchy — the note's own
  // account (a top-level parent) plus every account it covers (its children).
  // These must always be offerable as a Parent account here, regardless of the
  // same-type / bank filters, so the chart can mirror the note hierarchy.
  /**
   * The Accounts Note register **as it comes from this chart**: one note per
   * Note No. in use here, carrying the saved wording for that number.
   */
  const notes = useMemo(() => notesFromChart(accounts, loadAccountNotes()).notes, [accounts, editing])
  const noteHierarchyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of notes) {
      if (n.accountId) ids.add(n.accountId)
      for (const id of n.accountIds || []) ids.add(id)
    }
    return ids
  }, [notes])

  /**
   * Where each row's note number comes from — its own Note No., or the note
   * account it sits under. A sub-account of a note account is on the note too.
   */
  const ownership = useMemo(() => noteOwnership(accounts), [accounts])

  /**
   * The note metadata behind an account's note number — its own or inherited —
   * read live from the register with the stamped source columns as fallback.
   */
  const noteMetaOf = (a: Account) => {
    const owned = ownership.get(a.id)
    if (!owned) return undefined
    const note = noteByNo(notes, owned.noteNo)
    return {
      noteNo: owned.noteNo,
      /** true = the number sits on the account above, not on this row. */
      inherited: owned.inherited,
      viaName: owned.inherited ? accounts.find((x) => x.id === owned.ownerId)?.name || '' : '',
      description: note ? noteDescriptionOf(note) : a.noteDescription || '',
      statement: note ? noteStatementOf(note, accounts.find((x) => x.id === note.accountId)) : a.noteStatement,
      status: note ? noteStatusOf(note) : a.noteStatus,
      accounts: note ? noteAccountCountOf(note, accounts) : a.noteAccounts ?? coveredAccounts(owned.noteNo, accounts).length,
      /** true on the row the note is named by — where the count belongs. */
      onNoteAccount: note ? a.id === note.accountId : !owned.inherited,
    }
  }

  /**
   * Stamp the note columns onto the Chart of Accounts source rows so the table
   * itself carries note_description / note_statement / note_accounts /
   * note_status for reporting. Idempotent — writes only rows that differ.
   */
  useEffect(() => {
    // The chart is the source of the notes: derive the register from the Note
    // No. numbers in use here, persist the wording it carries, and write the
    // four note columns back onto the rows. patchAccounts touches only those
    // columns — no code generation, no scope or ownership changes.
    const derived = notesFromChart(accounts, loadAccountNotes())
    if (derived.changed) saveAccountNotes(derived.notes)
    const sync = planNoteChartSync(accounts, derived.notes)
    if (sync.length) patchAccounts(sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, editing])
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /** Bulk note assignment (Bulk Actions → Assign note…). */
  const [bulkNote, setBulkNote] = useState<string | null>(null)

  // List controls (page size, pagination, sorting, bulk actions)
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [showBulk, setShowBulk] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'detail'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const detailTypes = useMemo(() => Array.from(new Set(accounts.map((a) => a.detailType).filter(Boolean) as string[])).sort(), [accounts])

  /** Opening balances plus posted ledger movement, rolled through every descendant. */
  const primaryBalanceByAccount = useMemo(
    () => calculatePrimaryBalances(accounts, accountHistory),
    [accounts, accountHistory],
  )
  const primaryBalanceOf = (account: Account) => primaryBalanceByAccount.get(account.id) ?? (account.primaryBalance ?? 0)

  const parentName = (code?: string) => (code ? accounts.find((a) => a.code === code)?.name || code : '')
  const parentOf = (a: Account) => (a.parentId ? accounts.find((x) => x.id === a.parentId)?.name || '' : a.parentCode ? parentName(a.parentCode) : '')
  /** The parent's CURRENT code — resolved via parentId, falling back to parentCode. */
  const parentCodeOf = (a: Account) => {
    if (a.parentId) {
      const byId = accounts.find((x) => x.id === a.parentId)
      if (byId) return byId.code || ''
    }
    return a.parentCode && accounts.some((x) => x.code === a.parentCode) ? a.parentCode : ''
  }

  /**
   * The list reads as the chart itself: every sub-account sits directly under
   * its parent, indented one level per generation. Sorting orders SIBLINGS —
   * it never tears a child away from the account it belongs to. A sub-account
   * whose parent is filtered out stands on its own rather than disappearing.
   */
  const { rows, depthOf } = useMemo(() => {
    const matched = accounts.filter((a) => {
      const owned = ownership.get(a.id)
      // Bank accounts live in ONE table with the rest of the chart and are
      // listed in Banking → Bank Accounts. They appear here too when they are
      // part of a note hierarchy — the note account's sub-accounts — so the
      // chart shows what the note explains.
      if (!listedInChart(a, owned?.noteNo)) return false
      // Search spans the account fields and its note number/description.
      const noteMeta = noteMetaOf(a)
      const haystack = `${a.code} ${a.name} ${owned?.noteNo || ''} ${noteMeta?.description || ''}`
      if (applied.accountQ && !haystack.toLowerCase().includes(applied.accountQ.toLowerCase())) return false
      if (applied.parent.length && !applied.parent.includes(a.parentCode || '')) return false
      if (applied.type.length && !applied.type.includes(a.type)) return false
      if (applied.detail.length && !applied.detail.includes(a.detailType || '')) return false
      if (applied.active) {
        const isActive = a.status !== 'inactive'
        if (applied.active === 'yes' && !isActive) return false
        if (applied.active === 'no' && isActive) return false
      }
      // Note number filter: '' = all, '__none' = rows on no note. A row counts
      // as being on the note when it carries the number or inherits it.
      if (applied.note) {
        if (applied.note === '__none') { if (owned) return false }
        else if (owned?.noteNo !== applied.note) return false
      }
      if (applied.noteStatement && noteMeta?.statement !== applied.noteStatement) return false
      if (applied.noteStatus && noteMeta?.status !== applied.noteStatus) return false
      return true
    })

    const key = (x: Account) =>
      sortBy === 'type'
        ? (accountTypeName(x.accountTypeId) || typeLabel(x.type))
        : sortBy === 'detail'
          ? (x.detailType || '')
          : x.name
    const cmp = (a: Account, b: Account) => {
      const c = key(a).localeCompare(key(b))
      return sortDir === 'asc' ? c : -c
    }

    // parentId is the authoritative link; parentCode is the legacy fallback.
    const byCode = new Map(matched.map((a) => [a.code, a]))
    const parentIdOf = (a: Account): string | null => {
      if (a.parentId) return a.parentId
      const viaCode = a.parentCode ? byCode.get(a.parentCode) : undefined
      return viaCode ? viaCode.id : null
    }
    return orderByParent(matched, { parentIdOf, compare: cmp })
  }, [accounts, applied, sortBy, sortDir])

  // Pagination + selection helpers for the accounts list
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)
  const allSelected = paged.length > 0 && paged.every((a) => selected.has(a.id))
  const toggleOne = (id: string) => {
    setShowBulk(false) // selecting rows only ENABLES Bulk Actions — the menu opens on click
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const headerSort = (col: 'name' | 'type' | 'detail') => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }
  const setStatusBulk = (status: 'active' | 'inactive') => {
    accounts.filter((a) => selected.has(a.id)).forEach((a) => upsertAccount({ ...a, status }))
    toast.success(`${selected.size} account(s) ${status === 'active' ? 'activated' : 'deactivated'}`)
    setSelected(new Set()); setShowBulk(false)
  }
  const deleteBulk = () => {
    accounts.filter((a) => selected.has(a.id)).forEach((a) => deleteAccount(a.id))
    toast.success(`${selected.size} account(s) deleted`)
    setSelected(new Set()); setShowBulk(false)
  }
  /**
   * Assign the selected accounts to a note number — the Chart of Accounts is
   * where a note comes from, so this is how a note gains its accounts. An
   * inactive note is never given new accounts; a number that does not exist yet
   * simply becomes a new note.
   */
  const applyBulkNote = (noteNo: string | null) => {
    const picked = Array.from(selected).filter((id) => !/^__none__/.test(id))
    const target = (noteNo || '').trim()
    if (isReservedAccountNoteNo(target)) {
      toast.error('Note No. 1 is reserved', 'Accounting Policies uses Note 1. Accounts Note numbers start at 2.')
      return
    }
    const existing = target ? noteByNo(notes, target) : undefined
    // A sub-account answers to whatever its note account carries, so assigning
    // the same number again changes nothing; clearing takes the number off the
    // rows that carry one of their own — the account above releases its subs.
    const ids = target
      ? picked.filter((id) => ownership.get(id)?.noteNo !== target)
      : picked.filter((id) => !!accounts.find((a) => a.id === id)?.noteNo)
    const skipped = picked.length - ids.length
    const skippedNote = skipped
      ? target
        ? `${skipped} already answered to Note ${target} — a sub-account follows its note account.`
        : `${skipped} are sub-accounts: they follow their note account, so the number comes off the account above them.`
      : ''
    // A parked note takes assignments: that is what revives it (see noteMeta).
    if (target && existing && !isNoteActive(existing) && !existing.parked && ids.length) {
      toast.error('That note is inactive', `Note ${target} cannot take new account assignments. Reactivate it on the Accounts Note page first.`)
      return
    }
    if (!ids.length) {
      toast.info('Nothing to change', skippedNote || 'Those rows already answer to their note.')
      setSelected(new Set()); setShowBulk(false); setBulkNote(null)
      return
    }
    const updates = ids.map((id) => ({ id, patch: { noteNo: target || undefined } }))
    patchAccounts(updates)
    toast.success(
      target ? `${updates.length} account(s) assigned to Note ${target}` : `${updates.length} account(s) removed from their note`,
      [
        target
          ? 'The note now covers these Chart of Accounts rows, together with any sub-accounts beneath them.'
          : 'The accounts keep their own details — only the note reference is cleared.',
        skippedNote,
      ].filter(Boolean).join(' '),
    )
    setSelected(new Set()); setShowBulk(false); setBulkNote(null)
  }

  const openNew = () => setEditing(blank())
  const openEdit = (a: Account) => setEditing({
    // parentId is the authoritative link: a code renumbering can leave
    // parentCode pointing at a code nobody owns any more, which used to show
    // the parent as blank even though the list displayed it correctly.
    id: a.id, code: a.code, name: a.name, type: a.type, accountTypeId: a.accountTypeId ? String(a.accountTypeId) : '', parentCode: parentCodeOf(a),
    // parentId is the authoritative parent link (works even when the parent's code is blank).
    parentId: a.parentId || (a.parentCode ? accounts.find((x) => x.code === a.parentCode)?.id || '' : ''), detailType: a.detailType || '',
    primaryBalance: String(a.primaryBalance ?? 0), bankBalance: a.bankBalance != null ? String(a.bankBalance) : '',
    description: a.description || '', status: a.status || 'active',
    noteNo: a.noteNo || '', fundId: a.fundId || '', balanceAsOf: a.balanceAsOf || '',
    bank: a.bank || '', accountNumber: a.accountNumber || '', bankBranch: a.bankBranch || '',
    bankAccountType: a.bankAccountType || 'current',
    routing: a.routing || '', contactNo: a.contactNo || '', email: a.email || '', country: a.country || '',
  })

  /**
   * Next free code when Account Code is left blank. Draws from the band that
   * matches the account's own type (Assets 1000–1999, Liabilities 2000–2999, …),
   * in tens, skipping anything already in use.
   */
  const autoCode = (type: AccountType, accountTypeId?: number) =>
    nextCodeForGroup(accounts, codeGroupFor({ type, accountTypeId }))

  const doSearch = () => setApplied({ accountQ: accountQ.trim(), parent: parentFilter, type: typeFilter, detail: detailFilter, active: activeFilter, note: noteFilter, noteStatement: noteStatementFilter, noteStatus: noteStatusFilter })
  // Options for the multi-select filters.
  const parentFilterOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    for (const a of accounts) {
      if (!a.code || seen.has(a.code)) continue
      seen.add(a.code)
      opts.push({ value: a.code, label: accountLabel(a) })
    }
    return opts.sort((x, y) => x.label.localeCompare(y.label))
  }, [accounts])
  const typeFilterOptions = useMemo(() => ACCOUNT_TYPES.map((t) => ({ value: t.id, label: typeLabel(t.id) })), [])
  const detailFilterOptions = useMemo(() => detailTypes.map((d) => ({ value: d, label: d })), [detailTypes])
  /** Note numbers present in the source table, labelled with the note name. */
  const noteFilterOptions = useMemo(() => {
    const numbers = Array.from(new Set(accounts.map((a) => a.noteNo).filter(Boolean) as string[]))
      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    return numbers.map((no) => {
      const note = noteByNo(notes, no)
      const name = note ? accounts.find((a) => a.id === note.accountId)?.name || note.name : ''
      const status = note ? noteStatusOf(note) : undefined
      return { value: no, label: `Note ${no}${name ? ` — ${name}` : ''}${status === 'Inactive' ? ' (inactive)' : ''}` }
    })
  }, [accounts, notes])
  const doReset = () => {
    setAccountQ(''); setParentFilter([]); setTypeFilter([]); setDetailFilter([]); setActiveFilter('')
    setNoteFilter(''); setNoteStatementFilter(''); setNoteStatusFilter('')
    setApplied({ accountQ: '', parent: [], type: [], detail: [], active: '', note: '', noteStatement: '', noteStatus: '' })
  }

  const save = () => {
    if (!editing) return
    if (isReservedAccountNoteNo(editing.noteNo)) {
      toast.error('Note No. 1 is reserved', 'Accounting Policies uses Note 1. Accounts Note numbers start at 2.')
      return
    }
    // Business rule: an Inactive note is closed to new account assignments.
    const chosenNote = editing.noteNo ? noteByNo(notes, editing.noteNo) : undefined
    const storedNoteNo = editing.id ? accounts.find((a) => a.id === editing.id)?.noteNo : undefined
    // Parked notes may take an assignment — it brings them back Active.
    if (chosenNote && !isNoteActive(chosenNote) && !chosenNote.parked && storedNoteNo !== editing.noteNo) {
      toast.error('That note is inactive', `Note ${chosenNote.noteNo} cannot take new account assignments. Reactivate it on the Accounts Note page first.`)
      return
    }
    if (!editing.detailType.trim()) { toast.error('Select a detail type.'); return }
    if (!editing.name.trim()) { toast.error('Enter the account name.'); return }
    if (fundOn && !editing.fundId) { toast.error('Select a fund.'); return }
    if (editing.primaryBalance.trim() === '' || Number.isNaN(Number(editing.primaryBalance))) { toast.error('Enter the balance.'); return }
    if (!editing.code.trim()) {
      editing.code = autoCode(editing.type, editing.accountTypeId ? Number(editing.accountTypeId) : undefined)
    }
    const isNew = !editing.id
    const existing = editing.id ? accounts.find((a) => a.id === editing.id) : undefined
    const isBank = Number(editing.accountTypeId) === BANK_TYPE_ID
    const draft: Account = {
      // Start from the stored row: the chart of accounts and Banking → Bank
      // Accounts are ONE table, so an edit here must not silently drop columns
      // the bank list owns (bank, account number, branch, …).
      ...(existing || {}),
      id: editing.id || uid('ac'),
      code: editing.code.trim(),
      name: editing.name.trim(),
      type: editing.type,
      // Every account in this chart is Global — shared by every company and
      // branch — so no ownership fields are carried and nothing needs review.
      scopeType: 'GLOBAL',
      companyId: undefined,
      branchId: undefined,
      scopeNeedsReview: undefined,
      // parentId is the authoritative link (selected by id, so parents with a
      // blank code still work). parentCode is derived from it for legacy display.
      parentId: editing.parentId || undefined,
      parentCode: editing.parentId
        ? accounts.find((x) => x.id === editing.parentId)?.code || undefined
        : undefined,
      detailType: editing.detailType.trim() || undefined,
      primaryBalance: Number(editing.primaryBalance) || 0,
      bankBalance: editing.bankBalance !== '' ? Number(editing.bankBalance) : undefined,
      description: editing.description.trim() || undefined,
      accountTypeId: editing.accountTypeId ? Number(editing.accountTypeId) : undefined,
      noteNo: editing.noteNo.trim() || undefined,
      fundId: editing.fundId || undefined,
      balanceAsOf: editing.balanceAsOf || undefined,
      status: editing.status,
      // Bank columns only exist on Bank accounts; changing the type away from
      // Bank clears them so the row leaves the bank list cleanly.
      bank: isBank ? (editing.bank.trim() || undefined) : undefined,
      accountNumber: isBank ? (editing.accountNumber.trim() || undefined) : undefined,
      bankBranch: isBank ? (editing.bankBranch.trim() || undefined) : undefined,
      bankAccountType: isBank ? editing.bankAccountType : undefined,
      routing: isBank ? (editing.routing.trim() || undefined) : undefined,
      contactNo: isBank ? (editing.contactNo.trim() || undefined) : undefined,
      email: isBank ? (editing.email.trim() || undefined) : undefined,
      country: isBank ? (editing.country.trim() || undefined) : undefined,
    }
    const { ok, errors } = validateAccount(draft, accounts, {
      companyExists: (id) => app.companies.some((c) => c.id === id),
      branchExists: (id) => app.branches.some((b) => b.id === id),
    })
    if (!ok) { toast.error(errors[0]); return }
    upsertAccount(draft)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Account', `${isNew ? 'Created' : 'Updated'} ${editing.code} ${editing.name}`)
    toast.success(
      isNew ? 'Account created' : 'Account updated',
      isBank ? 'Bank accounts are listed under Banking → Bank Accounts.' : undefined,
    )
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteAccount(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Account', `Deleted ${deleting.code} ${deleting.name}`)
    toast.success('Account deleted')
    setDeleting(null)
  }

  const toggleAll = () => {
    setShowBulk(false)
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) paged.forEach((a) => n.delete(a.id))
      else paged.forEach((a) => n.add(a.id))
      return n
    })
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span><ChevronRight className="size-3.5" /><span className="font-semibold text-inherit">Chart of Accounts</span>
      </div>
      <PageHeader
        title="Chart of Accounts List"
        desc="The general ledger structure — assets, liabilities, equity, income, and expenses."
        actions={canManage ? <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button> : undefined}
      />

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-mist">Account</label>
            <Input value={accountQ} onChange={(e) => setAccountQ(e.target.value)} placeholder="Search by account name or code" onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Parent account</label>
            <MultiSelect aria-label="Parent account" options={parentFilterOptions} values={parentFilter} onChange={setParentFilter} />
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Type</label>
            <MultiSelect aria-label="Type" options={typeFilterOptions} values={typeFilter} onChange={setTypeFilter} searchable={false} />
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Detail type</label>
            <MultiSelect aria-label="Detail type" options={detailFilterOptions} values={detailFilter} onChange={setDetailFilter} />
          </div>
          <div className="flex items-end gap-2 xl:col-span-1">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-mist">Active</label>
              <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </div>
          </div>
          {/* Note filters — note_no, note_statement and note_status on the source table */}
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-mist">Note No.</label>
            <Select value={noteFilter} onChange={(e) => setNoteFilter(e.target.value)} aria-label="Note number">
              <option value="">All notes</option>
              {noteFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value="__none">No note assigned</option>
            </Select>
          </div>
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-mist">Note statement</label>
            <Select value={noteStatementFilter} onChange={(e) => setNoteStatementFilter(e.target.value)} aria-label="Note statement">
              <option value="">All</option>
              {NOTE_STATEMENTS.map((st) => <option key={st} value={st}>{st}</option>)}
            </Select>
          </div>
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-mist">Note status</label>
            <Select value={noteStatusFilter} onChange={(e) => setNoteStatusFilter(e.target.value)} aria-label="Note status">
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={doSearch}><Search className="size-4" /> Search</Button>
          <Button variant="outline" onClick={doReset}><RotateCcw className="size-4" /> Reset</Button>
        </div>
      </div>

      {/* Toolbar: page size · Export · Bulk Actions · refresh */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-20">
          <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} aria-label="Rows per page">
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <ExportButtons filename="chart-of-accounts" rows={rows.map((a) => { const meta = noteMetaOf(a); return ({ Name: a.name, 'Parent account': parentName(a.parentCode), Type: typeLabel(a.type), 'Detail type': a.detailType || '', 'Primary Balance': primaryBalanceOf(a), 'Bank Balance': a.bankBalance ?? '', Active: a.status === 'inactive' ? 'No' : 'Yes', 'Note No.': a.noteNo || '', 'Note description': meta?.description || '', 'Note statement': meta?.statement || '', 'Note accounts': meta?.onNoteAccount && meta.accounts ? meta.accounts : '', 'Note status': meta?.status || '' }) })} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
        <div className="relative">
          <Button variant="outline" onClick={() => setShowBulk((v) => !v)} disabled={!selected.size}>
            Bulk Actions{selected.size ? ` (${selected.size})` : ''}
          </Button>
          {showBulk && selected.size > 0 && (
            <div className="menu-pop absolute left-0 top-full z-30 mt-1 w-48 rounded-xl p-1.5">
              {canManage && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('active')}><CheckCircle2 className="size-4" /> Activate</button>}
              {canManage && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('inactive')}><XCircle className="size-4" /> Deactivate</button>}
              {canManage && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => { setBulkNote(ownership.get(Array.from(selected)[0])?.noteNo || ''); setShowBulk(false) }}><Tags className="size-4" /> Assign note…</button>}
              {canDelete && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ember" onClick={deleteBulk}><Trash2 className="size-4" /> Delete</button>}
            </div>
          )}
        </div>
        <button
          type="button"
          title="Refresh list"
          aria-label="Refresh list"
          onClick={() => { doReset(); setSelected(new Set()); setPage(1); toast.success('List refreshed') }}
          className="grid size-10 place-items-center rounded-xl border border-line text-mist transition hover:text-lime"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-black/10 text-xs font-bold uppercase tracking-wide dark:bg-white/10">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && selected.size > 0 }} onChange={toggleAll} aria-label="Select all" className="size-4" />
              </th>
              <th className="cursor-pointer px-3 py-2.5" onClick={() => headerSort('name')}>Name</th>
              <th className="px-3 py-2.5">Parent account</th>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('type')}>
                <span className="inline-flex items-center gap-1">Type <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('detail')}>
                <span className="inline-flex items-center gap-1">Detail type <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
              <th className="px-3 py-2.5 text-right">Primary Balance</th>
              <th className="px-3 py-2.5 text-right">Bank Balance</th>
              {/* Note columns. Note No., the automatic count and the status are
                  shown here; the note's description and statement are the
                  wording the Accounts Note page owns, so the chart list does not
                  repeat them as columns (both stay searchable and exportable). */}
              <th className="px-3 py-2.5 font-mono">Note No.</th>
              <th className="px-3 py-2.5 text-center">Note accounts</th>
              <th className="px-3 py-2.5 text-center">Note status</th>
              <th className="px-3 py-2.5 text-center">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paged.map((a) => (
              <tr key={a.id} className={selected.has(a.id) ? 'bg-lime/5' : undefined}>
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} aria-label={`Select ${a.name}`} className="size-4 accent-blue-600" />
                </td>
                <td
                  className="group px-3 py-2.5 font-semibold"
                  style={{ paddingLeft: indentFor(depthOf.get(a.id)) }}
                >
                  <div className="text-sm font-semibold leading-snug">
                  {a.name}
                  <span className={`ml-2 rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide ${
                    (a.scopeType || 'GLOBAL') === 'GLOBAL' ? 'bg-slate-100 text-slate-600'
                      : a.scopeType === 'COMPANY' ? 'bg-sky-50 text-sky-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>{a.scopeType || 'Global'}</span>
                  {Number(a.accountTypeId) === BANK_TYPE_ID && (
                    <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" title="Also listed under Banking → Bank Accounts">
                      Bank
                    </span>
                  )}
                  </div>
                  <div className="mt-0.5 hidden items-center gap-2 text-[13px] group-hover:flex">
                    {canManage && (
                      <button
                        type="button"
                        className="font-medium text-mist transition hover:text-lime"
                        onClick={() => openEdit(a)}
                      >
                        Edit
                      </button>
                    )}
                    {canManage && canDelete && <span className="text-mist/40">|</span>}
                    {canDelete && (
                      <button
                        type="button"
                        className="font-semibold text-red-600 transition hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                        onClick={() => setDeleting(a)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-mist">{parentOf(a)}</td>
                <td className="px-3 py-2.5">{accountTypeName(a.accountTypeId) || typeLabel(a.type)}</td>
                <td className="px-3 py-2.5">{a.detailType || '—'}</td>
                <td className="px-3 py-2.5 text-right" title="Balances include opening balance and posted movements; parent accounts also include all sub-account balances.">{formatGhsExact(primaryBalanceOf(a))}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{a.bankBalance != null ? formatGhsExact(a.bankBalance) : ''}</td>
                {(() => {
                  const meta = noteMetaOf(a)
                  return (
                    <>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {meta
                          ? meta.inherited
                            ? (
                              <span
                                className="text-mist"
                                title={`Inherited from ${meta.viaName || 'the note account'} — this account is a sub-account of the note account, so it belongs to Note ${meta.noteNo}. Give it a Note No. of its own to move it.`}
                              >
                                <span aria-hidden="true">{'↳ '}</span>{meta.noteNo}
                              </span>
                            )
                            : meta.noteNo
                          : '—'}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center text-xs text-mist"
                        title={meta?.onNoteAccount
                          ? 'Chart of Accounts records on this note — the rows carrying the number and the sub-accounts beneath them (auto). It is shown on the note account only.'
                          : undefined}
                      >
                        {meta?.onNoteAccount && meta.accounts ? meta.accounts : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {meta?.status ? (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            meta.status === 'Active' ? 'bg-lime/15 text-lime' : 'bg-slate-200 text-slate-600'
                          }`}>{meta.status}</span>
                        ) : '—'}
                      </td>
                    </>
                  )
                })()}
                <td className="px-3 py-2.5">
                  <div className="flex justify-center">
                    <Switch
                      checked={a.status !== 'inactive'}
                      disabled={!canManage}
                      onChange={(next) => { upsertAccount({ ...a, status: next ? 'active' : 'inactive' }); toast.success(next ? 'Account activated' : 'Account deactivated', a.name) }}
                      aria-label={`Toggle ${a.name} active`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!paged.length && <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-mist">No accounts. Create your first account with the Add button.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Footer: entries summary + pagination */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
        <span>
          {rows.length
            ? `Showing ${(curPage - 1) * pageSize + 1} to ${Math.min(curPage * pageSize, rows.length)} of ${rows.length} entries`
            : 'Showing 0 entries'}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} aria-label="Previous page" className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40">
            <ChevronRight className="size-4 rotate-180" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, curPage - 3), curPage + 2).map((n) => (
            <button key={n} type="button" onClick={() => setPage(n)} className={`grid size-9 place-items-center rounded-lg border text-sm font-semibold ${n === curPage ? '' : 'border-line'}`} style={n === curPage ? { backgroundColor: 'var(--brand, #c8f542)', borderColor: 'var(--brand, #c8f542)', color: 'var(--brand-ink, #132000)' } : undefined}>
              {n}
            </button>
          ))}
          <button type="button" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} aria-label="Next page" className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id
          ? Number(editing.accountTypeId) === BANK_TYPE_ID ? 'Edit bank account' : 'Edit Chart of Accounts'
          : 'Add Chart of Accounts'}
        wide
      >
        {editing && (() => {
          // Detail types from the register (Accounting settings → Account
          // Detail Types), filtered to the selected account type (1–16).
          const selTypeName = accountTypeName(editing.accountTypeId ? Number(editing.accountTypeId) : undefined)
          const fromRegister = detailTypeDefs.filter((d) => !selTypeName || d.accountType === selTypeName).map((d) => d.name)
          const detailOptions = Array.from(new Set([...fromRegister, ...(editing.detailType ? [editing.detailType] : [])])).sort((a, b) => a.localeCompare(b))
          return (
            <div className="space-y-3">
              {/* Account type | Status */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="Account type" required>
                    <Select
                      value={editing.accountTypeId}
                      onChange={(e) => {
                        const def = ACCOUNT_TYPE_DEFS.find((t) => String(t.id) === e.target.value)
                        setEditing({ ...editing, accountTypeId: e.target.value, type: def?.class || editing.type, detailType: '' })
                      }}
                      placeholder="Please Select…"
                    >
                      <option value="" disabled>Please Select…</option>
                      {['ASSETS', 'LIABILITIES', 'EQUITY', 'INCOME', 'EXPENSES'].map((cls) => (
                        <optgroup key={cls} label={cls}>
                          {ACCOUNT_TYPE_DEFS.filter((t) => t.classLabel === cls).map((t) => (
                            <option key={t.id} value={String(t.id)}>{t.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Status">
                  <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                    <option value="active">ACTIVE</option>
                    <option value="inactive">INACTIVE</option>
                  </Select>
                </Field>
              </div>

              {/* Detail type */}
              <Field label="Detail type" required>
                <Select value={editing.detailType} onChange={(e) => setEditing({ ...editing, detailType: e.target.value })} placeholder="Please Select…">
                  <option value="" disabled>Please Select…</option>
                  {detailOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>

              {/* Account Name | Account Code */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="Account Name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                </div>
                <Field label="Account Code"><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="font-mono" placeholder="Auto if blank" /></Field>
              </div>

              {/* Parent account | Note No. */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="Parent account" required>
                    <Select value={editing.parentId} onChange={(e) => setEditing({ ...editing, parentId: e.target.value })} placeholder="Please Select…">
                      <option value="">None (top-level)</option>
                      {accounts
                        .filter((a) => a.id !== editing.id && (
                          // Any account that belongs to an Accounts Note
                          // hierarchy (the note account or one it covers) is
                          // always a valid parent, whatever its type.
                          noteHierarchyIds.has(a.id)
                          // The account's current parent stays selectable so an
                          // existing link is never silently dropped on edit.
                          || a.id === editing.parentId
                          // Otherwise: ordinary same-type, non-bank accounts.
                          || (Number(a.accountTypeId) !== BANK_TYPE_ID && a.type === editing.type)
                        ))
                        .map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Note No." hint="Note 1 is reserved for Accounting Policies; Accounts Notes start at 2.">
                  {/* The Chart of Accounts is where a note comes from: pick a
                      number on file or type a new one and the note appears
                      under Accounts Note. Inactive notes stay visible for the
                      rows that already carry them, but cannot be newly
                      assigned. */}
                  <Input
                    value={editing.noteNo}
                    onChange={(e) => setEditing({ ...editing, noteNo: e.target.value })}
                    placeholder="note no. — new or existing"
                    className="placeholder:italic placeholder:text-rose-400"
                    list="coa-note-numbers"
                  />
                  <datalist id="coa-note-numbers">
                    {notes
                      .filter((n) => !isReservedAccountNoteNo(n.noteNo) && (isNoteActive(n) || n.parked || n.noteNo === editing.noteNo))
                      .sort((a, b) => a.noteNo.localeCompare(b.noteNo, undefined, { numeric: true }))
                      .map((n) => {
                        const name = accounts.find((x) => x.id === n.accountId)?.name || n.name
                        return <option key={n.id} value={n.noteNo}>{`${name}${n.parked && !isNoteActive(n) ? ' (unmapped — assigning brings it back)' : isNoteActive(n) ? '' : ' (inactive)'}`}</option>
                      })}
                  </datalist>
                  {(() => {
                    if (!editing.noteNo) return null
                    const note = noteByNo(notes, editing.noteNo)
                    if (!note) {
                      return (
                        <p className="mt-1 text-xs text-lime">
                          New note number — a note covering this account will be created from the Chart of Accounts.
                        </p>
                      )
                    }
                    return (
                      <p className="mt-1 text-xs text-mist">
                        <span className="font-semibold text-inherit">{noteStatementOf(note, accounts.find((x) => x.id === note.accountId))}</span>
                        {' · '}{noteStatusOf(note)}
                        {' · '}{noteAccountCountOf(note, accounts)} account{noteAccountCountOf(note, accounts) === 1 ? '' : 's'}
                        {noteDescriptionOf(note) ? ` · ${noteDescriptionOf(note)}` : ''}
                      </p>
                    )
                  })()}
                  {(() => {
                    const stored = editing.id ? accounts.find((x) => x.id === editing.id) : undefined
                    const owned = stored ? ownership.get(stored.id) : undefined
                    // A sub-account already follows the note account above it.
                    if (stored && owned?.inherited && !editing.noteNo) {
                      const via = accounts.find((x) => x.id === owned.ownerId)
                      return (
                        <p className="mt-1 text-xs text-mist">
                          Sits under {(via?.name) || 'its note account'}, which carries Note {owned.noteNo} — this account is already part of that note. A Note No. typed here would make this row a note account of its own.
                        </p>
                      )
                    }
                    // Leaving the number blank releases the sub-accounts below.
                    const inheritors = stored?.noteNo ? accounts.filter((x) => ownership.get(x.id)?.ownerId === stored.id).length : 0
                    if (!editing.noteNo && inheritors) {
                      return (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          {inheritors} sub-account{inheritors === 1 ? '' : 's'} below this account are on Note {stored!.noteNo} through it; leaving this blank releases them from the note.
                        </p>
                      )
                    }
                    return null
                  })()}
                </Field>
              </div>

              {/* Fund | Description */}
              <div className="grid gap-3 sm:grid-cols-3">
                {fundOn && (
                  <Field label="Fund" required>
                    <Select value={editing.fundId} onChange={(e) => setEditing({ ...editing, fundId: e.target.value })} placeholder="Please Select…">
                      <option value="" disabled>Please Select…</option>
                      {funds.filter((f) => f.status === 'active').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </Select>
                  </Field>
                )}
                {/* Description takes the whole row when the Fund field is hidden. */}
                <div className={fundOn ? 'sm:col-span-2' : 'sm:col-span-3'}>
                  <Field label="Description">
                    <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="please provide description" className="min-h-[42px] max-w-full resize placeholder:italic placeholder:text-rose-400" />
                  </Field>
                </div>
              </div>

              {/* Bank details — the same row Banking → Bank Accounts shows. */}
              {Number(editing.accountTypeId) === BANK_TYPE_ID && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Bank details — shared with Banking → Bank Accounts
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Bank"><Input value={editing.bank} onChange={(e) => setEditing({ ...editing, bank: e.target.value })} placeholder="e.g. GCB BANK" /></Field>
                    <Field label="Account Number"><Input value={editing.accountNumber} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} className="font-mono" /></Field>
                    <Field label="Branch"><Input value={editing.bankBranch} onChange={(e) => setEditing({ ...editing, bankBranch: e.target.value })} /></Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Account Type">
                      <Select value={editing.bankAccountType} onChange={(e) => setEditing({ ...editing, bankAccountType: e.target.value as 'current' | 'savings' | 'momo' })}>
                        <option value="current">Current</option>
                        <option value="savings">Savings</option>
                        <option value="momo">Mobile money</option>
                      </Select>
                    </Field>
                    <Field label="Routing / Sort Code"><Input value={editing.routing} onChange={(e) => setEditing({ ...editing, routing: e.target.value })} /></Field>
                    <Field label="Country"><Input value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value })} /></Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Contact No."><Input value={editing.contactNo} onChange={(e) => setEditing({ ...editing, contactNo: e.target.value })} /></Field>
                    <Field label="Email"><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Bank Balance"><Input type="number" value={editing.bankBalance} onChange={(e) => setEditing({ ...editing, bankBalance: e.target.value })} placeholder="same as balance if blank" /></Field>
                  </div>
                </div>
              )}

              {/* Balance | as of */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Opening balance" required><Input type="number" value={editing.primaryBalance} onChange={(e) => setEditing({ ...editing, primaryBalance: e.target.value })} /></Field>
                <Field label="Opening balance as of"><DatePicker value={editing.balanceAsOf} onChange={(v) => setEditing({ ...editing, balanceAsOf: v })} /></Field>
              </div>

              <Button className="h-11 w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-700" onClick={save}>Save</Button>
            </div>
          )
        })()}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete account?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete account <span className="font-semibold text-inherit">{deleting.code} {deleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk note assignment — how a note gains its Chart of Accounts rows */}
      <Modal open={bulkNote !== null} onClose={() => setBulkNote(null)} title={`Assign ${selected.size} account(s) to a note`}>
        {bulkNote !== null && (
          <div className="space-y-3">
            <Field label="Note No.">
              <Input
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Note number — existing or new"
                className="font-mono"
                list="coa-bulk-note-numbers"
              />
              <datalist id="coa-bulk-note-numbers">
                {notes
                  .filter((n) => !isReservedAccountNoteNo(n.noteNo) && (isNoteActive(n) || n.parked))
                  .sort((a, b) => a.noteNo.localeCompare(b.noteNo, undefined, { numeric: true }))
                  .map((n) => {
                    const name = accounts.find((x) => x.id === n.accountId)?.name || n.name
                    return <option key={n.id} value={n.noteNo}>{name}</option>
                  })}
              </datalist>
            </Field>
            {(() => {
              const note = bulkNote.trim() ? noteByNo(notes, bulkNote.trim()) : undefined
              if (bulkNote.trim() && !note) {
                return <p className="text-xs text-lime">New note number — the note will be created from these Chart of Accounts rows.</p>
              }
              if (note) {
                return (
                  <p className="text-xs text-mist">
                    {noteStatementOf(note, accounts.find((x) => x.id === note.accountId))} · {noteStatusOf(note)} · currently {noteAccountCountOf(note, accounts)} account(s)
                    {noteDescriptionOf(note) ? ` · ${noteDescriptionOf(note)}` : ''}
                  </p>
                )
              }
              return <p className="text-xs text-mist">Leave the number blank to remove the selected accounts from their note.</p>
            })()}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkNote(null)}>Cancel</Button>
              <Button variant="outline" onClick={() => applyBulkNote(null)}>Remove from note</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => applyBulkNote(bulkNote)}>Assign</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
