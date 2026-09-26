import { useMemo, useState } from 'react'
import { Plus, Search, RotateCcw, ChevronsUpDown } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Switch } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { loadAccountNotes, saveAccountNotes } from '../../../lib/accounting'
import { indentFor, orderByParent } from '../../../lib/hierarchy'
import type { AccountNote } from '../../../types'

/** accounting_account_type id 16 = Bank — those accounts live in Banking. */
const BANK_TYPE_ID = 16

const STATEMENTS: { value: AccountNote['statement']; label: string }[] = [
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'income_statement', label: 'Income Statement' },
]
const statementLabel = (v: AccountNote['statement']) =>
  STATEMENTS.find((s) => s.value === v)?.label || v

type Form = {
  id?: string
  noteNo: string
  name: string
  statement: AccountNote['statement']
  parentId: string
  accountIds: string[]
  description: string
  status: 'active' | 'inactive'
}

const blank = (): Form => ({
  noteNo: '', name: '', statement: 'balance_sheet', parentId: '',
  accountIds: [], description: '', status: 'active',
})

/**
 * Accounting → Chart of Accounts → Accounts Note.
 *
 * The numbered disclosures the financial statements refer to. The page mirrors
 * Master Accounts: the same filter bar, the same hover Edit | Delete actions,
 * the same parent-first list, and the same modal form.
 */
export function AccountsNote() {
  const app = useApp()
  const { accounts } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()

  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

  const [notes, setNotes] = useState<AccountNote[]>(() => loadAccountNotes())
  const persist = (next: AccountNote[]) => { setNotes(next); saveAccountNotes(next) }

  const [noteQ, setNoteQ] = useState('')
  const [statementFilter, setStatementFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [applied, setApplied] = useState({ noteQ: '', statement: '', active: '' })
  const [sortBy, setSortBy] = useState<'noteNo' | 'name' | 'statement'>('noteNo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<AccountNote | null>(null)

  /** Accounts a note may explain — bank accounts are managed under Banking. */
  const linkableAccounts = useMemo(
    () => accounts
      .filter((a) => Number(a.accountTypeId) !== BANK_TYPE_ID)
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name)),
    [accounts],
  )
  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.code ? `${a.code} - ` : ''}${a.name}` : id
  }
  const noteName = (id?: string) => (id ? notes.find((n) => n.id === id)?.name || '—' : '—')

  /** Every note sits directly under its parent note, one indent per generation. */
  const { rows, depthOf } = useMemo(() => {
    const matched = notes.filter((n) => {
      if (applied.noteQ && !`${n.noteNo} ${n.name}`.toLowerCase().includes(applied.noteQ.toLowerCase())) return false
      if (applied.statement && n.statement !== applied.statement) return false
      if (applied.active) {
        const isActive = n.status !== 'inactive'
        if (applied.active === 'yes' && !isActive) return false
        if (applied.active === 'no' && isActive) return false
      }
      return true
    })
    const key = (n: AccountNote) =>
      sortBy === 'name' ? n.name : sortBy === 'statement' ? statementLabel(n.statement) : n.noteNo
    const cmp = (a: AccountNote, b: AccountNote) => {
      const c = key(a).localeCompare(key(b), undefined, { numeric: true })
      return sortDir === 'asc' ? c : -c
    }
    return orderByParent(matched, { parentIdOf: (n) => n.parentId, compare: cmp })
  }, [notes, applied, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const headerSort = (col: 'noteNo' | 'name' | 'statement') => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const doSearch = () => setApplied({ noteQ: noteQ.trim(), statement: statementFilter, active: activeFilter })
  const doReset = () => {
    setNoteQ(''); setStatementFilter(''); setActiveFilter('')
    setApplied({ noteQ: '', statement: '', active: '' })
  }

  const openNew = () => setEditing(blank())
  const openEdit = (n: AccountNote) => setEditing({
    id: n.id, noteNo: n.noteNo, name: n.name, statement: n.statement,
    parentId: n.parentId || '', accountIds: n.accountIds || [],
    description: n.description || '', status: n.status || 'active',
  })

  /** Next free note number when the field is left blank. */
  const nextNoteNo = () => {
    const used = notes.map((n) => Number(n.noteNo)).filter((v) => Number.isFinite(v))
    return String((used.length ? Math.max(...used) : 0) + 1)
  }

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter the note name.'); return }
    const noteNo = editing.noteNo.trim() || nextNoteNo()
    const clash = notes.find((n) => n.noteNo === noteNo && n.id !== editing.id)
    if (clash) { toast.error('That note number is already used', clash.name); return }
    const isNew = !editing.id
    const draft: AccountNote = {
      id: editing.id || uid('note'),
      companyId: app.activeCompanyId,
      noteNo,
      name: editing.name.trim(),
      statement: editing.statement,
      parentId: editing.parentId || undefined,
      accountIds: editing.accountIds.length ? editing.accountIds : undefined,
      description: editing.description.trim() || undefined,
      status: editing.status,
    }
    persist(isNew ? [...notes, draft] : notes.map((n) => (n.id === draft.id ? draft : n)))
    app.log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Account note', `${isNew ? 'Created' : 'Updated'} note ${noteNo} ${draft.name}`)
    toast.success(isNew ? 'Note created' : 'Note updated')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    // Children are kept — they simply move up to the top level.
    persist(notes
      .filter((n) => n.id !== deleting.id)
      .map((n) => (n.parentId === deleting.id ? { ...n, parentId: undefined } : n)))
    app.log(user?.id || 'system', 'DELETE', 'Account note', `Deleted note ${deleting.noteNo} ${deleting.name}`)
    toast.success('Note deleted', deleting.name)
    setDeleting(null)
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
        subtitle="Numbered notes to the financial statements, and the accounts each note explains."
        actions={canManage ? <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button> : undefined}
      />

      {/* Filters — same bar as Master Accounts */}
      <div className="rounded-2xl border border-line bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Note">
            <Input value={noteQ} onChange={(e) => setNoteQ(e.target.value)} placeholder="Search by note name or number" onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
          </Field>
          <Field label="Statement">
            <Select value={statementFilter} onChange={(e) => setStatementFilter(e.target.value)}>
              <option value="">Nothing selected</option>
              {STATEMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Active">
            <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
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
            Name: n.name,
            'Parent note': noteName(n.parentId),
            Statement: statementLabel(n.statement),
            Accounts: (n.accountIds || []).length,
            Active: n.status === 'inactive' ? 'No' : 'Yes',
          }))}
          onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist">
            <tr>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('noteNo')}>
                <span className="inline-flex items-center gap-1">Note No. <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('name')}>Name</th>
              <th className="px-3 py-2.5">Parent note</th>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('statement')}>
                <span className="inline-flex items-center gap-1">Statement <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
              <th className="px-3 py-2.5">Accounts</th>
              <th className="px-3 py-2.5 text-center">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paged.map((n) => (
              <tr key={n.id}>
                <td className="px-3 py-2.5 font-mono">{n.noteNo}</td>
                <td className="group px-3 py-2.5 font-semibold" style={{ paddingLeft: indentFor(depthOf.get(n.id)) }}>
                  <div className="text-sm font-semibold leading-snug">{n.name}</div>
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
                <td className="px-3 py-2.5 text-mist">{noteName(n.parentId)}</td>
                <td className="px-3 py-2.5">{statementLabel(n.statement)}</td>
                <td className="px-3 py-2.5 text-mist">
                  {(n.accountIds || []).length
                    ? `${(n.accountIds || []).length} account${(n.accountIds || []).length === 1 ? '' : 's'}`
                    : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-center">
                    <Switch
                      checked={n.status !== 'inactive'}
                      disabled={!canManage}
                      onChange={(next) => {
                        persist(notes.map((x) => (x.id === n.id ? { ...x, status: next ? 'active' : 'inactive' } : x)))
                        toast.success(next ? 'Note activated' : 'Note deactivated', n.name)
                      }}
                      aria-label={`Toggle ${n.name} active`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!paged.length && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-mist">
                  No notes yet. Use <span className="font-semibold">Add</span> to create the first note to the accounts.
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Accounts Note' : 'Add Accounts Note'}>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Note Name" required>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </Field>
              </div>
              <Field label="Note No.">
                <Input value={editing.noteNo} onChange={(e) => setEditing({ ...editing, noteNo: e.target.value })} className="font-mono" placeholder="Auto if blank" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Statement" required>
                <Select value={editing.statement} onChange={(e) => setEditing({ ...editing, statement: e.target.value as AccountNote['statement'] })}>
                  {STATEMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Parent note">
                <Select value={editing.parentId} onChange={(e) => setEditing({ ...editing, parentId: e.target.value })} placeholder="Please Select…">
                  <option value="">None (top-level)</option>
                  {notes.filter((n) => n.id !== editing.id).map((n) => (
                    <option key={n.id} value={n.id}>{n.noteNo} - {n.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Accounts covered by this note">
              <div className="max-h-48 space-y-1 overflow-auto rounded-xl border border-line p-2" data-testid="note-accounts">
                {linkableAccounts.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      className="size-4 accent-blue-600"
                      checked={editing.accountIds.includes(a.id)}
                      onChange={() => toggleAccount(a.id)}
                      aria-label={`Include ${a.name}`}
                    />
                    <span className="min-w-0 truncate">{accountLabel(a.id)}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Description">
              <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="please provide description" className="min-h-[42px] max-w-full resize placeholder:italic placeholder:text-rose-400" />
            </Field>

            <Field label="Status">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">ACTIVE</option>
                <option value="inactive">INACTIVE</option>
              </Select>
            </Field>

            <Button className="h-11 w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-700" onClick={save}>Save</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete note?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete note <span className="font-semibold text-inherit">{deleting.noteNo} {deleting.name}</span>? This cannot be undone.
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
