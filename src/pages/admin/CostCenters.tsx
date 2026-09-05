import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader, Badge, Button, Modal, Field, Input, Select, SearchField } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, uid } from '../../lib/utils'
import type { CostCenter } from '../../types'

type CostCenterForm = {
  code: string
  name: string
  branchId: string
  department: string
  managerId: string
  annualBudget: string
  description: string
  status: 'active' | 'inactive'
}

const blank = (): CostCenterForm => ({
  code: '', name: '', branchId: '', department: '', managerId: '', annualBudget: '', description: '', status: 'active',
})

export function CostCenters() {
  const {
    costCenters, branches, users, upsertCostCenter, deleteCostCenter, log, activeCompanyId,
    receipts, paymentVouchers, sales, procPurchaseOrders, supplierInvoices, journals,
  } = useApp()
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager', 'company_admin')

  const [q, setQ] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CostCenterForm>(blank())
  const [err, setErr] = useState('')

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name
  const managerName = (id?: string) => users.find((u) => u.id === id)?.name

  // People who can be assigned as a cost center owner.
  const owners = useMemo(
    () =>
      users
        .filter((u) => ['super_admin', 'gym_manager', 'company_admin', 'branch_admin', 'staff', 'accountant'].includes(u.role))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return costCenters
      .filter((c) => {
        if (term) {
          const haystack = [
            c.code, c.name, c.department || '',
            branchName(c.branchId) || '', managerName(c.managerId) || '', c.description || '',
          ].join(' ').toLowerCase()
          if (!haystack.includes(term)) return false
        }
        if (branchFilter === 'none' && c.branchId) return false
        if (branchFilter !== 'all' && branchFilter !== 'none' && c.branchId !== branchFilter) return false
        const st = c.status || 'active'
        if (statusFilter !== 'all' && st !== statusFilter) return false
        return true
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [costCenters, q, branchFilter, statusFilter, branches, users])

  const totalBudget = useMemo(
    () => rows.reduce((sum, c) => sum + (c.annualBudget || 0), 0),
    [rows],
  )

  // Roll up transaction line items that carry a cost center, so the page
  // doubles as a cost-center report. Only lines that were actually tagged count.
  const activity = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; sales: number; purchases: number; journals: number }>()
    const bump = (id: string | undefined, key: 'income' | 'expense' | 'sales' | 'purchases' | 'journals', amount: number) => {
      if (!id || amount <= 0) return
      const entry = map.get(id) || { income: 0, expense: 0, sales: 0, purchases: 0, journals: 0 }
      entry[key] += amount
      map.set(id, entry)
    }
    for (const r of receipts) for (const l of r.lines) bump(l.costCenterId, 'income', l.amount || 0)
    for (const p of paymentVouchers) for (const l of p.lines) bump(l.costCenterId, 'expense', l.amount || 0)
    for (const s of sales) for (const l of s.lines) {
      bump(l.costCenterId, 'sales', Math.max(0, (l.quantity || 0) * (l.unitPrice || 0) - (l.discount || 0)))
    }
    for (const o of procPurchaseOrders) for (const l of o.lines) {
      bump(l.costCenterId, 'purchases', (l.quantity || 0) * (l.unitCost || 0) * (1 - (l.discountPercent || 0) / 100))
    }
    for (const inv of supplierInvoices) for (const l of inv.lines) {
      bump(l.costCenterId, 'purchases', (l.quantity || 0) * (l.unitCost || 0) * (1 - (l.discountPercent || 0) / 100))
    }
    // Journal entries: count the debit side (the charge) against the cost center.
    for (const j of journals) for (const l of j.lines) bump(l.costCenterId, 'journals', l.debit || 0)
    return map
  }, [receipts, paymentVouchers, sales, procPurchaseOrders, supplierInvoices, journals])

  const activityRows = useMemo(
    () =>
      costCenters
        .filter((c) => activity.has(c.id))
        .map((c) => ({ center: c, totals: activity.get(c.id)! }))
        .sort((a, b) => {
          const sum = (t: { income: number; expense: number; sales: number; purchases: number; journals: number }) => t.income + t.expense + t.sales + t.purchases + t.journals
          return sum(b.totals) - sum(a.totals)
        }),
    [costCenters, activity],
  )

  const openCreate = () => {
    setEditingId(null)
    setForm(blank())
    setErr('')
    setOpen(true)
  }

  const openEdit = (c: CostCenter) => {
    setEditingId(c.id)
    setForm({
      code: c.code,
      name: c.name,
      branchId: c.branchId || '',
      department: c.department || '',
      managerId: c.managerId || '',
      annualBudget: c.annualBudget != null ? String(c.annualBudget) : '',
      description: c.description || '',
      status: c.status || 'active',
    })
    setErr('')
    setOpen(true)
  }

  const validate = () => {
    if (form.code.trim().length < 2) return 'A cost center code is required.'
    const dupCode = costCenters.some(
      (c) => c.code.trim().toLowerCase() === form.code.trim().toLowerCase() && c.id !== editingId,
    )
    if (dupCode) return 'A cost center with that code already exists.'
    if (form.name.trim().length < 3) return 'Cost center name must be at least 3 characters.'
    if (form.annualBudget && (Number.isNaN(Number(form.annualBudget)) || Number(form.annualBudget) < 0)) {
      return 'Annual budget must be zero or a positive number.'
    }
    return ''
  }

  const save = () => {
    if (!canEdit) { toast.error('Only managers and super admins can change cost centers.'); return }
    const v = validate()
    if (v) { setErr(v); return }
    const record: CostCenter = {
      id: editingId || uid('cc'),
      companyId: costCenters.find((c) => c.id === editingId)?.companyId || activeCompanyId,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      branchId: form.branchId || undefined,
      department: form.department.trim() || undefined,
      managerId: form.managerId || undefined,
      annualBudget: form.annualBudget === '' ? undefined : Number(form.annualBudget),
      description: form.description.trim() || undefined,
      status: form.status,
      createdAt: costCenters.find((c) => c.id === editingId)?.createdAt || new Date().toISOString().slice(0, 10),
    }
    upsertCostCenter(record)
    log(user?.id || 'admin', editingId ? 'UPDATE' : 'CREATE', 'CostCenter', `${editingId ? 'Edited' : 'Created'} ${record.code} — ${record.name}`)
    toast.success(editingId ? 'Cost center updated' : 'Cost center created')
    setOpen(false)
  }

  const remove = (c: CostCenter) => {
    if (!canEdit) { toast.error('Only managers and super admins can change cost centers.'); return }
    if (!window.confirm(`Delete “${c.name}” (${c.code})? This cannot be undone.`)) return
    deleteCostCenter(c.id)
    log(user?.id || 'admin', 'DELETE', 'CostCenter', `Deleted ${c.code} — ${c.name}`)
    toast.success('Cost center deleted')
  }

  const columns: Column<CostCenter>[] = [
    { key: 'code', header: 'CODE', sortValue: (c) => c.code, render: (c) => <span className="font-mono text-xs font-semibold text-lime">{c.code}</span> },
    { key: 'name', header: 'COST CENTER', sortValue: (c) => c.name, render: (c) => (
      <div>
        <p className="font-semibold">{c.name}</p>
        {c.description && <p className="max-w-[26rem] truncate text-xs text-mist">{c.description}</p>}
      </div>
    ) },
    { key: 'branch', header: 'BRANCH', sortValue: (c) => branchName(c.branchId) || 'zz', render: (c) => (
      c.branchId ? <span className="text-sm">{branchName(c.branchId)}</span> : <Badge tone="zinc">Company-wide</Badge>
    ) },
    { key: 'department', header: 'DEPARTMENT', sortValue: (c) => c.department || '', render: (c) => <span className="text-sm">{c.department || '—'}</span> },
    { key: 'manager', header: 'OWNER', sortValue: (c) => managerName(c.managerId) || '', render: (c) => <span className="text-sm">{managerName(c.managerId) || '—'}</span> },
    { key: 'budget', header: 'ANNUAL BUDGET', align: 'right', sortValue: (c) => c.annualBudget || 0, render: (c) => (
      <span className="text-sm tabular-nums">{c.annualBudget != null ? formatGhs(c.annualBudget) : '—'}</span>
    ) },
    { key: 'status', header: 'STATUS', sortValue: (c) => c.status || 'active', render: (c) => (
      <Badge tone={(c.status || 'active') === 'active' ? 'lime' : 'zinc'}>{(c.status || 'active') === 'active' ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', header: 'ACTIONS', align: 'right', render: (c) => (
      <div className="flex items-center justify-end gap-1">
        {canEdit && (
          <>
            <button className="rounded-lg p-2 text-mist transition hover:text-lime" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`} title="Edit">
              <Pencil className="size-4" />
            </button>
            <button className="rounded-lg p-2 text-mist transition hover:text-ember" onClick={() => remove(c)} aria-label={`Delete ${c.name}`} title="Delete">
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
    ) },
  ]

  const activeFilters = (branchFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  return (
    <div>
      <PageHeader
        eyebrow="Organizations"
        title="Cost Centers"
        desc="Group spending by branch, department, or function to track budgets and allocations."
        actions={canEdit ? <Button onClick={openCreate}><Plus className="size-4" /> New cost center</Button> : undefined}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search code, name, branch, department…"
          className="w-full lg:max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter by branch">
            <option value="all">All branches</option>
            <option value="none">Company-wide (no branch)</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      <p className="mb-2 text-xs text-mist">
        Showing {rows.length} of {costCenters.length} cost center{costCenters.length === 1 ? '' : 's'}
        {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters === 1 ? '' : 's'} active`}
        {rows.length > 0 && <> · Total budget {formatGhs(totalBudget)}</>}
      </p>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(c) => c.id}
        emptyTitle="No cost centers found"
        emptyDesc="Adjust your search or filters, or create a new cost center."
      />

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Transaction activity by cost center</h2>
            <p className="text-xs text-mist">
              Amounts tagged to each cost center across income &amp; expense vouchers, sales, purchase documents and journal entries (debit side).
              {activityRows.length === 0 && ' No line items carry a cost center yet.'}
            </p>
          </div>
        </div>
        {activityRows.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Cost center</th>
                  <th className="text-right">Income</th>
                  <th className="text-right">Expenses</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">Purchases</th>
                  <th className="text-right">Journals</th>
                  <th className="text-right">Total activity</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map(({ center, totals }) => {
                  const total = totals.income + totals.expense + totals.sales + totals.purchases + totals.journals
                  return (
                    <tr key={center.id}>
                      <td>
                        <p className="font-semibold">{center.name}</p>
                        <p className="font-mono text-[11px] text-mist">{center.code}</p>
                      </td>
                      <td className="text-right tabular-nums">{formatGhs(totals.income)}</td>
                      <td className="text-right tabular-nums">{formatGhs(totals.expense)}</td>
                      <td className="text-right tabular-nums">{formatGhs(totals.sales)}</td>
                      <td className="text-right tabular-nums">{formatGhs(totals.purchases)}</td>
                      <td className="text-right tabular-nums">{formatGhs(totals.journals)}</td>
                      <td className="text-right font-semibold tabular-nums">{formatGhs(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit cost center' : 'New cost center'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CC-OPS-01" /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Club Operations" /></Field>
          <Field label="Branch (optional)">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">— Company-wide (no branch) —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Department (optional)"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Operations" /></Field>
          <Field label="Owner (optional)">
            <Select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
              <option value="">— Unassigned —</option>
              {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Annual budget (GHS)"><Input type="number" min="0" value={form.annualBudget} onChange={(e) => setForm({ ...form, annualBudget: e.target.value })} placeholder="0" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CostCenterForm['status'] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (optional)">
              <textarea
                className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm outline-none transition focus:border-lime"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this cost center covers…"
              />
            </Field>
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={save}>{editingId ? 'Save changes' : 'Create cost center'}</Button>
      </Modal>
    </div>
  )
}
