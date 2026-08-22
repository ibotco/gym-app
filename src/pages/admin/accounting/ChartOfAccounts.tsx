import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, RotateCcw, ChevronRight } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, SearchField } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { ACCOUNT_TYPES } from '../../../lib/accounting'
import type { Account, AccountType } from '../../../types'

type Form = {
  id?: string; code: string; name: string; type: AccountType; parentCode: string; detailType: string
  primaryBalance: string; bankBalance: string; description: string; status: 'active' | 'inactive'
}

const blank = (): Form => ({ code: '', name: '', type: 'asset', parentCode: '', detailType: '', primaryBalance: '0', bankBalance: '', description: '', status: 'active' })

function typeLabel(t: AccountType): string {
  if (t === 'asset') return 'Assets'
  if (t === 'liability') return 'Liabilities'
  if (t === 'equity') return 'Equity'
  if (t === 'income') return 'Income'
  return 'Expenses'
}

export function ChartOfAccounts() {
  const app = useApp()
  const { accounts, upsertAccount, deleteAccount, log } = app
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

  const detailTypes = useMemo(() => Array.from(new Set(accounts.map((a) => a.detailType).filter(Boolean) as string[])).sort(), [accounts])

  const parentName = (code?: string) => (code ? accounts.find((a) => a.code === code)?.name || code : '')

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
        const pa = `${a.parentCode || ''}${a.code}`.padEnd(8, '0')
        const pb = `${b.parentCode || ''}${b.code}`.padEnd(8, '0')
        return pa.localeCompare(pb)
      })
  }, [accounts, applied])

  const columns: Column<Account>[] = [
    {
      key: 'name', header: 'Name', sortValue: (a) => a.name,
      render: (a) => (
        <span className="flex items-center gap-1.5">
          {a.parentCode && <span className="text-mist">└</span>}
          <span className="font-semibold">{a.name}</span>
        </span>
      ),
    },
    { key: 'parent', header: 'Parent account', sortValue: (a) => parentName(a.parentCode), render: (a) => <span className="text-mist">{a.parentCode ? parentName(a.parentCode) : '—'}</span> },
    { key: 'type', header: 'Type', sortValue: (a) => typeLabel(a.type), render: (a) => <Badge tone="zinc">{typeLabel(a.type)}</Badge> },
    { key: 'detail', header: 'Detail type', sortValue: (a) => a.detailType || '', render: (a) => <span className="text-mist">{a.detailType || '—'}</span> },
    { key: 'primary', header: 'Primary Balance', sortValue: (a) => a.primaryBalance ?? 0, align: 'right', render: (a) => formatGhsExact(a.primaryBalance ?? 0) },
    { key: 'bankbal', header: 'Bank Balance', sortValue: (a) => a.bankBalance ?? 0, align: 'right', render: (a) => (a.bankBalance != null ? <span className="font-semibold">{formatGhsExact(a.bankBalance)}</span> : '—') },
    { key: 'active', header: 'Active', sortValue: (a) => a.status === 'inactive' ? 0 : 1, align: 'center', render: (a) => <Badge tone={a.status === 'inactive' ? 'zinc' : 'lime'}>{a.status === 'inactive' ? 'No' : 'Yes'}</Badge> },
    {
      key: 'actions', header: 'Options',
      render: (a) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(a)}><Pencil className="size-4" /></button>}
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(a)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing(blank())
  const openEdit = (a: Account) => setEditing({
    id: a.id, code: a.code, name: a.name, type: a.type, parentCode: a.parentCode || '', detailType: a.detailType || '',
    primaryBalance: String(a.primaryBalance ?? 0), bankBalance: a.bankBalance != null ? String(a.bankBalance) : '',
    description: a.description || '', status: a.status || 'active',
  })

  const doSearch = () => setApplied({ accountQ: accountQ.trim(), parent: parentFilter, type: typeFilter, detail: detailFilter, active: activeFilter })
  const doReset = () => {
    setAccountQ(''); setParentFilter(''); setTypeFilter(''); setDetailFilter(''); setActiveFilter('')
    setApplied({ accountQ: '', parent: '', type: '', detail: '', active: '' })
  }

  const save = () => {
    if (!editing) return
    if (!editing.code.trim() || !editing.name.trim()) { toast.error('Code and name are required.'); return }
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
    setSelected((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))
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
              {accounts.map((a) => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
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
          <div className="ml-auto"><ExportButtons filename="chart-of-accounts" rows={rows.map((a) => ({ Name: a.name, 'Parent account': parentName(a.parentCode), Type: typeLabel(a.type), 'Detail type': a.detailType || '', 'Primary Balance': a.primaryBalance ?? 0, 'Bank Balance': a.bankBalance ?? '', Active: a.status === 'inactive' ? 'No' : 'Yes' }))} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} /></div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Accounts <span className="ml-1 text-xs font-normal text-mist">({rows.length})</span></p>
          <Button variant="ghost" size="sm" onClick={toggleAll}>{selected.size === rows.length && rows.length ? 'Clear selection' : 'Select all'}</Button>
        </div>
        <DataTable columns={columns} data={rows} rowKey={(a) => a.id} emptyTitle="No accounts" emptyDesc="Create your first account with the Add button." />
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit account' : 'Add account'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Account code" required><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="font-mono" /></Field>
              <Field label="Account name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Parent account">
                <Select value={editing.parentCode} onChange={(e) => setEditing({ ...editing, parentCode: e.target.value })}>
                  <option value="">None (top-level)</option>
                  {accounts.filter((a) => a.code !== editing.code).map((a) => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as AccountType })}>
                  {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{typeLabel(t.id)}</option>)}
                </Select>
              </Field>
              <Field label="Detail type">
                <Input value={editing.detailType} onChange={(e) => setEditing({ ...editing, detailType: e.target.value })} placeholder="e.g. Cash and cash equivalents" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">Yes</option>
                  <option value="inactive">No</option>
                </Select>
              </Field>
              <Field label="Primary balance (GHS)"><Input type="number" value={editing.primaryBalance} onChange={(e) => setEditing({ ...editing, primaryBalance: e.target.value })} /></Field>
              <Field label="Bank balance (GHS)"><Input type="number" value={editing.bankBalance} onChange={(e) => setEditing({ ...editing, bankBalance: e.target.value })} placeholder="Leave blank if none" /></Field>
            </div>
            <Field label="Description"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}>{editing.id ? 'Save account' : 'Add account'}</Button>
            </div>
          </div>
        )}
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
