import { useMemo, useState } from 'react'
import { Plus, Trash2, Search, RotateCcw, ChevronRight, ChevronsUpDown, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker, Switch } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_DEFS, accountTypeName } from '../../../lib/accounting'
import { indentFor, orderByParent } from '../../../lib/hierarchy'
import type { Account, AccountScope, AccountType } from '../../../types'
import { accountLabel } from './common'
import { useFundAccounting } from '../../../components/FundField'
import { codeGroupFor, nextCodeForGroup, validateAccount } from '../../../lib/chartOfAccounts'

/** accounting_account_type id 16 = Bank — the rows Banking → Bank Accounts lists. */
const BANK_TYPE_ID = 16

type Form = {
  id?: string; code: string; name: string; type: AccountType; accountTypeId: string; parentCode: string; detailType: string
  primaryBalance: string; bankBalance: string; description: string; status: 'active' | 'inactive'
  noteNo: string; fundId: string; balanceAsOf: string
  /** Ownership level — who can see this account. */
  scopeType: AccountScope
  /* -- Bank columns (Account Type 16 = Bank). Same row as Banking → Bank Accounts. -- */
  bank: string; accountNumber: string; bankBranch: string
  bankAccountType: 'current' | 'savings' | 'momo'
  routing: string; contactNo: string; email: string; country: string
}

const blank = (): Form => ({ code: '', name: '', type: 'asset', accountTypeId: '2', parentCode: '', detailType: '', primaryBalance: '0', bankBalance: '', description: '', status: 'active', noteNo: '', fundId: '', balanceAsOf: new Date().toISOString().slice(0, 10), scopeType: 'COMPANY', bank: '', accountNumber: '', bankBranch: '', bankAccountType: 'current', routing: '', contactNo: '', email: '', country: '' })

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
  /** Company-level Fund Accounting switch (Settings → General → App Enables). */
  const fundOn = useFundAccounting()
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
      // Bank accounts live in ONE table with the rest of the chart, but they
      // are listed in Banking → Bank Accounts only — never here.
      if (Number(a.accountTypeId) === BANK_TYPE_ID) return false
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

  const openNew = () => setEditing(blank())
  const openEdit = (a: Account) => setEditing({
    // parentId is the authoritative link: a code renumbering can leave
    // parentCode pointing at a code nobody owns any more, which used to show
    // the parent as blank even though the list displayed it correctly.
    id: a.id, code: a.code, name: a.name, type: a.type, accountTypeId: a.accountTypeId ? String(a.accountTypeId) : '', parentCode: parentCodeOf(a), detailType: a.detailType || '',
    primaryBalance: String(a.primaryBalance ?? 0), bankBalance: a.bankBalance != null ? String(a.bankBalance) : '',
    description: a.description || '', status: a.status || 'active',
    noteNo: a.noteNo || '', fundId: a.fundId || '', balanceAsOf: a.balanceAsOf || '',
    scopeType: a.scopeType || 'GLOBAL',
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

  const doSearch = () => setApplied({ accountQ: accountQ.trim(), parent: parentFilter, type: typeFilter, detail: detailFilter, active: activeFilter })
  const doReset = () => {
    setAccountQ(''); setParentFilter(''); setTypeFilter(''); setDetailFilter(''); setActiveFilter('')
    setApplied({ accountQ: '', parent: '', type: '', detail: '', active: '' })
  }

  const save = () => {
    if (!editing) return
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
      // Ownership must agree with the scope: GLOBAL has neither, COMPANY has a
      // company, BRANCH has both.
      scopeType: editing.scopeType,
      companyId: editing.scopeType === 'GLOBAL' ? undefined : app.activeCompanyId,
      branchId: editing.scopeType === 'BRANCH' ? app.activeBranchId : undefined,
      parentCode: editing.parentCode.trim() || undefined,
      // Keep the id link in step with the selected code, so the list and the
      // editor can never disagree about the parent.
      parentId: editing.parentCode.trim()
        ? accounts.find((x) => x.code === editing.parentCode.trim())?.id
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
                  {a.scopeNeedsReview && (
                    <span className="ml-1 rounded bg-rose-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-rose-700" title="Ownership could not be determined automatically — please review.">
                      Review
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
              </tr>
            ))}
            {!paged.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-mist">No accounts. Create your first account with the Add button.</td></tr>}
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

              {/* Ownership level */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Ownership" required>
                  <Select value={editing.scopeType} onChange={(e) => setEditing({ ...editing, scopeType: e.target.value as AccountScope })}>
                    <option value="GLOBAL">Global — every company &amp; branch</option>
                    <option value="COMPANY">Company — this company only</option>
                    <option value="BRANCH">Branch — this branch only</option>
                  </Select>
                </Field>
                <p className="self-end text-xs leading-relaxed text-mist sm:col-span-2">
                  {editing.scopeType === 'GLOBAL' && 'Shared with every company and branch. Best for Cash, Bank, A/R, A/P and other core accounts.'}
                  {editing.scopeType === 'COMPANY' && `Only ${app.companies.find((c) => c.id === app.activeCompanyId)?.name || 'this company'} will see it.`}
                  {editing.scopeType === 'BRANCH' && `Only the ${app.branches.find((b) => b.id === app.activeBranchId)?.name || 'active branch'} branch will see it.`}
                </p>
              </div>

              {/* Parent account | Note No. */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="Parent account" required>
                    <Select value={editing.parentCode} onChange={(e) => setEditing({ ...editing, parentCode: e.target.value })} placeholder="Please Select…">
                      <option value="">None (top-level)</option>
                      {accounts
                        .filter((a) => Number(a.accountTypeId) !== BANK_TYPE_ID
                          && a.code !== editing.code && (a.type === editing.type || a.code === editing.parentCode))
                        .map((a) => <option key={a.id} value={a.code}>{accountLabel(a)}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Note No.">
                  <Input value={editing.noteNo} onChange={(e) => setEditing({ ...editing, noteNo: e.target.value })} placeholder="note no." className="placeholder:italic placeholder:text-rose-400" />
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
