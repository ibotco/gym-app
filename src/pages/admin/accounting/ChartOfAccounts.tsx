import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, RotateCcw, ChevronRight, ChevronsUpDown, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker, Switch } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_DEFS, accountTypeName } from '../../../lib/accounting'
import type { Account, AccountType } from '../../../types'
import { accountLabel } from './common'

type Form = {
  id?: string; code: string; name: string; type: AccountType; accountTypeId: string; parentCode: string; detailType: string
  primaryBalance: string; bankBalance: string; description: string; status: 'active' | 'inactive'
  noteNo: string; fundId: string; balanceAsOf: string
}

const blank = (): Form => ({ code: '', name: '', type: 'asset', accountTypeId: '2', parentCode: '', detailType: '', primaryBalance: '0', bankBalance: '', description: '', status: 'active', noteNo: '', fundId: '', balanceAsOf: new Date().toISOString().slice(0, 10) })

function typeLabel(t: AccountType): string {
  if (t === 'asset') return 'Assets'
  if (t === 'liability') return 'Liabilities'
  if (t === 'equity') return 'Equity'
  if (t === 'income') return 'Income'
  return 'Expenses'
}

export function ChartOfAccounts() {
  const app = useApp()
  const { accounts, funds, detailTypes: detailTypeDefs, upsertAccount, deleteAccount, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

  // Filters (draft)
  const [accountQ, setAccountQ] = useState('')
  const [parentFilter, setParentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [detailFilter, setDetailFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  // Applied
  const [applied, setApplied] = useState({ accountQ: '', parent: '', type: '', detail: '', active: '' })

  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // List controls (page size, pagination, sorting, bulk actions)
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [showBulk, setShowBulk] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'detail'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const detailTypes = useMemo(() => Array.from(new Set(accounts.map((a) => a.detailType).filter(Boolean) as string[])).sort(), [accounts])

  const parentName = (code?: string) => (code ? accounts.find((a) => a.code === code)?.name || code : '')
  const parentOf = (a: Account) => (a.parentId ? accounts.find((x) => x.id === a.parentId)?.name || '' : a.parentCode ? parentName(a.parentCode) : '')

  const rows = useMemo(() => {
    return [...accounts]
      .filter((a) => {
        if (applied.accountQ && !`${a.code} ${a.name}`.toLowerCase().includes(applied.accountQ.toLowerCase())) return false
        if (applied.parent && a.parentCode !== applied.parent) return false
        if (applied.type && a.type !== applied.type) return false
        if (applied.detail && a.detailType !== applied.detail) return false
        if (applied.active) {
          const isActive = a.status !== 'inactive'
          if (applied.active === 'yes' && !isActive) return false
          if (applied.active === 'no' && isActive) return false
        }
        return true
      })
      .sort((a, b) => {
        const key = (x: Account) => sortBy === 'type' ? (accountTypeName(x.accountTypeId) || typeLabel(x.type)) : sortBy === 'detail' ? (x.detailType || '') : x.name
        const cmp = key(a).localeCompare(key(b))
        return sortDir === 'asc' ? cmp : -cmp
      })
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

  const openNew = () => setEditing(blank())
  const openEdit = (a: Account) => setEditing({
    id: a.id, code: a.code, name: a.name, type: a.type, accountTypeId: a.accountTypeId ? String(a.accountTypeId) : '', parentCode: a.parentCode || '', detailType: a.detailType || '',
    primaryBalance: String(a.primaryBalance ?? 0), bankBalance: a.bankBalance != null ? String(a.bankBalance) : '',
    description: a.description || '', status: a.status || 'active',
    noteNo: a.noteNo || '', fundId: a.fundId || '', balanceAsOf: a.balanceAsOf || '',
  })

  /** Next free numeric code when Account Code is left blank (per type range). */
  const autoCode = (type: AccountType) => {
    const base = { asset: 1000, liability: 2000, equity: 3000, income: 4000, expense: 5000 }[type]
    const used = accounts.map((a) => Number(a.code)).filter((n) => Number.isFinite(n) && n >= base && n < base + 1000)
    const max = used.length ? Math.max(...used) : base
    return String(max + 10)
  }

  const doSearch = () => setApplied({ accountQ: accountQ.trim(), parent: parentFilter, type: typeFilter, detail: detailFilter, active: activeFilter })
  const doReset = () => {
    setAccountQ(''); setParentFilter(''); setTypeFilter(''); setDetailFilter(''); setActiveFilter('')
    setApplied({ accountQ: '', parent: '', type: '', detail: '', active: '' })
  }

  const save = () => {
    if (!editing) return
    if (!editing.detailType.trim()) { toast.error('Select a detail type.'); return }
    if (!editing.name.trim()) { toast.error('Enter the account name.'); return }
    if (!editing.fundId) { toast.error('Select a fund.'); return }
    if (editing.primaryBalance.trim() === '' || Number.isNaN(Number(editing.primaryBalance))) { toast.error('Enter the balance.'); return }
    if (!editing.code.trim()) editing.code = autoCode(editing.type)
    const clash = accounts.some((a) => a.code === editing.code.trim() && a.id !== editing.id)
    if (clash) { toast.error('That account code already exists.'); return }
    const isNew = !editing.id
    upsertAccount({
      id: editing.id || uid('ac'),
      code: editing.code.trim(),
      name: editing.name.trim(),
      type: editing.type,
      parentCode: editing.parentCode.trim() || undefined,
      detailType: editing.detailType.trim() || undefined,
      primaryBalance: Number(editing.primaryBalance) || 0,
      bankBalance: editing.bankBalance !== '' ? Number(editing.bankBalance) : undefined,
      description: editing.description.trim() || undefined,
      accountTypeId: editing.accountTypeId ? Number(editing.accountTypeId) : undefined,
      noteNo: editing.noteNo.trim() || undefined,
      fundId: editing.fundId || undefined,
      balanceAsOf: editing.balanceAsOf || undefined,
      status: editing.status,
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Account', `${isNew ? 'Created' : 'Updated'} ${editing.code} ${editing.name}`)
    toast.success(isNew ? 'Account created' : 'Account updated')
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
            <Select value={parentFilter} onChange={(e) => setParentFilter(e.target.value)}>
              <option value="">Nothing selected</option>
              {accounts.map((a) => <option key={a.id} value={a.code}>{accountLabel(a)}</option>)}
            </Select>
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Type</label>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Nothing selected</option>
              {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{typeLabel(t.id)}</option>)}
            </Select>
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Detail type</label>
            <Select value={detailFilter} onChange={(e) => setDetailFilter(e.target.value)}>
              <option value="">Nothing selected</option>
              {detailTypes.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
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
        <ExportButtons filename="chart-of-accounts" rows={rows.map((a) => ({ Name: a.name, 'Parent account': parentName(a.parentCode), Type: typeLabel(a.type), 'Detail type': a.detailType || '', 'Primary Balance': a.primaryBalance ?? 0, 'Bank Balance': a.bankBalance ?? '', Active: a.status === 'inactive' ? 'No' : 'Yes' }))} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
        <div className="relative">
          <Button variant="outline" onClick={() => setShowBulk((v) => !v)} disabled={!selected.size}>
            Bulk Actions{selected.size ? ` (${selected.size})` : ''}
          </Button>
          {showBulk && selected.size > 0 && (
            <div className="menu-pop absolute left-0 top-full z-30 mt-1 w-48 rounded-xl p-1.5">
              {canManage && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('active')}><CheckCircle2 className="size-4" /> Activate</button>}
              {canManage && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('inactive')}><XCircle className="size-4" /> Deactivate</button>}
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
              <th className="px-3 py-2.5 text-center">Active</th>
              <th className="px-3 py-2.5 text-center">Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paged.map((a) => (
              <tr key={a.id} className={selected.has(a.id) ? 'bg-lime/5' : undefined}>
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} aria-label={`Select ${a.name}`} className="size-4 accent-blue-600" />
                </td>
                <td className={`px-3 py-2.5 font-semibold ${(a.parentId || a.parentCode) ? 'pl-10' : ''}`}>{a.name}</td>
                <td className="px-3 py-2.5 text-mist">{parentOf(a)}</td>
                <td className="px-3 py-2.5">{accountTypeName(a.accountTypeId) || typeLabel(a.type)}</td>
                <td className="px-3 py-2.5">{a.detailType || '—'}</td>
                <td className="px-3 py-2.5 text-right">{formatGhsExact(a.primaryBalance ?? 0)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{a.bankBalance != null ? formatGhsExact(a.bankBalance) : ''}</td>
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
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(a)}><Pencil className="size-4" /></button>}
                  {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(a)}><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
            {!paged.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-mist">No accounts. Create your first account with the Add button.</td></tr>}
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Chart of Accounts' : 'Add Chart of Accounts'} wide>
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
                    <Select value={editing.parentCode} onChange={(e) => setEditing({ ...editing, parentCode: e.target.value })} placeholder="Please Select…">
                      <option value="">None (top-level)</option>
                      {accounts.filter((a) => a.code !== editing.code && a.type === editing.type).map((a) => <option key={a.id} value={a.code}>{accountLabel(a)}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Note No.">
                  <Input value={editing.noteNo} onChange={(e) => setEditing({ ...editing, noteNo: e.target.value })} placeholder="note no." className="placeholder:italic placeholder:text-rose-400" />
                </Field>
              </div>

              {/* Fund | Description */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Fund" required>
                  <Select value={editing.fundId} onChange={(e) => setEditing({ ...editing, fundId: e.target.value })} placeholder="Please Select…">
                    <option value="" disabled>Please Select…</option>
                    {funds.filter((f) => f.status === 'active').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="please provide description" className="min-h-16 max-w-full resize placeholder:italic placeholder:text-rose-400" />
                  </Field>
                </div>
              </div>

              {/* Balance | as of */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Balance" required><Input type="number" value={editing.primaryBalance} onChange={(e) => setEditing({ ...editing, primaryBalance: e.target.value })} /></Field>
                <Field label="as of"><DatePicker value={editing.balanceAsOf} onChange={(v) => setEditing({ ...editing, balanceAsOf: v })} /></Field>
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
    </div>
  )
}
